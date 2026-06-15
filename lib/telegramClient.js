import { normalizeAdminAccessRole } from "@/lib/adminRoles";
import { dbTable } from "@/lib/dbTable";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const ROLE_CONTACTS_TABLE = dbTable("role_contacts");
const PAYMENT_PROOF_ROLES = new Set(["admin", "bendahara"]);

function clean(value) {
  return String(value || "").trim();
}

function envValue(key) {
  return clean(process.env[key]);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const result = await response.json().catch(() => ({}));
    if (response.ok && result.ok !== false) return result.result;

    const retryAfter = Number(result?.parameters?.retry_after || 0) ||
      Number(String(result?.description || "").match(/retry after\s+(\d+)/i)?.[1] || 0);

    if (response.status === 429 && attempt === 0) {
      await delay(Math.min(Math.max(retryAfter || 1, 1), 10) * 1000);
      continue;
    }

    throw new Error(result.description || `Telegram API ${method} gagal (${response.status})`);
  }

  throw new Error(`Telegram API ${method} gagal setelah retry`);
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

export async function resolveTelegramActor(user = {}) {
  const telegramUserId = clean(user.id);
  if (!/^\d{1,20}$/.test(telegramUserId)) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(ROLE_CONTACTS_TABLE)
    .select("*")
    .eq("telegram_user_id", telegramUserId)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    console.error("Failed resolving Telegram actor from Role Management", error);
    return null;
  }

  const role = normalizeAdminAccessRole(data?.role);
  if (!data || !role) return null;

  const telegramName = clean([user.first_name, user.last_name].filter(Boolean).join(" ")) || clean(user.username);
  const displayName = clean(data.display_name || data.name) || telegramName || `Telegram ${telegramUserId}`;

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
  return PAYMENT_PROOF_ROLES.has(normalizeAdminAccessRole(role));
}

async function getAuthorizedTelegramUserCount() {
  try {
    const supabase = getSupabaseAdmin();
    const { count, error } = await supabase
      .from(ROLE_CONTACTS_TABLE)
      .select("role", { count: "exact", head: true })
      .eq("active", true)
      .not("telegram_user_id", "is", null)
      .neq("telegram_user_id", "");

    if (error) throw error;
    return Number(count || 0);
  } catch (error) {
    console.error("Failed counting Telegram users from Role Management", error);
    return 0;
  }
}

export async function telegramConfigSummary() {
  const config = getTelegramRuntimeConfig();
  return {
    bot_token_configured: Boolean(config.token),
    chat_id_configured: Boolean(config.chatId),
    webhook_secret_configured: Boolean(config.webhookSecret),
    message_thread_configured: Boolean(config.threadId),
    authorized_user_count: await getAuthorizedTelegramUserCount(),
    payment_proof_roles: [...PAYMENT_PROOF_ROLES],
    authorization_source: "role_management",
  };
}
