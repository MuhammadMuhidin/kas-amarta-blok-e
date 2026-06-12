import { NextResponse } from "next/server";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { getCurrentAdminSession } from "@/lib/adminSession";
import { getApprovalCenterOverview } from "@/features/approval/approvalService";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { dbTable } from "@/lib/dbTable";
import { recordAdminActivity } from "@/lib/adminActivity";
import { notifyRequesterFinal, notifyRoleNextStep } from "@/lib/approvalWhatsApp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APPROVAL_MASTERS_TABLE = dbTable("approval_masters");
const APPROVAL_REQUESTS_TABLE = dbTable("approval_requests");
const APPROVAL_ACTIONS_TABLE = dbTable("approval_actions");
const DONE = ["completed", "rejected", "cancelled"];

function clean(value) {
  return String(value || "").trim();
}

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function terminal(status) {
  return DONE.includes(clean(status).toLowerCase());
}

function flowSteps(value = []) {
  return [...(Array.isArray(value) ? value : [])]
    .map((step, index) => ({
      step: number(step.step) || index + 1,
      role: clean(step.role).toLowerCase(),
      action: clean(step.action) || "approve",
    }))
    .filter((step) => step.role)
    .sort((a, b) => a.step - b.step);
}

function currentStep(master, stepNo) {
  return flowSteps(master?.flow_schema || []).find((step) => step.step === number(stepNo)) || null;
}

function nextStep(master, stepNo) {
  return flowSteps(master?.flow_schema || []).find((step) => step.step > number(stepNo)) || null;
}

function uniqueRows(rows = []) {
  const map = new Map();
  for (const row of rows) {
    if (row?.id) map.set(row.id, row);
  }
  return [...map.values()];
}

function canBeInbox(row, role) {
  if (!row || terminal(row.status) || !clean(row.current_approver_role)) return false;
  return role === "admin" || clean(row.current_approver_role).toLowerCase() === role;
}

function normalizeCenterPayload(payload = {}) {
  const role = clean(payload.access_role).toLowerCase() || "admin";
  const rows = uniqueRows([...(payload.inbox || []), ...(payload.requests || [])]);
  const safeInbox = rows.filter((row) => canBeInbox(row, role));

  return {
    ...payload,
    access_role: role,
    inbox: safeInbox,
    requests: rows,
    summary: payload.summary || {
      inbox: safeInbox.length,
      processing: rows.filter((row) => !terminal(row.status)).length,
      completed: rows.filter((row) => row.status === "completed").length,
      rejected: rows.filter((row) => row.status === "rejected").length,
    },
  };
}

async function withActions(payload) {
  const rows = uniqueRows([...(payload.inbox || []), ...(payload.requests || [])]);
  const ids = rows.map((row) => row.id).filter(Boolean);
  if (!ids.length) return normalizeCenterPayload(payload);

  const supabase = getSupabaseAdmin();
  const { data: actions, error } = await supabase
    .from(APPROVAL_ACTIONS_TABLE)
    .select("*")
    .in("request_id", ids)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message || "Gagal membaca riwayat approval");

  const grouped = new Map();
  for (const action of actions || []) {
    if (!grouped.has(action.request_id)) grouped.set(action.request_id, []);
    grouped.get(action.request_id).push(action);
  }

  const attach = (row) => ({ ...row, approval_actions: grouped.get(row.id) || [] });
  return normalizeCenterPayload({
    ...payload,
    inbox: (payload.inbox || []).map(attach),
    requests: (payload.requests || []).map(attach),
  });
}

async function actOnRequest({ req, accessRole, id, action, note }) {
  const supabase = getSupabaseAdmin();
  const role = clean(accessRole).toLowerCase() || "admin";
  const selectedAction = clean(action) || "approve";

  const { data: request, error: readError } = await supabase
    .from(APPROVAL_REQUESTS_TABLE)
    .select("*")
    .eq("id", clean(id))
    .maybeSingle();

  if (readError) throw new Error(readError.message || "Gagal membaca pengajuan");
  if (!request) throw new Error("Pengajuan tidak ditemukan");
  if (terminal(request.status)) throw new Error("Pengajuan sudah selesai");
  if (role !== "admin" && request.current_approver_role !== role) throw new Error("Pengajuan ini belum masuk ke role kamu");

  const now = new Date().toISOString();
  const isReject = selectedAction === "reject";
  let updatePayload;
  let actionName;
  let nextRole = "";

  if (isReject) {
    updatePayload = { status: "rejected", current_step: null, current_approver_role: null, updated_at: now };
    actionName = "reject";
  } else {
    const { data: master, error: masterError } = await supabase
      .from(APPROVAL_MASTERS_TABLE)
      .select("flow_schema")
      .eq("id", request.master_id)
      .maybeSingle();

    if (masterError) throw new Error(masterError.message || "Gagal membaca master approval");

    const activeStep = currentStep(master, request.current_step);
    const next = nextStep(master, request.current_step);
    nextRole = next?.role || "";
    actionName = activeStep?.action || selectedAction;
    updatePayload = next
      ? {
          status: next.action === "validate_payment" ? "waiting_payment_validation" : "waiting_approval",
          current_step: next.step,
          current_approver_role: next.role,
          updated_at: now,
        }
      : {
          status: "completed",
          current_step: null,
          current_approver_role: null,
          updated_at: now,
          completed_at: now,
        };

    if (activeStep?.action === "validate_payment" || selectedAction === "validate_payment") updatePayload.payment_status = "paid";
  }

  const { data: updatedRequest, error } = await supabase
    .from(APPROVAL_REQUESTS_TABLE)
    .update(updatePayload)
    .eq("id", request.id)
    .select("*")
    .single();

  if (error) throw new Error(error.message || "Gagal memproses pengajuan");

  const { error: actionError } = await supabase.from(APPROVAL_ACTIONS_TABLE).insert({
    request_id: request.id,
    step: request.current_step || 0,
    role,
    actor: role,
    action: actionName,
    note: clean(note),
  });

  if (actionError) throw new Error(actionError.message || "Gagal menyimpan riwayat approval");

  await recordAdminActivity(req, {
    type: isReject ? "reject" : "approve",
    module: "approval-center",
    severity: isReject ? "warning" : "success",
    message: `${isReject ? "Reject" : updatedRequest.status === "completed" ? "Complete" : "Approve