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

function terminal(status) {
  return DONE.includes(clean(status).toLowerCase());
}

async function withActions(payload) {
  const rows = [...(payload.inbox || []), ...(payload.requests || [])];
  const ids = [...new Set(rows.map((row) => row.id).filter(Boolean))];
  if (!ids.length) return payload;

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
  return {
    ...payload,
    inbox: (payload.inbox || []).map(attach),
    requests: (payload.requests || []).map(attach),
  };
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
