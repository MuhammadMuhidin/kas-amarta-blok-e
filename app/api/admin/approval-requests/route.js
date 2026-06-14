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
      label: clean(step.label),
      action: clean(step.action) || "approve",
    }))
    .filter((step) => step.role)
    .sort((a, b) => a.step - b.step);
}

function snapshotFlow(request = {}) {
  return flowSteps(request.form_data?.__system?.flow_schema_snapshot || []);
}

function currentStep(flow, stepNo) {
  return flowSteps(flow).find((step) => step.step === number(stepNo)) || null;
}

function nextStep(flow, stepNo) {
  return flowSteps(flow).find((step) => step.step > number(stepNo)) || null;
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

function publicSubmissionData(row = {}) {
  return Object.fromEntries(Object.entries(row.form_data || {}).filter(([key]) => !key.startsWith("__")));
}

async function signAttachment(supabase, value) {
  if (!value || typeof value !== "object" || value.kind !== "attachment" || !value.bucket || !value.path) return value;
  const { data, error } = await supabase.storage.from(value.bucket).createSignedUrl(value.path, 60 * 60);
  return {
    ...value,
    signed_url: error ? "" : data?.signedUrl || "",
    preview_error: error?.message || "",
  };
}

async function attachSubmissionDetails(supabase, row) {
  const formData = publicSubmissionData(row);
  const signedEntries = await Promise.all(Object.entries(formData).map(async ([key, value]) => [key, await signAttachment(supabase, value)]));
  return {
    ...row,
    form_data: Object.fromEntries(signedEntries),
    fields_schema_snapshot: Array.isArray(row.form_data?.__system?.fields_schema_snapshot) ? row.form_data.__system.fields_schema_snapshot : [],
    flow_schema_snapshot: snapshotFlow(row),
    master_revision: number(row.form_data?.__system?.master_revision) || 1,
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

  const detailedRows = await Promise.all(rows.map(async (row) => ({
    ...(await attachSubmissionDetails(supabase, row)),
    approval_actions: grouped.get(row.id) || [],
  })));
  const detailedMap = new Map(detailedRows.map((row) => [row.id, row]));
  const attach = (row) => detailedMap.get(row.id) || row;

  return normalizeCenterPayload({
    ...payload,
    inbox: (payload.inbox || []).map(attach),
    requests: (payload.requests || []).map(attach),
  });
}

async function readEffectiveFlow(supabase, request) {
  const snapshot = snapshotFlow(request);
  if (snapshot.length) return snapshot;
  const { data: master, error } = await supabase
    .from(APPROVAL_MASTERS_TABLE)
    .select("flow_schema")
    .eq("id", request.master_id)
    .maybeSingle();
  if (error) throw new Error(error.message || "Gagal membaca master approval");
  return flowSteps(master?.flow_schema || []);
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
    const effectiveFlow = await readEffectiveFlow(supabase, request);
    const activeStep = currentStep(effectiveFlow, request.current_step);
    const next = nextStep(effectiveFlow, request.current_step);
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

  let updateQuery = supabase
    .from(APPROVAL_REQUESTS_TABLE)
    .update(updatePayload)
    .eq("id", request.id)
    .eq("updated_at", request.updated_at);
  if (request.current_step == null) updateQuery = updateQuery.is("current_step", null);
  else updateQuery = updateQuery.eq("current_step", request.current_step);
  const { data: updatedRows, error } = await updateQuery.select("*");
  if (error) throw new Error(error.message || "Gagal memproses pengajuan");
  const updatedRequest = updatedRows?.[0];
  if (!updatedRequest) throw new Error("Pengajuan sudah diproses oleh pengguna lain. Muat ulang data.");

  const { error: actionError } = await supabase.from(APPROVAL_ACTIONS_TABLE).insert({
    request_id: request.id,
    step: request.current_step || 0,
    role,
    actor: role,
    action: actionName,
    note: clean(note),
  });
  if (actionError) throw new Error(actionError.message || "Gagal menyimpan riwayat approval");

  const actionVerb = isReject ? "Reject" : updatedRequest.status === "completed" ? "Complete" : "Approve";
  await recordAdminActivity(req, {
    type: isReject ? "reject" : "approve",
    module: "approval-center",
    severity: isReject ? "warning" : "success",
    message: `${actionVerb} approval ${request.request_no}`,
    metadata: { access_role: role, request_no: request.request_no, next_status: updatedRequest.status, master_revision: request.form_data?.__system?.master_revision || 1 },
  });

  const notification = terminal(updatedRequest.status)
    ? await notifyRequesterFinal({ request: updatedRequest, status: updatedRequest.status, note: clean(note) })
    : await notifyRoleNextStep({ request: updatedRequest, previousRole: role, nextRole });

  return { ok: true, whatsapp_sent: notification.sent, whatsapp_status: notification };
}

export async function GET(req) {
  try {
    if (!(await isAdmin(req))) return unauthorized();
    const session = await getCurrentAdminSession(req);
    const { searchParams } = new URL(req.url);
    const payload = await getApprovalCenterOverview({
      accessRole: session?.access_role || "admin",
      offset: searchParams.get("offset"),
      limit: searchParams.get("limit"),
      filter: searchParams.get("filter"),
      search: searchParams.get("q") || searchParams.get("search"),
    });
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
    return NextResponse.json(await actOnRequest({ req, accessRole: session?.access_role || "admin", id: body.id, action: body.action, note: body.note }));
  } catch (err) {
    const message = err.message || "Gagal memproses approval request";
    const conflict = message.includes("pengguna lain");
    return NextResponse.json({ error: message }, { status: conflict ? 409 : 500 });
  }
}
