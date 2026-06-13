import "server-only";

import crypto from "crypto";
import { promisify } from "util";

import { assertAdminAccessRole } from "@/lib/adminRoles";
import { dbTable } from "@/lib/dbTable";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const ROLE_CREDENTIALS_TABLE = dbTable("role_credentials");
const scryptAsync = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

function safeEqualText(value, expected) {
  if (!expected) return false;
  const left = crypto.createHash("sha256").update(String(value ?? "")).digest();
  const right = crypto.createHash("sha256").update(String(expected)).digest();
  return crypto.timingSafeEqual(left, right);
}

async function hashCredential(value) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scryptAsync(String(value), salt, KEY_LENGTH);
  return `scrypt$v1$${salt}$${Buffer.from(derived).toString("hex")}`;
}

async function verifyHash(value, encoded) {
  const [algorithm, version, salt, expectedHex] = String(encoded || "").split("$");
  if (algorithm !== "scrypt" || version !== "v1" || !salt || !/^[a-f0-9]+$/i.test(expectedHex || "")) {
    return false;
  }

  const expected = Buffer.from(expectedHex, "hex");
  const derived = Buffer.from(await scryptAsync(String(value ?? ""), salt, expected.length));
  return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
}

async function readCredential(role) {
  const normalizedRole = assertAdminAccessRole(role);
  const { data, error } = await getSupabaseAdmin()
    .from(ROLE_CREDENTIALS_TABLE)
    .select("role,password_hash,pin_hash,credential_version")
    .eq("role", normalizedRole)
    .maybeSingle();

  if (error) throw new Error(error.message || "Gagal membaca credential role");
  return data || null;
}

export async function verifyAdminRolePassword(role, password) {
  const credential = await readCredential(role);
  if (credential?.password_hash) return verifyHash(password, credential.password_hash);
  return safeEqualText(password, process.env.ADMIN_PASSWORD);
}

export async function verifyAdminRolePin(role, pin) {
  const credential = await readCredential(role);
  if (credential?.pin_hash) return verifyHash(pin, credential.pin_hash);
  return safeEqualText(pin, process.env.ADMIN_PIN);
}

export function validateNewRolePassword(password, confirmation, role) {
  const value = String(password ?? "");
  const confirmed = String(confirmation ?? "");
  const normalizedRole = assertAdminAccessRole(role);

  if (value !== confirmed) throw new Error("Konfirmasi password tidak sama");
  if (value.length < 8 || value.length > 128) {
    throw new Error("Password harus terdiri dari 8–128 karakter");
  }
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    throw new Error("Password harus mengandung huruf dan angka");
  }

  const lower = value.toLowerCase();
  const blocked = new Set([
    "password", "password1", "password123", "admin123",
    "admin12345", "qwerty123", "12345678",
  ]);

  if (blocked.has(lower) || lower.includes(normalizedRole)) {
    throw new Error("Password terlalu mudah ditebak");
  }

  return value;
}

export function validateNewRolePin(pin, confirmation) {
  const value = String(pin ?? "");
  const confirmed = String(confirmation ?? "");

  if (value !== confirmed) throw new Error("Konfirmasi PIN tidak sama");
  if (!/^\d{4}$/.test(value)) throw new Error("PIN harus tepat 4 digit");

  const blocked = new Set([
    "0000", "1111", "2222", "3333", "4444", "5555",
    "6666", "7777", "8888", "9999", "1234", "4321",
  ]);
  if (blocked.has(value)) throw new Error("PIN terlalu mudah ditebak");
  return value;
}

async function saveCredential({ role, field, value, updatedBy }) {
  const normalizedRole = assertAdminAccessRole(role);
  const current = await readCredential(normalizedRole);
  const client = getSupabaseAdmin();
  const nextVersion = Number(current?.credential_version || 0) + 1;
  const payload = {
    [field]: await hashCredential(value),
    credential_version: nextVersion,
    updated_at: new Date().toISOString(),
    updated_by: String(updatedBy || normalizedRole),
  };

  if (current) {
    const { data, error } = await client
      .from(ROLE_CREDENTIALS_TABLE)
      .update(payload)
      .eq("role", normalizedRole)
      .eq("credential_version", Number(current.credential_version || 0))
      .select("role,credential_version")
      .maybeSingle();

    if (error) throw new Error(error.message || "Gagal memperbarui credential role");
    if (!data) throw new Error("Credential berubah bersamaan. Silakan ulangi.");
    return data;
  }

  const { data, error } = await client
    .from(ROLE_CREDENTIALS_TABLE)
    .insert({ role: normalizedRole, ...payload })
    .select("role,credential_version")
    .single();

  if (error) throw new Error(error.message || "Gagal membuat credential role");
  return data;
}

export function updateAdminRolePassword(options) {
  return saveCredential({ ...options, field: "password_hash" });
}

export function updateAdminRolePin(options) {
  return saveCredential({ ...options, field: "pin_hash" });
}
