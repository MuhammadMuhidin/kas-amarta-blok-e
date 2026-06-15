import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { processApprovalAction } from "@/features/approval/approvalActionService";
import { approvePaymentProof, rejectPaymentProof } from "@/features/paymentProof/paymentProofService";
import { recordSystemActivity } from "@/lib/adminActivity";
import { formatJakartaDateTime } from "@/lib/localDate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  answerTelegramCallback,
  editTelegramCaption,
  editTelegramReplyMarkup,
  editTelegramText,
  getTelegramRuntimeConfig,
  isPaymentProofTelegramRoleAllowed,
  isTelegramChatAllowed,
  resolveTelegramActor,
} from "@/lib/telegramClient";
import { isTelegramActionsEnabled } from "@/lib/webauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];
const STATUS_LABELS = {
  draft: "Draf",
  submitted: "Diajukan",
  waiting_approval: "Menunggu Persetujuan",
  waiting_payment_validation: "Menunggu Validasi Pembayaran",
  processing: "Sedang Diproses",
  completed: "Selesai",
  approved: "Disetujui",
  rejected: "Ditolak",
  cancelled: "Dibatalkan",
  pending: "Menunggu Verifikasi",
};
const ROLE_LABELS = {
  admin: "Administrator",
  ketua: "Ketua",
  sekretaris: "Sekretaris",
  bendahara: "Bendahara",
  warga: "Warga",
};
const APPROVAL_REASONS = {
  doc: "Dokumen tidak lengkap",
  data: "Data pengajuan tidak sesuai",
  rule: "Pengajuan belum memenuhi ketentuan",
};
const PAYMENT_REASONS = {
  amount: "Nominal pembayaran tidak sesuai",
  proof: "Bukti pembayaran tidak jelas atau tidak valid",
  data: "Data pembayaran tidak sesuai",
};

const clean = (value) => String(value || "").trim();
const html = (value) => clean(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");
const rupiah = (value) => `Rp${Number(value || 0).toLocaleString("id-ID")}`;
const time = (value) => value ? `${formatJakartaDateTime(value, "id-ID")} WIB` : "-";
const buttons = (...rows) => ({ inline_keyboard: rows });
const approvalActions = (id) => buttons([
  { text: "Setujui", callback_data: `aa:${id}` },
  { text: "Tolak", callback_data: `ar:${id}` },
]);
const paymentActions = (id) => buttons([
  { text: "Setujui Bukti", callback_data: `pa:${id}` },
  { text: "Tolak Bukti", callback_data: `pr:${id}` },
]);
const approvalConfirm = (id) => buttons([
  { text: "Konfirmasi Persetujuan", callback_data: `aac:${id}` },
  { text: "Batal", callback_data: `ax:${id}` },
]);
const paymentConfirm = (id) => buttons([
  { text: "Konfirmasi Persetujuan", callback_data: `pac:${id}` },
  { text: "Batal", callback_data: `px:${id}` },
]);
const approvalRejectReasons = (id) => buttons(
  [{ text: "Dokumen tidak lengkap", callback_data: `arr:doc:${id}` }],
  [{ text: "Data tidak sesuai", callback_data: `arr:data:${id}` }],
  [{ text: "Belum memenuhi ketentuan", callback_data: `arr:rule:${id}` }],
  [{ text: "Batal", callback_data: `ax:${id}` }],
);
const paymentRejectReasons = (id) => buttons(
  [{ text: "Nominal tidak sesuai", callback_data: `prr:amount:${id}` }],
  [{ text: "Bukti tidak jelas", callback_data: `prr:proof:${id}` }],
  [{ text: "Data pembayaran tidak sesuai", callback_data: `prr:data:${id}` }],
  [{ text: "Batal", callback_data: `px:${id}` }],
);
const approvalRejectConfirm = (id, code) => buttons([
  { text: "Konfirmasi Penolakan", callback_data: `arc:${code}:${id}` },
  { text: "Batal", callback_data: `ax:${id}` },
]);
const paymentRejectConfirm = (id, code) => buttons([
  { text: "Konfirmasi Penolakan", callback_data: `prc:${code}:${id}` },
  { text: "Batal", callback_data: `px:${id}` },
]);

function statusLabel(value) {
  const normalized = clean(value).toLowerCase();
  return STATUS_LABELS[normalized] || clean(value) || "-";
}

function roleLabel(value) {
  const normalized = clean(value).toLowerCase();
  if (!normalized) return "-";
  if (ROLE_LABELS[normalized]) return ROLE_LABELS[normalized];
  return normalized.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function actorLabel(name, role) {
  const actorName = clean(name);
  const actorRole = roleLabel(role);
  if (!actorName) return actorRole;
  if (!clean(role) || actorName.toLowerCase() === clean(role).toLowerCase()) return actorName;
  return `${actorName} (${actorRole})`;
}

function periodLabel(value) {
  const normalized = clean(value);
  const match = /^(\d{4})-(\d{2})$/.exec(normalized);
  if (!match) return normalized || "-";
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex >= MONTH_NAMES.length) return normalized;
  return `${MONTH_NAMES[monthIndex]} ${match[1]}`;
}

function sameSecret(received, expected) {
  const left = Buffer.from(clean(received));
  const right = Buffer.from(clean(expected));
  return Boolean(left.length && left.length === right.length && timingSafeEqual(left, right));
}

function approvalFinalText(request, { actorName, actorRole, note }) {
  const rejected = clean(request?.status).toLowerCase() === "rejected";
  const completed = clean(request?.status).toLowerCase() === "completed";
  const title = rejected ? "Pengajuan Ditolak" : completed ? "Pengajuan Selesai" : "Pengajuan Diproses";

  return [
    `<b>${title}</b>`,
    "",
    `<b>Nomor:</b> ${html(request?.request_no || "-")}`,
    `<b>Jenis:</b> ${html(request?.master_name || "-")}`,
    `<b>Pemohon:</b> ${html(request?.requester_name || "-")}`,
    `<b>Rumah:</b> ${html(request?.requester_house || "-")}`,
    !rejected ? "<b>Keputusan:</b> Disetujui" : "",
    `<b>Status:</b> ${html(statusLabel(request?.status))}`,
    request?.current_approver_role
      ? `<b>Tahap Berikutnya:</b> ${html(roleLabel(request.current_approver_role))}`
      : "",
    note ? `<b>Alasan:</b> ${html(note)}` : "",
    `<b>Diproses oleh:</b> ${html(actorLabel(actorName, actorRole))}`,
    `<b>Diproses:</b> ${html(time(request?.completed_at || request?.updated_at))}`,
    "<b>Sumber:</b> Telegram",
  ].filter(Boolean).join("\n");
}

function paymentFinalText(proof, { rejected, actorName, actorRole, reason }) {
  const totalAmount = Number(proof?.amount || 0) + Number(proof?.trash_amount || 0);
  return [
    `<b>Bukti Pembayaran ${rejected ? "Ditolak" : "Disetujui"}</b>`,
    "",
    `<b>Rumah:</b> ${html(proof?.person_house || "-")}`,
    `<b>Nama:</b> ${html(proof?.person_name || "-")}`,
    `<b>Periode:</b> ${html(periodLabel(proof?.period))}`,
    `<b>Kas:</b> ${html(rupiah(proof?.amount))}`,
    `<b>Sampah:</b> ${Number(proof?.trash_amount || 0) ? html(rupiah(proof.trash_amount)) : "-"}`,
    `<b>Total:</b> ${html(rupiah(totalAmount))}`,
    `<b>Status:</b> ${rejected ? "Ditolak" : "Disetujui"}`,
    reason ? `<b>Alasan:</b> ${html(reason)}` : "",
    `<b>Diproses oleh:</b> ${html(actorLabel(actorName, actorRole))}`,
    `<b>Diproses:</b> ${html(time(proof?.reviewed_at || proof?.updated_at))}`,
    "<b>Sumber:</b> Telegram",
  ].filter(Boolean).join("\n");
}

async function safeAnswer(callbackId, options) {
  try {
    await answerTelegramCallback(callbackId, options);
  } catch (error) {
    console.error("Failed answering Telegram callback", error);
  }
}

async function auditDenied(actor, callbackData, reason) {
  try {
    await recordSystemActivity({
      type: "security",
      module: "telegram-integration",
      severity: "warning",
      message: `Telegram action denied: ${reason}`,
      actor: actor?.displayName || "unknown-telegram-user",
      metadata: {
        source: "telegram",
        telegram_user_id: actor?.telegramUserId || "",
        telegram_username: actor?.username || "",
        callback_data: clean(callbackData).slice(0, 120),
        reason,
      },
    });
  } catch (error) {
    console.error("Failed recording denied Telegram action", error);
  }
}

async function editFinalMessage(message, text) {
  try {
    const common = {
      chatId: message.chat.id,
      messageId: message.message_id,
      replyMarkup: { inline_keyboard: [] },
    };
    const usesCaption = Boolean(
      clean(message.caption)
      || (Array.isArray(message.photo) && message.photo.length > 0)
      || message.document,
    );

    if (usesCaption) {
      await editTelegramCaption({ ...common, caption: text });
    } else {
      await editTelegramText({ ...common, text });
    }
  } catch (error) {
    console.error("Business action succeeded but Telegram message update failed", error);
  }
}

async function handleCallback(req, callback) {
  const callbackId = clean(callback?.id);
  const data = clean(callback?.data);
  const message = callback?.message;
  const actor = await resolveTelegramActor(callback?.from);

  if (!message?.chat?.id || !message?.message_id || !data) {
    await safeAnswer(callbackId, { text: "Data tindakan Telegram tidak lengkap.", showAlert: true });
    return;
  }
  if (!(await isTelegramChatAllowed(message.chat.id))) {
    await auditDenied(actor, data, "chat_not_allowed");
    await safeAnswer(callbackId, { text: "Grup Telegram ini tidak diizinkan.", showAlert: true });
    return;
  }
  if (!actor) {
    await auditDenied(null, data, "user_not_authorized");
    await safeAnswer(callbackId, { text: "Akun Telegram Anda belum memiliki akses.", showAlert: true });
    return;
  }
  if (!(await isTelegramActionsEnabled().catch(() => false))) {
    await auditDenied(actor, data, "actions_disabled");
    await safeAnswer(callbackId, {
      text: "Tindakan persetujuan melalui Telegram sedang dinonaktifkan.",
      showAlert: true,
    });
    return;
  }

  const parts = data.split(":");
  const command = parts[0];
  const id = clean(parts.at(-1));
  if (!id) {
    await safeAnswer(callbackId, { text: "Referensi tindakan tidak valid.", showAlert: true });
    return;
  }

  if (command === "aa") {
    await editTelegramReplyMarkup({
      chatId: message.chat.id,
      messageId: message.message_id,
      replyMarkup: approvalConfirm(id),
    });
    await safeAnswer(callbackId, { text: "Silakan konfirmasi persetujuan." });
    return;
  }
  if (command === "ar") {
    await editTelegramReplyMarkup({
      chatId: message.chat.id,
      messageId: message.message_id,
      replyMarkup: approvalRejectReasons(id),
    });
    await safeAnswer(callbackId, { text: "Silakan pilih alasan penolakan." });
    return;
  }
  if (command === "arr") {
    const code = clean(parts[1]);
    const reason = APPROVAL_REASONS[code];
    if (!reason) throw new Error("Alasan penolakan tidak valid");
    await editTelegramReplyMarkup({
      chatId: message.chat.id,
      messageId: message.message_id,
      replyMarkup: approvalRejectConfirm(id, code),
    });
    await safeAnswer(callbackId, { text: `Alasan dipilih: ${reason}. Silakan konfirmasi penolakan.` });
    return;
  }
  if (command === "ax") {
    await editTelegramReplyMarkup({
      chatId: message.chat.id,
      messageId: message.message_id,
      replyMarkup: approvalActions(id),
    });
    await safeAnswer(callbackId, { text: "Tindakan dibatalkan." });
    return;
  }

  if (["pa", "pr", "prr", "pac", "prc"].includes(command)
    && !isPaymentProofTelegramRoleAllowed(actor.role)) {
    await auditDenied(actor, data, "payment_role_not_allowed");
    await safeAnswer(callbackId, {
      text: "Peran Anda tidak memiliki izin untuk memproses bukti pembayaran.",
      showAlert: true,
    });
    return;
  }
  if (command === "pa") {
    await editTelegramReplyMarkup({
      chatId: message.chat.id,
      messageId: message.message_id,
      replyMarkup: paymentConfirm(id),
    });
    await safeAnswer(callbackId, { text: "Silakan konfirmasi persetujuan." });
    return;
  }
  if (command === "pr") {
    await editTelegramReplyMarkup({
      chatId: message.chat.id,
      messageId: message.message_id,
      replyMarkup: paymentRejectReasons(id),
    });
    await safeAnswer(callbackId, { text: "Silakan pilih alasan penolakan." });
    return;
  }
  if (command === "prr") {
    const code = clean(parts[1]);
    const reason = PAYMENT_REASONS[code];
    if (!reason) throw new Error("Alasan penolakan tidak valid");
    await editTelegramReplyMarkup({
      chatId: message.chat.id,
      messageId: message.message_id,
      replyMarkup: paymentRejectConfirm(id, code),
    });
    await safeAnswer(callbackId, { text: `Alasan dipilih: ${reason}. Silakan konfirmasi penolakan.` });
    return;
  }
  if (command === "px") {
    await editTelegramReplyMarkup({
      chatId: message.chat.id,
      messageId: message.message_id,
      replyMarkup: paymentActions(id),
    });
    await safeAnswer(callbackId, { text: "Tindakan dibatalkan." });
    return;
  }

  await safeAnswer(callbackId, { text: "Permintaan sedang diproses." });

  if (command === "aac" || command === "arc") {
    const code = command === "arc" ? clean(parts[1]) : "";
    const note = command === "arc" ? APPROVAL_REASONS[code] : "";
    if (command === "arc" && !note) throw new Error("Alasan penolakan tidak valid");

    const result = await processApprovalAction({
      req,
      accessRole: actor.role,
      id,
      action: command === "arc" ? "reject" : "approve",
      note,
      actor: actor.displayName,
      source: "telegram",
      actorMetadata: {
        telegram_user_id: actor.telegramUserId,
        telegram_username: actor.username,
      },
    });
    await editFinalMessage(message, approvalFinalText(result.request, {
      actorName: actor.displayName,
      actorRole: actor.role,
      note,
    }));
    return;
  }

  if (command === "pac" || command === "prc") {
    const code = command === "prc" ? clean(parts[1]) : "";
    const reason = command === "prc" ? PAYMENT_REASONS[code] : "";
    if (command === "prc" && !reason) throw new Error("Alasan penolakan tidak valid");

    const supabase = getSupabaseAdmin();
    const actorMetadata = {
      telegram_user_id: actor.telegramUserId,
      telegram_username: actor.username,
    };
    const result = command === "prc"
      ? await rejectPaymentProof({
          supabase,
          req,
          id,
          reason,
          actor: actor.displayName,
          actorRole: actor.role,
          source: "telegram",
          actorMetadata,
        })
      : await approvePaymentProof({
          supabase,
          req,
          id,
          actor: actor.displayName,
          actorRole: actor.role,
          source: "telegram",
          actorMetadata,
        });
    if (result.status >= 400) throw new Error(result.body?.error || "Gagal memproses bukti pembayaran");

    await editFinalMessage(message, paymentFinalText(result.body.proof, {
      rejected: command === "prc",
      actorName: actor.displayName,
      actorRole: actor.role,
      reason,
    }));
    return;
  }

  await safeAnswer(callbackId, { text: "Tindakan tidak dikenali.", showAlert: true });
}

export async function POST(req) {
  const config = await getTelegramRuntimeConfig();
  const receivedSecret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!config.webhookSecret || !sameSecret(receivedSecret, config.webhookSecret)) {
    return NextResponse.json({ error: "Unauthorized webhook" }, { status: 401 });
  }

  try {
    const update = await req.json();
    if (update?.callback_query) {
      try {
        await handleCallback(req, update.callback_query);
      } catch (error) {
        console.error("Telegram callback processing failed", error);
        await safeAnswer(update.callback_query.id, {
          text: error instanceof Error ? error.message.slice(0, 180) : "Tindakan gagal diproses.",
          showAlert: true,
        });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook payload failed", error);
    return NextResponse.json({ ok: true });
  }
}
