import "server-only";

import { dbTable } from "@/lib/dbTable";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const TABLE = dbTable("integration_config");

export const INTEGRATION_CONFIG_KEYS = [
  "EMAIL_NOTIFICATIONS_ENABLED",
  "ALERT_EMAIL_FROM",
  "ALERT_EMAIL_TO",
  "APP_PLATFORM",
  "APP_URL",
  "CLOUDFLARE_QUEUE_PUSH_URL",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
  "TELEGRAM_CHAT_ID",
  "WA_ALERT_CHAT_ID",
  "WA_API_URL",
  "WA_REPORT_CHAT_ID",
  "WA_SESSION_ID",
  "WEBAUTH_RP_NAME",
];

const ALLOWED = new Set(INTEGRATION_CONFIG_KEYS);

function clean(value) {
  return String(value ?? "").trim();
}

export function isConfiguredIntegrationValue(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return clean(value) !== "";
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function validateKey(key) {
  const value = clean(key);
  if (!ALLOWED.has(value)) throw new Error(`Config key tidak diizinkan: ${value}`);
  return value;
}

export function getIntegrationConfigEnvironmentFallback(key) {
  const normalized = validateKey(key);
  const values = {
    EMAIL_NOTIFICATIONS_ENABLED: process.env.EMAIL_NOTIFICATIONS_ENABLED || process.env.ALERT_EMAIL_ENABLED,
    ALERT_EMAIL_FROM: process.env.ALERT_EMAIL_FROM,
    ALERT_EMAIL_TO: process.env.ALERT_EMAIL_TO,
    APP_PLATFORM: process.env.APP_PLATFORM,
    APP_URL: process.env.APP_URL,
    CLOUDFLARE_QUEUE_PUSH_URL: process.env.CLOUDFLARE_QUEUE_PUSH_URL,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
    R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
    WA_ALERT_CHAT_ID: process.env.WA_ALERT_CHAT_ID,
    WA_API_URL: process.env.WA_API_URL,
    WA_REPORT_CHAT_ID: process.env.WA_REPORT_CHAT_ID,
    WA_SESSION_ID: process.env.WA_SESSION_ID,
    WEBAUTH_RP_NAME: process.env.WEBAUTH_RP_NAME,
  };
  return values[normalized];
}

async function readRows(keys) {
  try {
    const result = await getSupabaseAdmin()
      .from(TABLE)
      .select("key,value,is_active,version,updated_at,updated_by")
      .in("key", keys);
    if (result.error) throw result.error;
    return result.data || [];
  } catch (error) {
    console.error("Integration config unavailable; ENV fallback used", error);
    return [];
  }
}

export async function getStoredIntegrationConfigRows(keys) {
  const normalized = [...new Set((keys || []).map(validateKey))];
  const rows = await readRows(normalized);
  const rowMap = new Map(rows.map((row) => [row.key, row]));
  return Object.fromEntries(normalized.map((key) => [key, rowMap.get(key) || null]));
}

export async function getStoredIntegrationConfigValues(keys) {
  const normalized = [...new Set((keys || []).map(validateKey))];
  const rows = await getStoredIntegrationConfigRows(normalized);

  return Object.fromEntries(normalized.map((key) => {
    const row = rows[key];
    if (row?.is_active !== false && isConfiguredIntegrationValue(row?.value)) {
      return [key, row.value];
    }
    return [key, undefined];
  }));
}

export async function getStoredIntegrationConfigValue(key, defaultValue = undefined) {
  const normalized = validateKey(key);
  const values = await getStoredIntegrationConfigValues([normalized]);
  return isConfiguredIntegrationValue(values[normalized]) ? values[normalized] : defaultValue;
}

export async function getIntegrationConfigValues(keys) {
  const normalized = [...new Set((keys || []).map(validateKey))];
  const storedValues = await getStoredIntegrationConfigValues(normalized);

  return Object.fromEntries(normalized.map((key) => {
    if (isConfiguredIntegrationValue(storedValues[key])) return [key, storedValues[key]];
    return [key, getIntegrationConfigEnvironmentFallback(key)];
  }));
}

export async function getIntegrationConfigValue(key, defaultValue = "") {
  const normalized = validateKey(key);
  const values = await getIntegrationConfigValues([normalized]);
  return isConfiguredIntegrationValue(values[normalized]) ? values[normalized] : defaultValue;
}

export async function getIntegrationConfigString(key, defaultValue = "") {
  return clean(await getIntegrationConfigValue(key, defaultValue));
}

export async function getIntegrationConfigBoolean(key, defaultValue = false) {
  const value = await getIntegrationConfigValue(key, defaultValue);
  if (typeof value === "boolean") return value;
  return clean(value).toLowerCase() === "true";
}

export async function getIntegrationConfigStringArray(key) {
  const value = await getIntegrationConfigValue(key, []);
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  return clean(value).split(",").map(clean).filter(Boolean);
}
