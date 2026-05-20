import crypto from "crypto";
import { supabase } from "@/lib/supabase";

const COOKIE_NAME = "admin_session";

export function getSessionCookieName() {
  return COOKIE_NAME;
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function createAdminSession(req) {
  const token = generateToken();

  const userAgent =
    req.headers.get("user-agent") ||
    "Unknown device";

  const { error } = await supabase
    .from("admin_sessions")
    .insert({
      token_hash: token,
      user_agent: userAgent,
    });

  if (error) {
    throw new Error(error.message);
  }

  return token;
}

export async function validateAdminSession(req) {
  const token =
    req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return false;
  }

  const { data, error } = await supabase
    .from("admin_sessions")
    .select("id")
    .eq("token_hash", token)
    .is("revoked_at", null)
    .single();

  if (error || !data) {
    return false;
  }

  await supabase
    .from("admin_sessions")
    .update({
      last_active:
        new Date().toISOString(),
    })
    .eq("id", data.id);

  return true;
}

export async function getAdminSessions() {
  const { data, error } = await supabase
    .from("admin_sessions")
    .select("*")
    .is("revoked_at", null)
    .order("last_active", {
      ascending: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function revokeAdminSession(id) {
  const { error } = await supabase
    .from("admin_sessions")
    .update({
      revoked_at:
        new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}
