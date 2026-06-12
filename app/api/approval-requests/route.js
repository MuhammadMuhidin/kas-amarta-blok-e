import { NextResponse } from "next/server";
import { getApprovalMasters, submitApprovalRequest } from "@/features/approval/approvalService";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { dbTable } from "@/lib/dbTable";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APPROVAL_REQUESTS_TABLE = dbTable("approval_requests");
const APPROVAL_ACTIONS_TABLE = dbTable("approval_actions");

function clean(value) {
  return String(value || "").trim();
}

function publicRequest(row = {}) {
  return {
    id: row.id,
    request_no: row.request_no,
    master_name: row.master_name,
    master_code: row.master_code,
    status: row.status,
    current_step: row.current_step,
    current_approver_role: row.current_approver_role,
    amount: row.amount,
    payment_status: row.payment_status,
    submitted_at: row.submitted_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at,
    requester_name: row.requester_name,
    requester_house: row.requester_house,
  };
}

function publicAction(row = {}) {
  return {
    id: row.id,
    step: row.step,
    role: row.role,
    actor: row.actor,
    action: row.action,
    note: row.note,
    created_at: row.created_at,
  };
}

async function checkStatusByRequestNo(requestNo) {
  const supabase = getSupabaseAdmin();
  const no = clean(requestNo).toUpperCase();

  if (!no) throw new Error("Nomor pengajuan wajib diisi");

  const { data: request, error } = await supabase
    .from(APPROVAL_REQUESTS_TABLE)
    .select("*")
    .eq("request_no", no)
    .maybeSingle();

  if (error) throw new Error(error.message || "Gagal cek status pengajuan");
  if (!request) throw new Error("Pengajuan tidak ditemukan");

  const { data: actions, error: actionsError } = await supabase
    .from(APPROVAL_ACTIONS_TABLE)
    .select("*")
    .eq("request_id", request.id)
    .order("created_at", { ascending: true });

  if (actionsError) throw new Error(actionsError.message || "Gagal membaca riwayat pengajuan");

  return { ok: true, request: publicRequest(request), actions: (actions || []).map(publicAction) };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const requestNo = searchParams.get("request_no");

    if (requestNo) {
      return NextResponse.json(await checkStatusByRequestNo(requestNo));
    }

    const masters = await getApprovalMasters({ activeOnly: true });
    return NextResponse.json({ ok: true, masters });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal membaca approval requests" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    return NextResponse.json(await submitApprovalRequest(body));
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal membuat approval request" }, { status: 500 });
  }
}
