import { notifyRequesterFinal, notifyRoleNextStep } from "@/lib/approvalWhatsApp";
import { recordAdminActivity } from "@/lib/adminActivity";
import { dbTable } from "@/lib/dbTable";
import { queueApprovalDecisionNotification } from "@/lib/notificationQueue";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

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

export async function processApprovalAction({
  req,
  accessRole,
  id,
  action,
  note,
  actor,
  source = "web",
  actorMetadata = {},
}) {
  const supabase = getSupabaseAdmin();
  const role = clean(accessRole).toLowerCase() || "admin";
  const selectedAction = clean(action) || "approve";
  const actionNote = clean(note);
  const actorName = clean(actor) || role;

  if (selectedAction === "reject" && !actionNote) {
    throw new Error("Alasan penolakan wajib diisi");
  }

  const { data: request, error: readError } = await supabase
    .from(APPROVAL_REQUESTS_TABLE)
    .select("*")
    .eq("id", clean(id))
    .maybeSingle();

  if (readError) throw new Error(readError.message || "Gagal membaca pengajuan");
  if (!request) throw new Error("Pengajuan tidak ditemukan");
  if (terminal(request.status)) throw new Error("Pengajuan sudah selesai");
  if (role !== "admin" && request.current_approver_role !== role) {
    throw new Error("Pengajuan ini belum masuk ke role kamu");
  }

  const now = new Date().toISOString();
  const isReject = selectedAction === "reject";
  let updatePayload;
  let actionName;
  let nextRole = "";

  if (isReject) {
    updatePayload = {
      status: "rejected",
      current_step: null,
      current_approver_role: null,
      updated_at: now,
    };
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

    if (activeStep?.action === "validate_payment" || selectedAction === "validate_payment") {
      updatePayload.payment_status = "paid";
    }
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
  if (!updatedRequest) {
    throw new Error("Pengajuan sudah diproses oleh pengguna lain. Muat ulang data.");
  }

  const { error: actionError } = await supabase.from(APPROVAL_ACTIONS_TABLE).insert({
    request_id: request.id,
    step: request.current_step || 0,
    role,
    actor: actorName,
    action: actionName,
    note: actionNote,
  });

  if (actionError) throw new Error(actionError.message || "Gagal menyimpan riwayat approval");

  const actionVerb = isReject ? "Reject" : updatedRequest.status === "completed" ? "Complete" : "Approve";
  await recordAdminActivity(req, {
    type: isReject ? "reject" : "approve",
    module: "approval-center",
    severity: isReject ? "warning" : "success",
    actor: actorName,
    message: `${actionVerb} approval ${request.request_no}`,
    metadata: {
      access_role: role,
      request_no: request.request_no,
      next_status: updatedRequest.status,
      master_revision: request.form_data?.__system?.master_revision || 1,
      source,
      ...actorMetadata,
    },
  });

  const notification = terminal(updatedRequest.status)
    ? await notifyRequesterFinal({ request: updatedRequest, status: updatedRequest.status, note: actionNote })
    : await notifyRoleNextStep({ request: updatedRequest, previousRole: role, nextRole });

  const telegramQueue = await queueApprovalDecisionNotification({
    request: updatedRequest,
    action: isReject ? "reject" : actionName,
    actorRole: role,
    actorName,
    note: actionNote,
    source,
  });

  return {
    ok: true,
    request: updatedRequest,
    action: actionName,
    next_role: nextRole,
    whatsapp_sent: notification.sent,
    whatsapp_status: notification,
    telegram_queue: telegramQueue,
  };
}
