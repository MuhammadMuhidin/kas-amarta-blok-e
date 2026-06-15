import { getAuthConfigs } from "@/lib/webauth";
import { formatJakartaDateTime } from "@/lib/localDate";
import { getTelegramAppBaseUrl } from "@/lib/telegramClient";

const BINDING = "AMARTA_NOTIFICATION_QUEUE";
const HTTP_TIMEOUT_MS = 5000;
const clean = (v) => String(v || "").trim();
const escapeHtml = (v) => clean(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const rupiah = (v) => `Rp${Number(v || 0).toLocaleString("id-ID")}`;
const time = (v) => v ? `${formatJakartaDateTime(v, "id-ID")} WIB` : "-";
const callback = (text, data) => new TextEncoder().encode(data).length <= 64 ? { text, callback_data: data } : null;
const baseUrl = () => getTelegramAppBaseUrl();
const link = (text, path) => baseUrl() ? { text, url: `${baseUrl()}${path}` } : null;
const markup = (...rows) => ({ inline_keyboard: rows.map((r) => r.filter(Boolean)).filter((r) => r.length) });

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
    telegram: { text, parse_mode: "HTML", disable_web_page_preview: true, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) },
  };
}

function queueHttpConfig() {
  return {
    url: clean(process.env.CLOUDFLARE_QUEUE_PUSH_URL),
    token: clean(process.env.CLOUDFLARE_QUEUE_API_TOKEN),
  };
}

async function getCloudflareQueueContext() {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    return getCloudflareContext();
  } catch {
    return null;
  }
}

async function deferOnVercel(task, event) {
  if (!process.env.VERCEL) return false;

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
    console.error("Vercel waitUntil unavailable; publishing Queue inline", error);
    return false;
  }
}

async function publishViaHttp(event) {
  const config = queueHttpConfig();
  if (!config.url || !config.token) {
    return { available: false, result: { queued: false, reason: "http_publisher_not_configured" } };
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
      const message = payload?.errors?.[0]?.message || payload?.message || `Cloudflare Queue API gagal (${response.status})`;
      throw new Error(message);
    }
    return payload;
  }).finally(() => clearTimeout(timeout));

  if (await deferOnVercel(task, event)) {
    return { available: true, result: { queued: true, deferred: true, provider: "cloudflare-http" } };
  }

  try {
    await task;
    return { available: true, result: { queued: true, deferred: false, provider: "cloudflare-http" } };
  } catch (error) {
    console.error("Cloudflare Queue HTTP publish unavailable", event?.event_id, error);
    return {
      available: true,
      result: { queued: false, reason: error instanceof Error ? error.message : "http_queue_failed", provider: "cloudflare-http" },
    };
  }
}

async function publishViaBinding(event) {
  const context = await getCloudflareQueueContext();
  const queue = context?.env?.[BINDING];
  if (!queue?.send) return { available: false, result: null };

  try {
    const task = queue.send(event, { contentType: "json" });
    if (context.ctx?.waitUntil) {
      context.ctx.waitUntil(task.catch((error) => console.error("Queue binding publish failed", event.event_id, error)));
      return { available: true, result: { queued: true, deferred: true, provider: "cloudflare-binding" } };
    }

    await task;
    return { available: true, result: { queued: true, deferred: false, provider: "cloudflare-binding" } };
  } catch (error) {
    console.error("Queue binding publish unavailable", event?.event_id, error);
    return {
      available: true,
      result: { queued: false, reason: error instanceof Error ? error.message : "binding_queue_failed", provider: "cloudflare-binding" },
    };
  }
}

async function send(event, knownFlags) {
  const state = knownFlags || await flags();
  if (!state.notifications) return { queued: false, reason: "disabled" };

  const binding = await publishViaBinding(event);
  if (binding.available) return binding.result;

  const http = await publishViaHttp(event);
  if (http.available) return http.result;

  return { queued: false, reason: "queue_not_configured" };
}

export function getNotificationQueueRuntimeStatus() {
  const http = queueHttpConfig();
  return {
    runtime: process.env.VERCEL ? "vercel" : clean(process.env.APP_PLATFORM) || "unknown",
    cloudflare_binding_expected: !process.env.VERCEL,
    http_push_url_configured: Boolean(http.url),
    http_api_token_configured: Boolean(http.token),
  };
}

export async function publishTelegramEvent(event) { return send(event); }

export async function queueApprovalCreatedNotification({ request, activeAction = "approve" }) {
  if (!request?.id) return { queued: false, reason: "missing_request" };
  const state = await flags();
  const text = [
    "<b>Pengajuan Warga Baru</b>", "",
    `<b>Nomor:</b> ${escapeHtml(request.request_no || "-")}`,
    `<b>Jenis:</b> ${escapeHtml(request.master_name || "-")}`,
    `<b>Pemohon:</b> ${escapeHtml(request.requester_name || "-")}`,
    `<b>Rumah:</b> ${escapeHtml(request.requester_house || "-")}`,
    `<b>Status:</b> ${escapeHtml(request.status || "-")}`,
    `<b>Menunggu:</b> ${escapeHtml(request.current_approver_role || "-")}`,
    `<b>Waktu:</b> ${escapeHtml(time(request.submitted_at || request.created_at))}`,
  ].join("\n");
  const buttons = markup(
    [link("Buka Approval Center", "/admin")],
    state.actions ? [callback(activeAction === "validate_payment" ? "Validasi Pembayaran" : "Approve", `aa:${request.id}`), callback("Reject", `ar:${request.id}`)] : [],
  );
  return send(envelope("approval.created", request.id, text, buttons), state);
}

export async function queueApprovalDecisionNotification({ request, action, actorRole, actorName, note, source = "web" }) {
  if (!request?.id) return { queued: false, reason: "missing_request" };
  const rejected = clean(action) === "reject" || request.status === "rejected";
  const text = [
    `<b>Pengajuan ${rejected ? "Ditolak" : "Diproses"}</b>`, "",
    `<b>Nomor:</b> ${escapeHtml(request.request_no || "-")}`,
    `<b>Jenis:</b> ${escapeHtml(request.master_name || "-")}`,
    `<b>Keputusan:</b> ${rejected ? "Reject" : "Approve"}`,
    `<b>Oleh:</b> ${escapeHtml(actorName || actorRole || "-")}`,
    `<b>Status:</b> ${escapeHtml(request.status || "-")}`,
    `<b>Menunggu berikutnya:</b> ${escapeHtml(request.current_approver_role || "Selesai")}`,
    note ? `<b>Catatan:</b> ${escapeHtml(note)}` : "",
    `<b>Sumber:</b> ${escapeHtml(source)}`,
  ].filter(Boolean).join("\n");
  return send(envelope("approval.decision", `${request.id}:${request.updated_at || Date.now()}`, text, markup([link("Buka Approval Center", "/admin")])));
}

export async function queuePaymentProofSubmittedNotification({ proof, totalAmount }) {
  if (!proof?.id) return { queued: false, reason: "missing_proof" };
  const state = await flags();
  const text = [
    "<b>Bukti Pembayaran Baru</b>", "",
    `<b>Rumah:</b> ${escapeHtml(proof.person_house || "-")}`,
    `<b>Nama:</b> ${escapeHtml(proof.person_name || "-")}`,
    `<b>Periode:</b> ${escapeHtml(proof.period || "-")}`,
    `<b>Kas:</b> ${escapeHtml(rupiah(proof.amount))}`,
    `<b>Sampah:</b> ${Number(proof.trash_amount || 0) ? escapeHtml(rupiah(proof.trash_amount)) : "-"}`,
    `<b>Total:</b> ${escapeHtml(rupiah(totalAmount ?? Number(proof.amount || 0) + Number(proof.trash_amount || 0)))}`,
    "<b>Status:</b> Menunggu Verifikasi",
  ].join("\n");
  const proofLink = /^https:\/\//i.test(clean(proof.proof_url)) ? { text: "Lihat Bukti", url: proof.proof_url } : null;
  const buttons = markup(
    [proofLink, link("Buka Payment Review", "/admin")],
    state.actions ? [callback("Approve Bukti", `pa:${proof.id}`), callback("Reject Bukti", `pr:${proof.id}`)] : [],
  );
  return send(envelope("payment.proof_uploaded", proof.id, text, buttons), state);
}

export async function queuePaymentProofDecisionNotification({ proof, action, actorName, actorRole, reason, source = "web" }) {
  if (!proof?.id) return { queued: false, reason: "missing_proof" };
  const rejected = clean(action) === "reject" || proof.status === "rejected";
  const text = [
    `<b>Bukti Pembayaran ${rejected ? "Ditolak" : "Disetujui"}</b>`, "",
    `<b>Rumah:</b> ${escapeHtml(proof.person_house || "-")}`,
    `<b>Periode:</b> ${escapeHtml(proof.period || "-")}`,
    `<b>Nominal:</b> ${escapeHtml(rupiah(proof.amount))}`,
    `<b>Oleh:</b> ${escapeHtml(actorName || actorRole || "-")}`,
    reason ? `<b>Alasan:</b> ${escapeHtml(reason)}` : "",
    `<b>Sumber:</b> ${escapeHtml(source)}`,
  ].filter(Boolean).join("\n");
  return send(envelope("payment.proof_reviewed", `${proof.id}:${proof.reviewed_at || Date.now()}`, text, markup([link("Buka Payment Review", "/admin")])));
}

export async function queueTelegramTestNotification() {
  return send(envelope("telegram.test", Date.now(), `<b>Telegram Queue Test</b>\n\nQueue consumer menerima event pada ${escapeHtml(time(new Date().toISOString()))}.`));
}
