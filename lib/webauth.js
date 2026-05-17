import crypto from "crypto";
import { supabase } from "@/lib/supabaseAdmin";

export function getWebAuthConfig() {
  const rpName =
    process.env.WEBAUTH_RP_NAME;

  const rpID =
    process.env.WEBAUTH_RP_ID;

  const origin =
    process.env.WEBAUTH_ORIGIN;

  if (!rpName || !rpID || !origin) {
    throw new Error(
      "WEBAUTH env belum lengkap"
    );
  }

  return {
    rpName,
    rpID,
    origin,
  };
}

export async function isWebAuthEnabled() {
  const { data, error } =
    await supabaseAdmin
      .from("config_webauth")
      .select("value")
      .eq("key", "WEB_AUTH_ENABLED")
      .single();

  if (error || !data) {
    throw new Error(
      "Config WEB_AUTH_ENABLED tidak ditemukan"
    );
  }

  if (
    data.value !== "true" &&
    data.value !== "false"
  ) {
    throw new Error(
      "Config WEB_AUTH_ENABLED tidak valid"
    );
  }

  return data.value === "true";
}

export async function getActiveCredential() {
  const { data, error } =
    await supabaseAdmin
      .from("data_webauth")
      .select("*")
      .eq("is_active", true)
      .order("id", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

  if (error) {
    throw new Error(
      "Gagal mengambil credential WebAuth"
    );
  }

  return data;
}

export async function saveCredential({
  credentialId,
  publicKey,
  counter,
}) {
  if (
    !credentialId ||
    !publicKey ||
    typeof counter !== "number"
  ) {
    throw new Error(
      "Data credential WebAuth tidak lengkap"
    );
  }

  const now =
    new Date().toISOString();

  const disableOld =
    await supabaseAdmin
      .from("data_webauth")
      .update({
        is_active: false,
        updated_at: now,
      })
      .eq("is_active", true);

  if (disableOld.error) {
    throw new Error(
      "Gagal menonaktifkan credential lama"
    );
  }

  const { error } =
    await supabaseAdmin
      .from("data_webauth")
      .insert({
        credential_id: credentialId,
        public_key: publicKey,
        counter,
        is_active: true,
        updated_at: now,
      });

  if (error) {
    throw new Error(
      "Gagal menyimpan credential WebAuth"
    );
  }
}

export async function updateCounter(
  id,
  counter
) {
  if (!id || typeof counter !== "number") {
    throw new Error(
      "Counter WebAuth tidak valid"
    );
  }

  const { error } =
    await supabaseAdmin
      .from("data_webauth")
      .update({
        counter,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

  if (error) {
    throw new Error(
      "Gagal update counter WebAuth"
    );
  }
}

export function createCSRFToken() {
  return crypto
    .randomBytes(32)
    .toString("hex");
}
