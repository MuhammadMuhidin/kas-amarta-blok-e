import { supabase } from "@/lib/supabase";

function clean(value) {
  return String(value || "").trim();
}

function decodeHeaderValue(value) {
  if (!value) return "";

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getBrowser(userAgent) {
  const edge = userAgent.match(/Edg\/(\d+)/);
  const chrome = userAgent.match(/Chrome\/(\d+)/);
  const safari = userAgent.match(/Version\/(\d+).*Safari/);
  const firefox = userAgent.match(/Firefox\/(\d+)/);

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

function getIp(req) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
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

  return "Unknown location";
}

function getPlatform() {
  return process.env.APP_PLATFORM || "local";
}

function buildMetadata(metadata = {}) {
  return {
    ...metadata,
    app_env: process.env.APP_ENV || "unknown",
    platform: getPlatform(),
  };
}

async function insertActivity(payload) {
  const { error } = await supabase
    .from("admin_activities")
    .insert(payload);

  if (error) {
    console.error("Failed record admin activity:", error.message);
  }
}

export async function recordSystemActivity(activity = {}) {
  await insertActivity({
    type: clean(activity.type) || "action",
    module: clean(activity.module) || "system",
    severity: clean(activity.severity) || "info",
    message: clean(activity.message) || "Admin activity recorded",
    metadata: buildMetadata(activity.metadata),
    actor: clean(activity.actor) || "system",
    device_name: clean(activity.device_name) || null,
    ip: clean(activity.ip) || null,
    location: clean(activity.location) || null,
  });
}

export async function recordAdminActivity(req, activity = {}) {
  const userAgent = req.headers.get("user-agent") || "Unknown device";

  await insertActivity({
    type: clean(activity.type) || "action",
    module: clean(activity.module) || "system",
    severity: clean(activity.severity) || "info",
    message: clean(activity.message) || "Admin activity recorded",
    metadata: buildMetadata(activity.metadata),
    actor: clean(activity.actor) || "admin",
    device_name: clean(activity.device_name) || getDeviceName(userAgent),
    ip: clean(activity.ip) || getIp(req),
    location: clean(activity.location) || getLocation(req),
  });
}
