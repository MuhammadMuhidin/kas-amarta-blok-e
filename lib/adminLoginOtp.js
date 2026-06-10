import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { dbTable } from "@/lib/dbTable";
import { assertAdminAccessRole } from "@/lib/adminRoles";

const ADMIN_LOGIN_OTPS_TABLE = dbTable("admin_login_otps");
const OTP_TTL_MINUTES = 5;
const MAX_ATTEMPTS = 5;

function getOtpSecret() {
  const secret = process.env.WA_ADMIN_OTP_SECRET;
  if (!secret) throw new Error("WA_ADMIN_OTP_SECRET belum dikonfigurasi");
  return secret;
}

function hashOtp({ role, otp }) {
  return crypto
    .createHmac("sha256", getOtpSecret())
    .update(`${role}:${String(otp || "").trim()}`)
    .digest("hex");
}

function getExpiresAt() {
  return new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();
}

function isExpired(expiresAt) {
  const time = new Date(expiresAt || "").getTime();
  return !Number.isFinite(time) || Date.now() >= time;
}

export function generateAdminOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

export async function createPendingAdminOtp({ role, otp }) {
  const normalizedRole = assertAdminAccessRole(role);
  const supabase = getSupabaseAdmin();

  await supabase
    .from(ADMIN_LOGIN_OTPS_TABLE)
    .update({ status: "expired" })
    .eq("role", normalizedRole)
    .in("status", ["pending", "sent"])
    .is("used_at", null);

  const { data, error } = await supabase
    .from(ADMIN_LOGIN_OTPS_TABLE)
    .insert({
      role: normalizedRole,
      otp_hash: hashOtp({ role: normalizedRole, otp }),
      status: "pending",
      expires_at: getExpiresAt(),
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || "Gagal membuat OTP login");
  }

  return data.id;
}

export async function markAdminOtpSent(id) {
  if (!id) return;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from(ADMIN_LOGIN_OTPS_TABLE)
    .update({ status: "sent" })
    .eq("id", id);

  if (error) throw new Error(error.message || "Gagal update status OTP");
}

export async function markAdminOtpFailed(id) {
  if (!id) return;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from(ADMIN_LOGIN_OTPS_TABLE)
    .update({ status: "failed" })
    .eq("id", id);

  if (error) throw new Error(error.message || "Gagal update status OTP");
}

export async function consumeAdminOtpById({ id, role }) {
  const cleanId = String(id || "").trim();
  const normalizedRole = assertAdminAccessRole(role);

  if (!cleanId) throw new Error("OTP context tidak valid");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(ADMIN_LOGIN_OTPS_TABLE)
    .select("id,expires_at")
    .eq("id", cleanId)
    .eq("role", normalizedRole)
    .eq("status", "sent")
    .is("used_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message || "Gagal membaca OTP");
  if (!data) throw new Error("OTP tidak ditemukan atau sudah digunakan");

  if (isExpired(data.expires_at)) {
    await supabase
      .from(ADMIN_LOGIN_OTPS_TABLE)
      .update({ status: "expired" })
      .eq("id", data.id);
    throw new Error("OTP sudah expired");
  }

  const { error: updateError } = await supabase
    .from(ADMIN_LOGIN_OTPS_TABLE)
    .update({ status: "used", used_at: new Date().toISOString() })
    .eq("id", data.id);

  if (updateError) throw new Error(updateError.message || "Gagal consume OTP");

  return true;
}

export async function validateAdminOtp({ role, otp, consume = false }) {
  const normalizedRole = assertAdminAccessRole(role);
  const cleanOtp = String(otp || "").trim();

  if (!/^\d{6}$/.test(cleanOtp)) {
    throw new Error("OTP harus 6 digit");
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(ADMIN_LOGIN_OTPS_TABLE)
    .select("id,otp_hash,status,attempt_count,expires_at,used_at")
    .eq("role", normalizedRole)
    .eq("status", "sent")
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message || "Gagal membaca OTP");
  if (!data) throw new Error("OTP tidak ditemukan atau belum dikirim");

  if (isExpired(data.expires_at)) {
    await supabase
      .from(ADMIN_LOGIN_OTPS_TABLE)
      .update({ status: "expired" })
      .eq("id", data.id);
    throw new Error("OTP sudah expired");
  }

  if (Number(data.attempt_count || 0) >= MAX_ATTEMPTS) {
    throw new Error("OTP terkunci karena terlalu banyak percobaan");
  }

  const expectedHash = hashOtp({ role: normalizedRole, otp: cleanOtp });
  const valid = crypto.timingSafeEqual(
    Buffer.from(expectedHash, "hex"),
    Buffer.from(data.otp_hash, "hex"),
  );

  if (!valid) {
    await supabase
      .from(ADMIN_LOGIN_OTPS_TABLE)
      .update({ attempt_count: Number(data.attempt_count || 0) + 1 })
      .eq("id", data.id);
    throw new Error("OTP tidak valid");
  }

  const context = { id: data.id, role: normalizedRole };

  if (consume) {
    await consumeAdminOtpById(context);
  }

  return context;
}
