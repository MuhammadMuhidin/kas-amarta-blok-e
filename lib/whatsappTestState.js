import crypto from "crypto";
import { dbTable } from "@/lib/dbTable";
import { supabase } from "@/lib/supabase";

const APP_CONFIG_TABLE = dbTable("app_config");
const JOB_PREFIX = "wa_test_job:";
const TOKEN_TTL_MS = 30 * 60 * 1000;
const MAX_EVENTS = 40;

function clean(value) {
  return String(value || "").trim();
}

function getSecret() {
  const secret = clean(process.env.GITHUB_ACTIONS_TOKEN);
  if (!secret) throw new Error("GITHUB_ACTIONS_TOKEN belum dikonfigurasi.");
  return secret;
}

function jobKey(jobId) {
  return `${JOB_PREFIX}${clean(jobId)}`;
}

function safeEqual(left, right) {
  const a = Buffer.from(clean(left));
  const b = Buffer.from(clean(right));
  return Boolean(a.length && a.length === b.length && crypto.timingSafeEqual(a, b));
}

function sign(jobId, expiresAt) {
  return crypto
    .createHmac("sha256", getSecret())
    .update(`${clean(jobId)}.${expiresAt}`)
    .digest("hex");
}

export function createWhatsAppTestCallbackToken(jobId) {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  return `${expiresAt}.${sign(jobId, expiresAt)}`;
}

export function verifyWhatsAppTestCallbackToken(jobId, token) {
  const [expiresRaw, signature] = clean(token).split(".");
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt || !signature) return false;
  return safeEqual(signature, sign(jobId, expiresAt));
}

function parseState(value, jobId) {
  try {
    const parsed = JSON.parse(value || "{}");
    return {
      jobId: clean(parsed.jobId) || clean(jobId),
      events: Array.isArray(parsed.events) ? parsed.events : [],
      createdAt: parsed.createdAt || new Date().toISOString(),
    };
  } catch {
    return { jobId: clean(jobId), events: [], createdAt: new Date().toISOString() };
  }
}

async function writeState(jobId, state) {
  const { error } = await supabase.from(APP_CONFIG_TABLE).upsert(
    {
      key: jobKey(jobId),
      value: JSON.stringify(state),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) throw new Error("Gagal menyimpan status test WhatsApp");
}

export async function initializeWhatsAppTestState(jobId) {
  await writeState(jobId, {
    jobId: clean(jobId),
    events: [],
    createdAt: new Date().toISOString(),
  });
}

export async function appendWhatsAppTestEvent(jobId, event = {}) {
  const current = await getWhatsAppTestState(jobId);
  const nextEvent = {
    ...event,
    status: clean(event.status).toUpperCase() || "INFO",
    receivedAt: new Date().toISOString(),
  };

  const events = [...current.events, nextEvent].slice(-MAX_EVENTS);
  await writeState(jobId, { ...current, events });
  return nextEvent;
}

export async function getWhatsAppTestState(jobId) {
  const { data, error } = await supabase
    .from(APP_CONFIG_TABLE)
    .select("value,updated_at")
    .eq("key", jobKey(jobId))
    .maybeSingle();

  if (error) throw new Error("Gagal membaca status test WhatsApp");
  return {
    ...parseState(data?.value, jobId),
    updatedAt: data?.updated_at || null,
  };
}

export async function removeWhatsAppTestState(jobId) {
  const { error } = await supabase
    .from(APP_CONFIG_TABLE)
    .delete()
    .eq("key", jobKey(jobId));

  if (error) console.error("Gagal menghapus status test WhatsApp", error.message);
}
