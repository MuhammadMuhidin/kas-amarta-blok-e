import crypto from "crypto";
import { supabase } from "@/lib/supabase";
import { recordAdminActivity } from "@/lib/adminActivity";
import { dbTable } from "@/lib/dbTable";
import { getRequestLocation } from "@/lib/ipLocation";
import { getAdminSessionDuration } from "@/lib/webauth";
import { getAdminAccessRoleLabel, resolveAdminAccessRole } from "@/lib/adminRoles";

const COOKIE_NAME = "admin_session";
const ADMIN_SESSIONS_TABLE = dbTable("admin_sessions");

export function getSessionCookieName() {
  return COOKIE_NAME;
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function getBrowser(userAgent) {
  const chrome = userAgent.match(/Chrome\/(\d+)/);
  const safari = userAgent.match(/Version\/(\d+).*Safari/);
  const firefox = userAgent.match(/Firefox\/(\d+)/);
  const edge = userAgent.match(/Edg\/(\d+)/);

  if (edge) return `Edge ${edge[1]}`;
  if (chrome) return `Chrome ${chrome[1]}`;
  if (safari) return `Safari ${safari[1]}`;
  if (firefox) return `Firefox ${firefox[1]}`;

  return "Unknown Browser";
}

function getOS(userAgent) {
  const android = userAgent.match(/Android\s([0-9.]+)/);
  const ios = userAgent.match(/OS\s([0-9_]+)\slike Mac OS X/);
  const windows = userAgent.match(/Windows NT\s([0-9.]+)/);
  const mac = userAgent.match(/Mac OS X\s([0-9_]+)/);

  if (android) return `Android ${android[1]}`;
  if (ios) return `iOS ${ios[1].replaceAll("_", ".")}`;
  if (windows) return `Windows ${windows[1]}`;
  if (mac) return `macOS ${mac[1].replaceAll("_", ".")}`;

  return "Unknown OS";
}

function getDeviceName(userAgent) {
  return `${getBrowser(userAgent)} • ${getOS(userAgent)}`;
}

function isExpiredAt(expiresAt) {
  if (!expiresAt) return true;

  const expiresTime = new Date(expiresAt).getTime();

  return !Number.isFinite(expiresTime) || Date.now() >= expiresTime;
}

function getExpiresAt(durationSeconds) {
  return new Date(Date.now() + Number(durationSeconds || 0) * 1000).toISOString();
}

export async function createAdminSession(req, durationSeconds, options = {}) {
  const token = generateToken();

  const tokenHash = hashToken(token);
  const accessRole = resolveAdminAccessRole(options.accessRole);

  const userAgent =
    req.headers.get("user-agent") ||
    "Unknown device";

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;

  const deviceName = getDeviceName(userAgent);
  const location = await getRequestLocation(req, ip);
  const expiresAt = getExpiresAt(durationSeconds);

  const { error } = await supabase
    .from(ADMIN_SESSIONS_TABLE)
    .insert({
      token_hash: tokenHash,
      access_role: accessRole,
      user_agent: userAgent,
      ip,
      device_name: deviceName,
      location,
      expires_at: expiresAt,
    });

  if (error) {
    throw new Error(error.message);
  }

  await recordAdminActivity(req, {
    type: "login",
    module: "session",
    severity: "success",
    message: `Admin login success as ${getAdminAccessRoleLabel(accessRole)}`,
    metadata: {
      access_role: accessRole,
      device_name: deviceName,
      ip,
      location,
      expires_at: expiresAt,
    },
  });

  return token;
}

export async function validateAdminSession(req) {
  const token =
    req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return false;
  }

  const tokenHash = hashToken(token);

  const { data, error } = await supabase
    .from(ADMIN_SESSIONS_TABLE)
    .select("id,expires_at")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .single();

  if (error || !data) {
    return false;
  }

  if (isExpiredAt(data.expires_at)) {
    await revokeAdminSession(data.id);
    return false;
  }

  await supabase
    .from(ADMIN_SESSIONS_TABLE)
    .update({
      last_active:
        new Date().toISOString(),
    })
    .eq("id", data.id);

  return true;
}

export async function revokeExpiredAdminSessions() {
  const { data, error } = await supabase
    .from(ADMIN_SESSIONS_TABLE)
    .select("id,expires_at")
    .is("revoked_at", null);

  if (error) {
    throw new Error(error.message);
  }

  const expiredIds = (data || [])
    .filter((session) => isExpiredAt(session.expires_at))
    .map((session) => session.id);

  if (expiredIds.length === 0) {
    return 0;
  }

  const { error: updateError } = await supabase
    .from(ADMIN_SESSIONS_TABLE)
    .update({
      revoked_at: new Date().toISOString(),
    })
    .in("id", expiredIds);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return expiredIds.length;
}

export async function getAdminSessions(req) {
  const currentToken =
    req?.cookies.get(COOKIE_NAME)?.value;

  const currentTokenHash = currentToken
    ? hashToken(currentToken)
    : null;

  await revokeExpiredAdminSessions();

  const { data, error } = await supabase
    .from(ADMIN_SESSIONS_TABLE)
    .select("id,user_agent,ip,device_name,location,created_at,last_active,expires_at,token_hash,access_role")
    .is("revoked_at", null)
    .order("last_active", {
      ascending: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((session) => ({
    id: session.id,
    user_agent: session.user_agent,
    ip: session.ip,
    device_name: session.device_name,
    location: session.location,
    created_at: session.created_at,
    last_active: session.last_active,
    expires_at: session.expires_at,
    access_role: resolveAdminAccessRole(session.access_role),
    current: Boolean(currentTokenHash && session.token_hash === currentTokenHash),
  }));
}

export async function revokeAdminSession(id) {
  const { error } = await supabase
    .from(ADMIN_SESSIONS_TABLE)
    .update({
      revoked_at:
        new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}
