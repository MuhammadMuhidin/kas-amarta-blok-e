import { normalizeAdminAccessRole } from "@/lib/adminRoles";

function clean(value) {
  return String(value || "").trim();
}

function envValue(key) {
  return clean(process.env[key]);
}

export function getTelegramRuntimeConfig() {
  return {
    token: envValue("TELEGRAM_BOT_TOKEN"),
    chatId: envValue("TELEGRAM_CHAT_ID"),
    webhookSecret: envValue("TELEGRAM_WEBHOOK_SECRET"),
    threadId: envValue("TELEGRAM_MESSAGE_THREAD_ID"),
  };
}

export function getTelegramAppBaseUrl() {
  const value = clean(
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL,
  );

  if (!value) return "";
  const url = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return url.replace(/\/$/, "");
}

export async function telegramApi(method, payload = {}) {
  const { token } = getTelegramRuntimeConfig();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN belum dikonfigurasi");

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false) {
    throw new Error(result.description || `Telegram API ${method} gagal (${response.status})`);
  }

  return result.result;
}

export async function sendTelegramMessage({ text, replyMarkup, parseMode = "HTML" }) {
  const config = getTelegramRuntimeConfig();
  if (!config.chatId) throw new Error("TELEGRAM_CHAT_ID belum dikonfigurasi");

  return telegramApi("sendMessage", {
    chat_id: config.chatId,
    text: clean(text),
    parse_mode: parseMode,
    disable_web_page_preview: true,
    ...(config.threadId ? { message_thread_id: Number(config.threadId) } : {}),
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

export async function answerTelegramCallback(callbackQueryId, options = {}) {
  if (!clean(callbackQueryId)) return null;
  return telegramApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text: clean(options.text),
    show_alert: Boolean(options.showAlert),
    cache_time: 0,
  });
}

export async function editTelegramReplyMarkup({ chatId, messageId, replyMarkup }) {
  return telegramApi("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: replyMarkup || { inline_keyboard: [] },
  });
}

export async function editTelegramText({ chatId, messageId, text, replyMarkup }) {
  return telegramApi("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: clean(text),
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: replyMarkup || { inline_keyboard: [] },
  });
}

export async function getTelegramWebhookInfo() {
  return telegramApi("getWebhookInfo");
}

export async function registerTelegramWebhook() {
  const config = getTelegramRuntimeConfig();
  const baseUrl = getTelegramAppBaseUrl();
  if (!config.webhookSecret) throw new Error("TELEGRAM_WEBHOOK_SECRET belum dikonfigurasi");
  if (!baseUrl) throw new Error("APP_URL/NEXT_PUBLIC_APP_URL belum dikonfigurasi");

  const url = `${baseUrl}/api/integrations/telegram/webhook`;
  const result = await telegramApi("setWebhook", {
    url,
    secret_token: config.webhookSecret,
    allowed_updates: ["callback_query"],
    drop_pending_updates: false,
  });

  return { ok: Boolean(result), url };
}

export async function removeTelegramWebhook() {
  const result = await telegramApi("deleteWebhook", { drop_pending_updates: false });
  return { ok: Boolean(result) };
}

function parseRoleMap(raw) {
  const value = clean(raw);
  if (!value) return {};

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch {
    // Fall through to comma-separated syntax: 123:admin,456:bendahara
  }

  return Object.fromEntries(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const separator = item.lastIndexOf(":");
        return separator > 0
          ? [item.slice(0, separator).trim(), item.slice(separator + 1).trim()]
          : ["", ""];
      })
      .filter(([id, role]) => id && role),
  );
}

export function resolveTelegramActor(user = {}) {
  const telegramUserId = clean(user.id);
  const map = parseRoleMap(process.env.TELEGRAM_APPROVER_ROLES);
  const role = normalizeAdminAccessRole(map[telegramUserId]);
  if (!telegramUserId || !role) return null;

  const displayName = clean([user.first_name, user.last_name].filter(Boolean).join(" ")) || clean(user.username) || `Telegram ${telegramUserId}`;
  return {
    telegramUserId,
    username: clean(user.username),
    displayName,
    role,
  };
}

export function isTelegramChatAllowed(chatId) {
  const configured = getTelegramRuntimeConfig().chatId;
  return Boolean(configured && clean(chatId) === configured);
}

export function isPaymentProofTelegramRoleAllowed(role) {
  const normalized = normalizeAdminAccessRole(role);
  if (!normalized) return false;
  if (normalized === "admin") return true;

  const configured = new Set(
    envValue("TELEGRAM_PAYMENT_PROOF_ALLOWED_ROLES")
      .split(",")
      .map((item) => normalizeAdminAccessRole(item))
      .filter(Boolean),
  );

  return configured.has(normalized);
}

export function telegramConfigSummary() {
  const config = getTelegramRuntimeConfig();
  const roleMap = parseRoleMap(process.env.TELEGRAM_APPROVER_ROLES);
  return {
    bot_token_configured: Boolean(config.token),
    chat_id_configured: Boolean(config.chatId),
    webhook_secret_configured: Boolean(config.webhookSecret),
    message_thread_configured: Boolean(config.threadId),
    authorized_user_count: Object.keys(roleMap).length,
    payment_proof_roles: envValue("TELEGRAM_PAYMENT_PROOF_ALLOWED_ROLES")
      .split(",")
      .map((item) => normalizeAdminAccessRole(item))
      .filter(Boolean),
  };
}
