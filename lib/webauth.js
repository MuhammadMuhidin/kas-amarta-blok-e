import crypto from "crypto";
import { supabase } from "@/lib/supabase";

const DEFAULT_SESSION_DURATION = 60 * 60 * 24;

export function getWebAuthConfig() {
  const rpName = process.env.WEBAUTH_RP_NAME;

  const rpID = process.env.WEBAUTH_RP_ID;

  const origin = process.env.WEBAUTH_ORIGIN;

  if (!rpName || !rpID || !origin) {
    throw new Error("WEBAUTH env belum lengkap");
  }

  return {
    rpName,
    rpID,
    origin,
  };
}

export async function getAdminSessionDuration() {
  const { data } = await supabase
    .from("config_webauth")
    .select("value")
    .eq("key", "SESSION_DURATION")
    .maybeSingle();

  const value = Number(data?.value || DEFAULT_SESSION_DURATION);

  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_SESSION_DURATION;
  }

  return value;
}

export async function isWebAuthEnabled() {
  const { data, error } = await supabase
    .from("config_webauth")
    .select("value")
    .eq("key", "WEB_AUTH_ENABLED")
    .single();

  if (error || !data) {
    throw new Error("Config WEB_AUTH_ENABLED tidak ditemukan");
  }

  if (data.value !== "true" && data.value !== "false") {
    throw new Error("Config WEB_AUTH_ENABLED tidak valid");
  }

  return data.value === "true";
}

export async function getActiveCredential() {
  const credentials = await getActiveCredentials();

  return credentials[0] || null;
}

export async function getActiveCredentials() {
  const { data, error } = await supabase
    .from("data_webauth")
    .select("*")
    .eq("is_active", true)
    .order("id", {
      ascending: false,
    });

  if (error) {
    throw new Error("Gagal mengambil credential WebAuth");
  }

  return data || [];
}

export async function getCredentialById(credentialId) {
  const cleanCredentialId = String(credentialId || "").trim();

  if (!cleanCredentialId) return null;

  const { data, error } = await supabase
    .from("data_webauth")
    .select("*")
    .eq("credential_id", cleanCredentialId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error("Gagal mengambil credential WebAuth");
  }

  return data;
}

export async function saveCredential({ credentialId, publicKey, counter }) {
  if (!credentialId || !publicKey || typeof counter !== "number") {
    throw new Error("Data credential WebAuth tidak lengkap");
  }

  const now = new Date().toISOString();

  const { error } = await supabase.from("data_webauth").upsert(
    {
      credential_id: credentialId,
      public_key: publicKey,
      counter,
      is_active: true,
      updated_at: now,
    },
    {
      onConflict: "credential_id",
    },
  );

  if (error) {
    throw new Error("Gagal menyimpan credential WebAuth");
  }
}

export async function updateCounter(id, counter) {
  if (!id || typeof counter !== "number") {
    throw new Error("Counter WebAuth tidak valid");
  }

  const { error } = await supabase
    .from("data_webauth")
    .update({
      counter,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error("Gagal update counter WebAuth");
  }
}

export function createCSRFToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function getAuthConfigs() {
  const { data, error } = await supabase
    .from("config_webauth")
    .select("key,value")
    .in("key", [
      "WEB_AUTH_ENABLED",
      "PIN_ENABLED",
      "SESSION_DURATION",
    ]);

  if (error || !data) {
    throw new Error("Gagal membaca config auth");
  }

  const configs = {
    WEB_AUTH_ENABLED: null,
    PIN_ENABLED: null,
    SESSION_DURATION: String(DEFAULT_SESSION_DURATION),
  };

  for (const item of data) {
    configs[item.key] = item.value;
  }

  return {
    webAuthEnabled: configs.WEB_AUTH_ENABLED === "true",
    pinEnabled: configs.PIN_ENABLED === "true",
    sessionDuration: Number(configs.SESSION_DURATION || DEFAULT_SESSION_DURATION),
  };
}

export async function updateAuthConfig(key, value) {
  const allowedKeys = [
    "WEB_AUTH_ENABLED",
    "PIN_ENABLED",
    "SESSION_DURATION",
  ];

  if (!allowedKeys.includes(key)) {
    throw new Error("Config key tidak diizinkan");
  }

  const normalizedValue = String(value);

  const { error } = await supabase.from("config_webauth").upsert(
    {
      key,
      value: normalizedValue,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "key",
    },
  );

  if (error) {
    throw new Error("Gagal update config auth");
  }
}
