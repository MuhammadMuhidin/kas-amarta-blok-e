import crypto from "crypto";
import { supabase } from "@/lib/supabase";
import { recordAdminActivity } from "@/lib/adminActivity";

const COOKIE_NAME = "admin_session";

export function getSessionCookieName() {
  return COOKIE_NAME;
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
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

function decodeHeaderValue(value) {
  if (!value) return "";

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getLocation(req) {
  const city =
    decodeHeaderValue(req.headers.get("x-vercel-ip-city")) ||
    decodeHeaderValue(req.headers.get("cf-ipcity"));

  const country =
    decodeHeaderValue(req.headers.get("x-vercel-ip-country")) ||
    decodeHeaderValue(req.headers.get("cf-ipcountry"));

  if (city && country) return `${city}, ${country}`;
  if (city) return city;
  if (country) return country;

  return null;
}

export async function createAdminSession(req) {
  const token = generateToken();

  const userAgent =
    req.headers.get("user-agent") ||
    "Unknown device";

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;

  const deviceName = getDeviceName(userAgent);
  const location = getLocation(req);

  const { error } = await supabase
    .from("admin_sessions")
    .insert({
      token_hash: token,
      user_agent: userAgent,
      ip,
      device_name: deviceName,
      location,
    });

  if (error) {
    throw new Error(error.message);
  }

  await recordAdminActivity(req, {
    type: "login",
    module: "session",
    severity: "success",
    message: "Admin login success",
    metadata: {
      device_name: deviceName,
      ip,
      location,
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

export async function getAdminSessions(req) {
  const currentToken =
    req?.cookies.get(COOKIE_NAME)?.value;

  const { data, error } = await supabase
    .from("admin_sessions")
    .select("id,user_agent,ip,device_name,location,created_at,last_active,token_hash")
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
    current: Boolean(currentToken && session.token_hash === currentToken),
  }));
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
