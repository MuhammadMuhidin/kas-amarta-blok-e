import { getAuthConfigs } from "@/lib/webauth";
import { formatJakartaDateTime } from "@/lib/localDate";
import {
  getIntegrationConfigString,
  getIntegrationConfigValues,
} from "@/lib/integrationConfig";
import { getTelegramAppBaseUrl } from "@/lib/telegramClient";

const HTTP_TIMEOUT_MS = 5000;
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
const SOURCE_LABELS = {
  web: "Aplikasi",
  telegram: "Telegram",
  system: "Sistem",
  admin: "Admin",
};
const ROLE_LABELS = {
  admin: "Administrator",
  ketua: "Ketua",
  sekretaris: "Sekretaris",
  bendahara: "Bendahara",
  warga: "Warga",
};

const clean = (v) => String(v || "").trim();
const escapeHtml = (v) => clean(v)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");
const rupiah = (v) => `Rp${Number(v || 0).toLocaleString("id-ID")}`;
const time = (v) => v ? `${formatJakartaDateTime(v, "id-ID")} WIB` : "-";
const callback = (text, data) => new TextEncoder().encode(data).length <= 64
  ? { text, callback_data: data }
  : null;
const markup = (...rows) => ({
  inline_keyboard: rows.map((r) => r.filter(Boolean)).filter((r) => r.length),
});

function statusLabel(value) {
  const normalized = clean(value).toLowerCase();
  return STATUS_LABELS[normalized] || clean(value) || "-";
}

function sourceLabel(value) {
  const normalized = clean(value).toLowerCase();
  return SOURCE_LABELS[normalized] || clean(value) || "-";
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

async function absoluteMediaUrl(value) {
  const url = clean(value);
  if (!url) return "";
  if (/^https:\/\//i.test(url)) return url;

  const baseUrl = await getTelegramAppBaseUrl();
  if (!baseUrl || !url.startsWith("/")) return "";
  return `${baseUrl}${url}`;
}

async function flags() {
  try {
    const value = await getAuthConfigs();
    return {
      notifications: value.telegramNotificationsEnabled === true,
      actions: value.telegramNotificationsEnabled === true && value.telegramActionsEnabled === true,
    };
  } catch (error) {
    console.error("Telegram settings unavailable", error);
    return { notifications: false, actions: false };
  }
}

function envelope(type, id, text, replyMarkup) {
  return {
    schema_version: 1,
    event_id: `${type}:${id}`,
    type,
    created_at: new Date().toISOString(),
    telegram: {
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    },
  };
}

async function withTelegramDestination(event) {
  const chatId = await getIntegrationConfigString("TELEGRAM_CHAT_ID");
  return {
    ...event,
    telegram: {
      ...(event?.telegram || {}),
      ...(chatId ? { chat_id: chatId } : {}),
      ...(clean(process.env.TELEGRAM_MESSAGE_THREAD_ID)
        ? { message_thread_id: Number(process.env.TELEGRAM_MESSAGE_THREAD_ID) }
        : {}),
    },
  };
}

async function queueHttpConfig() {
  return {
    url: await getIntegrationConfigString("CLOUDFLARE_QUEUE_PUSH_URL"),
    token: clean(process.env.CLOUDFLARE_QUEUE_API_TOKEN),
  };
}

async function deferTask(task, event) {
  if (process.env.VERCEL) {
    try {
      const { waitUntil } = await import("@vercel/functions");
      waitUntil(task.catch((error) => {
        console.error("Cloudflare Queue HTTP publish failed", {
          event_id: event?.event_id,
          type: event?.type,
          error: error instanceof Error ? error.message : String(error),
        });
      }));
      return true;
    } catch (error) {
      console.error("Vercel waitUntil unavailable", error);
    }
  }

  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const context = getCloudflareContext();
    if (context?.ctx?.waitUntil) {
      context.ctx.waitUntil(task.catch((error) => {
        console.error("Cloudflare Queue HTTP publish failed", {
          event_id: event?.event_id,
          type: event?.type,
          error: error instanceof Error ? error.message : String(error),
        });
      }));
      return true;
    }
  } catch {
    // Non-Cloudflare runtime or context unavailable. Fall back to awaiting below.
  }

  return false;
}

async function publishViaHttp(event, { awaitDelivery = false } = {}) {
  const config = await queueHttpConfig();
  if (!config.url || !config.token) {
    return { queued: false, reason: "queue_not_configured", provider: "cloudflare-http" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  const task = fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body: event }),
    cache: "no-store",
    signal: controller.signal,
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      const message = payload?.errors?.[0]?.message
        || payload?.message
        || `Cloudflare Queue API gagal (${response.status})`;
      throw new Error(message);
    }
    return payload;
  }).finally(() => clearTimeout(timeout));

  if (!awaitDelivery && await deferTask(task, event)) {
    return { queued: true, deferred: true, provider: "cloudflare-http" };
  }

  try {
    await task;
    return { queued: true, deferred: false, provider: "cloudflare-http" };
  } catch (error) {
    console.error("Cloudflare Queue HTTP publish unavailable", event?.event_id, error);
    return {
      queued: false,
      reason: error instanceof Error ? error.message : "http_queue_failed",
      provider: "cloudflare-http",
    };
  }
}

async function send(event, knownFlags, options = {}) {
  const state = knownFlags || await flags();
  if (!state.notifications) return { queued: false, reason: "disabled" };
  const resolvedEvent = await withTelegramDestination(event);
  if (!resolvedEvent.telegram?.chat_id) {
    return { queued: false, reason: "telegram_chat_not_configured" };
  }
  return publishViaHttp(resolvedEvent, options);
}

export async function getNotificationQueueRuntimeStatus() {
  const [http, values] = await Promise.all([
    queueHttpConfig(),
    getIntegrationConfigValues(["APP_PLATFORM"]),
  ]);
  return {
    runtime: process.env.VERCEL ? "vercel" : clean(values.APP_PLATFORM) || "unknown",
    publisher: "cloudflare-http",
    http_push_url_configured: Boolean(http.url),
    http_api_token_configured: Boolean(http.token),
  };
}

export async function publishTelegramEvent(event) {
  return send(event);
}

export async function queueApprovalCreatedNotification({ request, activeAction = "approve" }) {
  if (!request?.id) return { queued: false, reason: "missing_request" };
  const state = await flags();
  const text = [
    "<b>Pengajuan Baru</b>",
    "",
    `<b>Nomor:</b> ${escapeHtml(request.request_no || "-")}`,
    `<b>Jenis:</b> ${escapeHtml(request.master_name || "-")}`,
    `<b>Pemohon:</b> ${escapeHtml(request.requester_name || "-")}`,
    `<b>Rumah:</b> ${escapeHtml(request.requester_house || "-")}`,
    `<b>Status:</b> ${escapeHtml(statusLabel(request.status))}`,
    `<b>Tahap Berikutnya:</b> ${escapeHtml(roleLabel(request.current_approver_role))}`,
    `<b>Diajukan:</b> ${escapeHtml(time(request.submitted_at || request.created_at))}`,
  ].join("\n");
  const buttons = markup(
    state.actions ? [
      callback(activeAction === "validate_payment" ? "Validasi Pembayaran" : "Setujui", `aa:${request.id}`),
      callback("Tolak", `ar:${request.id}`),
    ] : [],
  );
  return send(envelope("approval.created", request.id, text, buttons), state);
}

export async function queueApprovalDecisionNotification({ request, action, actorRole, actorName, note, source = "web" }) {
  if (!request?.id) return { queued: false, reason: "missing_request" };
  if (clean(source).toLowerCase() === "telegram") {
    return { queued: false, reason: "edited_original_message" };
  }

  const rejected = clean(action).toLowerCase() === "reject"
    || clean(request.status).toLowerCase() === "rejected";
  const completed = clean(request.status).toLowerCase() === "completed";
  const title = rejected ? "Pengajuan Ditolak" : completed ? "Pengajuan Selesai" : "Pengajuan Diproses";
  const text = [
    `<b>${title}</b>`,
    "",
    `<b>Nomor:</b> ${escapeHtml(request.request_no || "-")}`,
    `<b>Jenis:</b> ${escapeHtml(request.master_name || "-")}`,
    `<b>Pemohon:</b> ${escapeHtml(request.requester_name || "-")}`,
    `<b>Rumah:</b> ${escapeHtml(request.requester_house || "-")}`,
    !rejected ? "<b>Keputusan:</b> Disetujui" : "",
    `<b>Status:</b> ${escapeHtml(statusLabel(request.status))}`,
    request.current_approver_role
      ? `<b>Tahap Berikutnya:</b> ${escapeHtml(roleLabel(request.current_approver_role))}`
      : "",
    note ? `<b>Alasan:</b> ${escapeHtml(note)}` : "",
    `<b>Diproses oleh:</b> ${escapeHtml(actorLabel(actorName, actorRole))}`,
    `<b>Diproses:</b> ${escapeHtml(time(request.completed_at || request.updated_at))}`,
    `<b>Sumber:</b> ${escapeHtml(sourceLabel(source))}`,
  ].filter(Boolean).join("\n");
  return send(envelope("approval.decision", `${request.id}:${request.updated_at || Date.now()}`, text));
}

export async function queuePaymentProofSubmittedNotification({ proof, totalAmount }) {
  if (!proof?.id) return { queued: false, reason: "missing_proof" };
  const state = await flags();
  const text = [
    "<b>Bukti Pembayaran Baru</b>",
    "",
    `<b>Rumah:</b> ${escapeHtml(proof.person_house || "-")}`,
    `<b>Nama:</b> ${escapeHtml(proof.person_name || "-")}`,
    `<b>Periode:</b> ${escapeHtml(periodLabel(proof.period))}`,
    `<b>Kas:</b> ${escapeHtml(rupiah(proof.amount))}`,
    `<b>Sampah:</b> ${Number(proof.trash_amount || 0) ? escapeHtml(rupiah(proof.trash_amount)) : "-"}`,
    `<b>Total:</b> ${escapeHtml(rupiah(totalAmount ?? Number(proof.amount || 0) + Number(proof.trash_amount || 0)))}`,
    "<b>Status:</b> Menunggu Verifikasi",
    `<b>Dikirim:</b> ${escapeHtml(time(proof.submitted_at || proof.created_at))}`,
  ].join("\n");

  const buttons = markup(
    state.actions
      ? [callback("Setujui Bukti", `pa:${proof.id}`), callback("Tolak Bukti", `pr:${proof.id}`)]
      : [],
  );
  const event = envelope("payment.proof_uploaded", proof.id, text, buttons);
  const mediaUrl = await absoluteMediaUrl(proof.proof_url);
  const mimeType = clean(proof.proof_mime_type).toLowerCase();

  if (mediaUrl) {
    if (mimeType === "application/pdf") event.telegram.document = mediaUrl;
    else event.telegram.photo = mediaUrl;
  }

  return send(event, state);
}

export async function queuePaymentProofDecisionNotification({ proof, action, actorName, actorRole, reason, source = "web" }) {
  if (!proof?.id) return { queued: false, reason: "missing_proof" };
  if (clean(source).toLowerCase() === "telegram") {
    return { queued: false, reason: "edited_original_message" };
  }

  const rejected = clean(action).toLowerCase() === "reject"
    || clean(proof.status).toLowerCase() === "rejected";
  const totalAmount = Number(proof.amount || 0) + Number(proof.trash_amount || 0);
  const text = [
    `<b>Bukti Pembayaran ${rejected ? "Ditolak" : "Disetujui"}</b>`,
    "",
    `<b>Rumah:</b> ${escapeHtml(proof.person_house || "-")}`,
    `<b>Nama:</b> ${escapeHtml(proof.person_name || "-")}`,
    `<b>Periode:</b> ${escapeHtml(periodLabel(proof.period))}`,
    `<b>Kas:</b> ${escapeHtml(rupiah(proof.amount))}`,
    `<b>Sampah:</b> ${Number(proof.trash_amount || 0) ? escapeHtml(rupiah(proof.trash_amount)) : "-"}`,
    `<b>Total:</b> ${escapeHtml(rupiah(totalAmount))}`,
    `<b>Status:</b> ${rejected ? "Ditolak" : "Disetujui"}`,
    reason ? `<b>Alasan:</b> ${escapeHtml(reason)}` : "",
    `<b>Diproses oleh:</b> ${escapeHtml(actorLabel(actorName, actorRole))}`,
    `<b>Diproses:</b> ${escapeHtml(time(proof.reviewed_at || proof.updated_at))}`,
    `<b>Sumber:</b> ${escapeHtml(sourceLabel(source))}`,
  ].filter(Boolean).join("\n");
  return send(envelope("payment.proof_reviewed", `${proof.id}:${proof.reviewed_at || Date.now()}`, text));
}

export async function queueTelegramTestNotification() {
  const timestamp = time(new Date().toISOString());
  const text = [
    "<b>Uji Telegram Queue</b>",
    "",
    "<b>Status:</b> Berhasil",
    "<b>Keterangan:</b> Queue consumer berhasil menerima dan memproses event.",
    `<b>Waktu:</b> ${escapeHtml(timestamp)}`,
  ].join("\n");

  return send(
    envelope("telegram.test", Date.now(), text),
    undefined,
    { awaitDelivery: true },
  );
}
