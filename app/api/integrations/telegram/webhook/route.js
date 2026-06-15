import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { processApprovalAction } from "@/features/approval/approvalActionService";
import { approvePaymentProof, rejectPaymentProof } from "@/features/paymentProof/paymentProofService";
import { recordSystemActivity } from "@/lib/adminActivity";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { queuePaymentProofDecisionNotification } from "@/lib/notificationQueue";
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
const html = (value) => clean(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const buttons = (...rows) => ({ inline_keyboard: rows });
const approvalActions = (id) => buttons([{ text: "Approve", callback_data: `aa:${id}` }, { text: "Reject", callback_data: `ar:${id}` }]);
const paymentActions = (id) => buttons([{ text: "Approve Bukti", callback_data: `pa:${id}` }, { text: "Reject Bukti", callback_data: `pr:${id}` }]);
const approvalConfirm = (id) => buttons([{ text: "Konfirmasi Approve", callback_data: `aac:${id}` }, { text: "Batal", callback_data: `ax:${id}` }]);
const paymentConfirm = (id) => buttons([{ text: "Konfirmasi Approve", callback_data: `pac:${id}` }, { text: "Batal", callback_data: `px:${id}` }]);
const approvalRejectReasons = (id) => buttons(
  [{ text: "Dokumen tidak lengkap", callback_data: `arr:doc:${id}` }],
  [{ text: "Data tidak sesuai", callback_data: `arr:data:${id}` }],
  [{ text: "Belum memenuhi ketentuan", callback_data: `arr:rule:${id}` }],
  [{ text: "Batal", callback_data: `ax:${id}` }],
);
const paymentRejectReasons = (id) => buttons(
  [{ text: "Nominal tidak sesuai", callback_data: `prr:amount:${id}` }],
  [{ text: "Bukti tidak jelas/valid", callback_data: `prr:proof:${id}` }],
  [{ text: "Data pembayaran tidak sesuai", callback_data: `prr:data:${id}` }],
  [{ text: "Batal", callback_data: `px:${id}` }],
);
const approvalRejectConfirm = (id, code) => buttons([{ text: `Tolak: ${APPROVAL_REASONS[code]}`, callback_data: `arc:${code}:${id}` }, { text: "Batal", callback_data: `ax:${id}` }]);
const paymentRejectConfirm = (id, code) => buttons([{ text: `Tolak: ${PAYMENT_REASONS[code]}`, callback_data: `prc:${code}:${id}` }, { text: "Batal", callback_data: `px:${id}` }]);

function sameSecret(received, expected) {
  const left = Buffer.from(clean(received));
  const right = Buffer.from(clean(expected));
  return Boolean(left.length && left.length === right.length && timingSafeEqual(left, right));
}

async function safeAnswer(callbackId, options) {
  try { await answerTelegramCallback(callbackId, options); }
  catch (error) { console.error("Failed answering Telegram callback", error); }
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

async function editSuccess(message, summary) {
  try {
    const original = clean(message.caption || message.text || "Notifikasi Telegram");
    const content = `${html(original)}\n\n<b>${html(summary)}</b>`;
    const common = {
      chatId: message.chat.id,
      messageId: message.message_id,
      replyMarkup: { inline_keyboard: [] },
    };

    if (Array.isArray(message.photo) && message.photo.length > 0) {
      await editTelegramCaption({ ...common, caption: content });
    } else {
      await editTelegramText({ ...common, text: content });
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
    await safeAnswer(callbackId, { text: "Callback Telegram tidak lengkap.", showAlert: true });
    return;
  }
  if (!isTelegramChatAllowed(message.chat.id)) {
    await auditDenied(actor, data, "chat_not_allowed");
    await safeAnswer(callbackId, { text: "Chat ini tidak diizinkan.", showAlert: true });
    return;
  }
  if (!actor) {
    await auditDenied(null, data, "user_not_authorized");
    await safeAnswer(callbackId, { text: "Akun Telegram Anda belum memiliki akses.", showAlert: true });
    return;
  }
  if (!(await isTelegramActionsEnabled().catch(() => false))) {
    await auditDenied(actor, data, "actions_disabled");
    await safeAnswer(callbackId, { text: "Telegram Approval Actions sedang dinonaktifkan.", showAlert: true });
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
    await editTelegramReplyMarkup({ chatId: message.chat.id, messageId: message.message_id, replyMarkup: approvalConfirm(id) });
    await safeAnswer(callbackId, { text: "Konfirmasi sebelum approve." });
    return;
  }
  if (command === "ar") {
    await editTelegramReplyMarkup({ chatId: message.chat.id, messageId: message.message_id, replyMarkup: approvalRejectReasons(id) });
    await safeAnswer(callbackId, { text: "Pilih alasan penolakan." });
    return;
  }
  if (command === "arr") {
    const code = clean(parts[1]);
    if (!APPROVAL_REASONS[code]) throw new Error("Alasan penolakan tidak valid");
    await editTelegramReplyMarkup({ chatId: message.chat.id, messageId: message.message_id, replyMarkup: approvalRejectConfirm(id, code) });
    await safeAnswer(callbackId, { text: "Konfirmasi penolakan." });
    return;
  }
  if (command === "ax") {
    await editTelegramReplyMarkup({ chatId: message.chat.id, messageId: message.message_id, replyMarkup: approvalActions(id) });
    await safeAnswer(callbackId, { text: "Tindakan dibatalkan." });
    return;
  }

  if (["pa", "pr", "prr", "pac", "prc"].includes(command) && !isPaymentProofTelegramRoleAllowed(actor.role)) {
    await auditDenied(actor, data, "payment_role_not_allowed");
    await safeAnswer(callbackId, { text: "Role Anda tidak diizinkan memverifikasi pembayaran.", showAlert: true });
    return;
  }
  if (command === "pa") {
    await editTelegramReplyMarkup({ chatId: message.chat.id, messageId: message.message_id, replyMarkup: paymentConfirm(id) });
    await safeAnswer(callbackId, { text: "Konfirmasi sebelum approve bukti." });
    return;
  }
  if (command === "pr") {
    await editTelegramReplyMarkup({ chatId: message.chat.id, messageId: message.message_id, replyMarkup: paymentRejectReasons(id) });
    await safeAnswer(callbackId, { text: "Pilih alasan penolakan." });
    return;
  }
  if (command === "prr") {
    const code = clean(parts[1]);
    if (!PAYMENT_REASONS[code]) throw new Error("Alasan penolakan tidak valid");
    await editTelegramReplyMarkup({ chatId: message.chat.id, messageId: message.message_id, replyMarkup: paymentRejectConfirm(id, code) });
    await safeAnswer(callbackId, { text: "Konfirmasi penolakan bukti." });
    return;
  }
  if (command === "px") {
    await editTelegramReplyMarkup({ chatId: message.chat.id, messageId: message.message_id, replyMarkup: paymentActions(id) });
    await safeAnswer(callbackId, { text: "Tindakan dibatalkan." });
    return;
  }

  await safeAnswer(callbackId, { text: "Sedang memproses..." });

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
      actorMetadata: { telegram_user_id: actor.telegramUserId, telegram_username: actor.username },
    });
    await editSuccess(message, `${result.request.status === "rejected" ? "Ditolak" : "Berhasil diproses"} oleh ${actor.displayName} (${actor.role}). Status: ${result.request.status}.`);
    return;
  }

  if (command === "pac" || command === "prc") {
    const code = command === "prc" ? clean(parts[1]) : "";
    const reason = command === "prc" ? PAYMENT_REASONS[code] : "";
    if (command === "prc" && !reason) throw new Error("Alasan penolakan tidak valid");

    const supabase = getSupabaseAdmin();
    const actorMetadata = { telegram_user_id: actor.telegramUserId, telegram_username: actor.username };
    const result = command === "prc"
      ? await rejectPaymentProof({ supabase, req, id, reason, actor: actor.displayName, actorRole: actor.role, source: "telegram", actorMetadata })
      : await approvePaymentProof({ supabase, req, id, actor: actor.displayName, actorRole: actor.role, source: "telegram", actorMetadata });
    if (result.status >= 400) throw new Error(result.body?.error || "Gagal memproses bukti pembayaran");

    await recordSystemActivity({
      type: command === "prc" ? "reject" : "approve",
      module: "telegram-payment-proof",
      severity: command === "prc" ? "warning" : "success",
      actor: actor.displayName,
      message: `${command === "prc" ? "Reject" : "Approve"} payment proof ${result.body.proof?.person_house || id} via Telegram`,
      metadata: { source: "telegram", role: actor.role, telegram_user_id: actor.telegramUserId, telegram_username: actor.username, proof_id: id, reason },
    });
    await queuePaymentProofDecisionNotification({ proof: result.body.proof, action: command === "prc" ? "reject" : "approve", actorName: actor.displayName, actorRole: actor.role, reason, source: "telegram" });
    await editSuccess(message, `Bukti pembayaran ${result.body.proof?.status === "rejected" ? "ditolak" : "disetujui"} oleh ${actor.displayName} (${actor.role}).`);
    return;
  }

  await safeAnswer(callbackId, { text: "Tindakan tidak dikenali.", showAlert: true });
}

export async function POST(req) {
  const config = getTelegramRuntimeConfig();
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
