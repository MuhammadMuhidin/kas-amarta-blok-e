import crypto from "crypto";
import { dbTable } from "@/lib/dbTable";
import { supabase } from "@/lib/supabase";

const DEFAULT_SESSION_DURATION = 60 * 60 * 24;
const CONFIG_WEBAUTH_TABLE = dbTable("config_webauth");
const DATA_WEBAUTH_TABLE = dbTable("data_webauth");

const AUTH_CONFIG_KEYS = [
  "WEB_AUTH_ENABLED",
  "PIN_ENABLED",
  "SESSION_DURATION",
  "WA_SERVICES_ENABLED",
  "TELEGRAM_NOTIFICATIONS_ENABLED",
  "TELEGRAM_ACTIONS_ENABLED",
];

export function getWebAuthConfig() {
  const rpName = process.env.WEBAUTH_RP_NAME;
  const rpID = process.env.WEBAUTH_RP_ID;
  const origin = process.env.WEBAUTH_ORIGIN;

  if (!rpName || !rpID || !origin) {
    throw new Error("WEBAUTH env belum lengkap");
  }

  return { rpName, rpID, origin };
}

async function readBooleanConfig(key, defaultValue = false) {
  const { data, error } = await supabase
    .from(CONFIG_WEBAUTH_TABLE)
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) throw new Error(`Config ${key} tidak dapat dibaca`);
  if (!data) return defaultValue;
  if (data.value !== "true" && data.value !== "false") {
    throw new Error(`Config ${key} tidak valid`);
  }
  return data.value === "true";
}

export async function getAdminSessionDuration() {
  const { data } = await supabase
    .from(CONFIG_WEBAUTH_TABLE)
    .select("value")
    .eq("key", "SESSION_DURATION")
    .maybeSingle();

  const value = Number(data?.value || DEFAULT_SESSION_DURATION);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_SESSION_DURATION;
  return value;
}

export async function isWebAuthEnabled() {
  const { data, error } = await supabase
    .from(CONFIG_WEBAUTH_TABLE)
    .select("value")
    .eq("key", "WEB_AUTH_ENABLED")
    .single();

  if (error || !data) throw new Error("Config WEB_AUTH_ENABLED tidak ditemukan");
  if (data.value !== "true" && data.value !== "false") {
    throw new Error("Config WEB_AUTH_ENABLED tidak valid");
  }
  return data.value === "true";
}

export async function isWhatsAppServicesEnabled() {
  return readBooleanConfig("WA_SERVICES_ENABLED", true);
}

export async function isTelegramNotificationsEnabled() {
  return readBooleanConfig("TELEGRAM_NOTIFICATIONS_ENABLED", false);
}

export async function isTelegramActionsEnabled() {
  const [notifications, actions] = await Promise.all([
    isTelegramNotificationsEnabled(),
    readBooleanConfig("TELEGRAM_ACTIONS_ENABLED", false),
  ]);
  return notifications && actions;
}

export async function assertWhatsAppServicesEnabled() {
  const enabled = await isWhatsAppServicesEnabled();
  if (!enabled) throw new Error("WhatsApp services sedang dinonaktifkan dari Settings Auth.");
}

export async function getActiveCredential() {
  const credentials = await getActiveCredentials();
  return credentials[0] || null;
}

export async function getActiveCredentials() {
  const { data, error } = await supabase
    .from(DATA_WEBAUTH_TABLE)
    .select("*")
    .eq("is_active", true)
    .order("id", { ascending: false });

  if (error) throw new Error("Gagal mengambil credential WebAuth");
  return data || [];
}

export async function getCredentialById(credentialId) {
  const cleanCredentialId = String(credentialId || "").trim();
  if (!cleanCredentialId) return null;

  const { data, error } = await supabase
    .from(DATA_WEBAUTH_TABLE)
    .select("*")
    .eq("credential_id", cleanCredentialId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error("Gagal mengambil credential WebAuth");
  return data;
}

export async function saveCredential({ credentialId, publicKey, counter }) {
  if (!credentialId || !publicKey || typeof counter !== "number") {
    throw new Error("Data credential WebAuth tidak lengkap");
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from(DATA_WEBAUTH_TABLE).upsert(
    {
      credential_id: credentialId,
      public_key: publicKey,
      counter,
      is_active: true,
      updated_at: now,
    },
    { onConflict: "credential_id" },
  );

  if (error) throw new Error("Gagal menyimpan credential WebAuth");
}

export async function updateCounter(id, counter) {
  if (!id || typeof counter !== "number") throw new Error("Counter WebAuth tidak valid");

  const { error } = await supabase
    .from(DATA_WEBAUTH_TABLE)
    .update({ counter, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error("Gagal update counter WebAuth");
}

export function createCSRFToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function getAuthConfigs() {
  const { data, error } = await supabase
    .from(CONFIG_WEBAUTH_TABLE)
    .select("key,value")
    .in("key", AUTH_CONFIG_KEYS);

  if (error || !data) throw new Error("Gagal membaca config auth");

  const configs = {
    WEB_AUTH_ENABLED: null,
    PIN_ENABLED: null,
    SESSION_DURATION: String(DEFAULT_SESSION_DURATION),
    WA_SERVICES_ENABLED: "true",
    TELEGRAM_NOTIFICATIONS_ENABLED: "false",
    TELEGRAM_ACTIONS_ENABLED: "false",
  };

  for (const item of data) configs[item.key] = item.value;

  return {
    webAuthEnabled: configs.WEB_AUTH_ENABLED === "true",
    pinEnabled: configs.PIN_ENABLED === "true",
    sessionDuration: Number(configs.SESSION_DURATION || DEFAULT_SESSION_DURATION),
    whatsappServicesEnabled: configs.WA_SERVICES_ENABLED !== "false",
    telegramNotificationsEnabled: configs.TELEGRAM_NOTIFICATIONS_ENABLED === "true",
    telegramActionsEnabled:
      configs.TELEGRAM_NOTIFICATIONS_ENABLED === "true" &&
      configs.TELEGRAM_ACTIONS_ENABLED === "true",
  };
}

export async function updateAuthConfig(key, value) {
  if (!AUTH_CONFIG_KEYS.includes(key)) throw new Error("Config key tidak diizinkan");

  const { error } = await supabase.from(CONFIG_WEBAUTH_TABLE).upsert(
    { key, value: String(value), updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );

  if (error) throw new Error("Gagal update config auth");
}
