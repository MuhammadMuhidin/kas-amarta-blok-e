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

function normalizePhone(value) {
  const digits = clean(value).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

function getBaseUrl() {
  const explicit = clean(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.SITE_URL);
  if (explicit) return explicit.replace(/\/$/, "");
  const vercelUrl = clean(process.env.VERCEL_URL);
  return vercelUrl ? `https://${vercelUrl}` : "";
}

function buildReceiptMessage(request = {}, paymentInstruction = "") {
  const lines = [
    `Assalamu'alaikum ${request.requester_name || "Bapak/Ibu"},`,
    "",
    "Pengajuan Anda berhasil dibuat.",
    "",
    `Nomor Pengajuan: ${request.request_no}`,
    `Jenis Pengajuan: ${request.master_name || "-"}`,
    `Status: ${request.status || "-"}`,
  ];

  if (Number(request.amount || 0) > 0) {
    lines.push(`Nominal: Rp${Number(request.amount || 0).toLocaleString("id-ID")}`);
  }

  if (paymentInstruction) {
    lines.push("", `Instruksi Pembayaran: ${paymentInstruction}`);
  }

  const baseUrl = getBaseUrl();
  if (baseUrl) {
    lines.push("", `Cek status: ${baseUrl}/pengajuan`);
  }

  lines.push("", "Simpan nomor pengajuan ini untuk cek status berikutnya.");
  return lines.join("\n");
}

async function sendWhatsAppReceipt(result = {}) {
  const request = result.request || {};
  const to = normalizePhone(request.requester_phone);
  const sendUrl = clean(process.env.WHATSAPP_SEND_URL || process.env.WA_SEND_URL || process.env.WHATSAPP_API_URL || process.env.WA_API_URL);
  const apiKey = clean(process.env.WHATSAPP_API_KEY || process.env.WA_API_KEY || process.env.WHATSAPP_API_TOKEN || process.env.WA_API_TOKEN);
  const sessionId = clean(process.env.WHATSAPP_SESSION_ID || process.env.WA_SESSION_ID);

  if (!to) return { sent: false, reason: "missing_phone" };
  if (!sendUrl) return { sent: false, reason: "missing_send_url" };

  const message = buildReceiptMessage(request, result.payment_instruction);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(sendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}`, "x-api-key": apiKey } : {}),
      },
      body: JSON.stringify({
        sessionId,
        session_id: sessionId,
        to,
        phone: to,
        number: to,
        message,
        text: message,
      }),
      signal: controller.signal,
    });

    if (!response.ok) return { sent: false, reason: `http_${response.status}` };
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err.name === "AbortError" ? "timeout" : "send_failed" };
  } finally {
    clearTimeout(timeout);
  }
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
    const result = await submitApprovalRequest(body);
    const whatsapp = await sendWhatsAppReceipt(result);
    return NextResponse.json({ ...result, whatsapp_sent: whatsapp.sent, whatsapp_status: whatsapp });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal membuat approval request" }, { status: 500 });
  }
}
