import { NextResponse } from "next/server";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { getCurrentAdminSession } from "@/lib/adminSession";
import { getApprovalCenterOverview } from "@/features/approval/approvalService";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { dbTable } from "@/lib/dbTable";

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
    summary: {
      inbox: safeInbox.length,
      processing: rows.filter((row) => !terminal(row.status)).length,
      completed: rows.filter((row) => row.status === "completed").length,
      rejected: rows.filter((row) => row.status === "rejected").length,
    },
  };
}

async function includeParticipatedRows(payload = {}) {
  const role = clean(payload.access_role).toLowerCase() || "admin";
  if (role === "admin") return payload;

  const supabase = getSupabaseAdmin();
  const { data: roleActions, error: actionError } = await supabase
    .from(APPROVAL_ACTIONS_TABLE)
    .select("request_id")
    .eq("role", role);

  if (actionError) throw new Error(actionError.message || "Gagal membaca riwayat approval role");

  const existing = new Set([...(payload.inbox || []), ...(payload.requests || [])].map((row) => row.id));
  const missingIds = [...new Set((roleActions || []).map((row) => row.request_id).filter(Boolean))]
    .filter((id) => !existing.has(id));

  if (!missingIds.length) return payload;

  const { data: participatedRows, error } = await supabase
    .from(APPROVAL_REQUESTS_TABLE)
    .select("*")
    .in("id", missingIds);

  if (error) throw new Error(error.message || "Gagal membaca pengajuan yang pernah diproses role");

  return {
    ...payload,
    requests: uniqueRows([...(payload.requests || []), ...(participatedRows || [])]),
  };
}

async function withActions(payload) {
  const expandedPayload = await includeParticipatedRows(payload);
  const rows = uniqueRows([...(expandedPayload.inbox || []), ...(expandedPayload.requests || [])]);
  const ids = rows.map((row) => row.id).filter(Boolean);
  if (!ids.length) return normalizeCenterPayload(expandedPayload);

  const supabase = getSupabaseAdmin();
  const { data: actions } = await supabase
    .from(APPROVAL_ACTIONS_TABLE)
    .select("*")
    .in("request_id", ids)
    .order("created_at", { ascending: true });

  const grouped = new Map();
  for (const action of actions || []) {
    if (!grouped.has(action.request_id)) grouped.set(action.request_id, []);
    grouped.get(action.request_id).push(action);
  }

  const attach = (row) => ({ ...row, approval_actions: grouped.get(row.id) || [] });
  return normalizeCenterPayload({
    ...expandedPayload,
    inbox: (expandedPayload.inbox || []).map(attach),
    requests: (expandedPayload.requests || []).map(attach),
  });
}

async function actOnRequest({ accessRole, id, action, note }) {
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

  const { error } = await supabase.from(APPROVAL_REQUESTS_TABLE).update(updatePayload).eq("id", request.id);
  if (error) throw new Error(error.message || "Gagal memproses pengajuan");

  await supabase.from(APPROVAL_ACTIONS_TABLE).insert({
    request_id: request.id,
    step: request.current_step || 0,
    role,
    actor: role,
    action: actionName,
    note: clean(note),
  });

  return { ok: true };
}

export async function GET(req) {
  try {
    if (!(await isAdmin(req))) return unauthorized();
    const session = await getCurrentAdminSession(req);
    const payload = await getApprovalCenterOverview({ accessRole: session?.access_role || "admin" });
    return NextResponse.json(await withActions(payload));
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal membaca approval requests" }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    if (!(await isAdmin(req))) return unauthorized();
    if (!validateCSRF(req)) return NextResponse.json({ error: "CSRF tidak valid" }, { status: 403 });

    const session = await getCurrentAdminSession(req);
    const body = await req.json();
    return NextResponse.json(await actOnRequest({ accessRole: session?.access_role || "admin", id: body.id, action: body.action, note: body.note }));
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal memproses approval request" }, { status: 500 });
  }
}
