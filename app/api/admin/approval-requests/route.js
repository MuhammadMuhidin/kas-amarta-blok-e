import { NextResponse } from "next/server";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { getCurrentAdminSession } from "@/lib/adminSession";
import { getApprovalCenterOverview } from "@/features/approval/approvalService";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { dbTable } from "@/lib/dbTable";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APPROVAL_REQUESTS_TABLE = dbTable("approval_requests");
const APPROVAL_ACTIONS_TABLE = dbTable("approval_actions");
const DONE = ["completed", "rejected", "cancelled"];

function clean(value) {
  return String(value || "").trim();
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
  if (DONE.includes(request.status)) throw new Error("Pengajuan sudah selesai");
  if (role !== "admin" && request.current_approver_role !== role) throw new Error("Pengajuan ini belum masuk ke role kamu");

  const now = new Date().toISOString();
  const isReject = selectedAction === "reject";
  const updatePayload = isReject
    ? { status: "rejected", current_step: null, current_approver_role: null, updated_at: now }
    : { status: "completed", current_step: null, current_approver_role: null, updated_at: now, completed_at: now };

  if (!isReject && (request.status === "waiting_payment_validation" || selectedAction === "validate_payment")) {
    updatePayload.payment_status = "paid";
  }

  const { error } = await supabase
    .from(APPROVAL_REQUESTS_TABLE)
    .update(updatePayload)
    .eq("id", request.id);

  if (error) throw new Error(error.message || "Gagal memproses pengajuan");

  await supabase.from(APPROVAL_ACTIONS_TABLE).insert({
    request_id: request.id,
    step: request.current_step || 0,
    role,
    actor: role,
    action: isReject ? "reject" : (selectedAction === "validate_payment" ? "validate_payment" : "approve"),
    note: clean(note),
  });

  return { ok: true };
}

export async function GET(req) {
  try {
    if (!(await isAdmin(req))) return unauthorized();
    const session = await getCurrentAdminSession(req);
    return NextResponse.json(await getApprovalCenterOverview({ accessRole: session?.access_role || "admin" }));
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
    return NextResponse.json(await actOnRequest({
      accessRole: session?.access_role || "admin",
      id: body.id,
      action: body.action,
      note: body.note,
    }));
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal memproses approval request" }, { status: 500 });
  }
}
