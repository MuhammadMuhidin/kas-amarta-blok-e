import { dbTable } from "@/lib/dbTable";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizePhoneToWaChatId, sendWaMessage } from "@/lib/waClient";

const ROLE_CONTACTS_TABLE = dbTable("role_contacts");

function clean(value) {
  return String(value || "").trim();
}

function normalizeRole(value) {
  return clean(value).toLowerCase();
}

function getBaseUrl() {
  const explicit = clean(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.SITE_URL);
  if (explicit) return explicit.replace(/\/$/, "");
  const vercelUrl = clean(process.env.VERCEL_URL);
  return vercelUrl ? `https://${vercelUrl}` : "";
}

function money(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? `Rp${amount.toLocaleString("id-ID")}` : "-";
}

function statusLabel(status) {
  const value = normalizeRole(status);
  if (value === "completed") return "Full Approved";
  if (value === "rejected") return "Rejected";
  if (value === "cancelled") return "Cancelled";
  if (value === "waiting_payment_validation") return "Waiting for Validation";
  if (value === "waiting_approval") return "In Progress";
  return clean(status) || "-";
}

function requestLines(request = {}) {
  const lines = [
    `Nomor Pengajuan: ${request.request_no || "-"}`,
    `Jenis Pengajuan: ${request.master_name || "-"}`,
    `Pemohon: ${request.requester_name || "-"}`,
    `Rumah: ${request.requester_house || "-"}`,
  ];
  if (Number(request.amount || 0) > 0) lines.push(`Nominal: ${money(request.amount)}`);
  return lines;
}

function statusUrlLine() {
  const baseUrl = getBaseUrl();
  return baseUrl ? `Cek status: ${baseUrl}/pengajuan` : "";
}

async function readRoleContact(role) {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return null;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from(ROLE_CONTACTS_TABLE)
      .select("role,display_name,name,phone,active")
      .eq("role", normalizedRole)
      .maybeSingle();
    if (error || !data || data.active === false || !data.phone) return null;
    return data;
  } catch {
    return null;
  }
}

export async function sendWhatsAppMessage({ to, message, source = "kas-amarta-approval" }) {
  const text = clean(message);
  if (!clean(to)) return { sent: false, reason: "missing_phone" };
  if (!text) return { sent: false, reason: "missing_message" };
  try {
    const chatId = normalizePhoneToWaChatId(to);
    const response = await sendWaMessage({ chatId, text, source });
    return { sent: true, chatId, response };
  } catch (err) {
    return { sent: false, reason: err.message || "send_failed" };
  }
}

export async function sendRoleWhatsApp({ role, message, source = "kas-amarta-approval-role" }) {
  const contact = await readRoleContact(role);
  if (!contact) return { sent: false, reason: "role_contact_not_ready", role: normalizeRole(role) };
  const result = await sendWhatsAppMessage({ to: contact.phone, message, source });
  return { ...result, role: normalizeRole(role) };
}

export async function notifyRequesterCreated(result = {}) {
  const request = result.request || {};
  const lines = [
    `Assalamu'alaikum ${request.requester_name || "Bapak/Ibu"},`,
    "",
    "Pengajuan Anda berhasil dibuat.",
    "",
    ...requestLines(request),
    `Status: ${statusLabel(request.status)}`,
  ];
  if (result.payment_instruction) lines.push("", `Instruksi Pembayaran: ${result.payment_instruction}`);
  const statusUrl = statusUrlLine();
  if (statusUrl) lines.push("", statusUrl);
  lines.push("", "Simpan nomor pengajuan ini untuk cek status berikutnya.");
  return sendWhatsAppMessage({ to: request.requester_phone, message: lines.join("\n"), source: "kas-amarta-approval-created" });
}

export async function notifyRoleNewRequest({ request }) {
  if (!request?.current_approver_role) return { sent: false, reason: "missing_current_approver" };
  const lines = [
    "Ada pengajuan baru yang perlu Anda cek.",
    "",
    ...requestLines(request),
    `Status: ${statusLabel(request.status)}`,
    "",
    "Silakan buka Approval Center untuk approve atau reject pengajuan ini.",
  ];
  return sendRoleWhatsApp({ role: request.current_approver_role, message: lines.join("\n"), source: "kas-amarta-approval-new" });
}

export async function notifyRoleNextStep({ request, previousRole, nextRole }) {
  if (!nextRole) return { sent: false, reason: "missing_next_role" };
  const lines = [
    `Pengajuan sudah disetujui oleh ${previousRole || "step sebelumnya"}.`,
    "",
    ...requestLines(request),
    `Status: ${statusLabel(request.status)}`,
    "",
    "Sekarang pengajuan menunggu pengecekan dan keputusan Anda.",
    "Silakan buka Approval Center untuk approve atau reject pengajuan ini.",
  ];
  return sendRoleWhatsApp({ role: nextRole, message: lines.join("\n"), source: "kas-amarta-approval-next" });
}

export async function notifyRequesterFinal({ request, status, note }) {
  const finalStatus = normalizeRole(status || request?.status);
  const isApproved = finalStatus === "completed";
  const isRejected = finalStatus === "rejected";
  const title = isApproved ? "Pengajuan Anda sudah Full Approved." : isRejected ? "Pengajuan Anda ditolak." : "Pengajuan Anda sudah selesai diproses.";
  const lines = [
    `Assalamu'alaikum ${request?.requester_name || "Bapak/Ibu"},`,
    "",
    title,
    "",
    ...requestLines(request),
    `Status Akhir: ${statusLabel(finalStatus)}`,
  ];
  if (note && (isRejected || finalStatus === "cancelled")) lines.push("", `Alasan/Catatan: ${note}`);
  const statusUrl = statusUrlLine();
  if (statusUrl) lines.push("", statusUrl);
  return sendWhatsAppMessage({ to: request?.requester_phone, message: lines.join("\n"), source: "kas-amarta-approval-final" });
}
