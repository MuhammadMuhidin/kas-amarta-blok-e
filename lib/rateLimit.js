import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getSessionCookieName } from "@/lib/adminSession";
import { dbTable } from "@/lib/dbTable";

const RATE_LIMITS_TABLE = dbTable("security_rate_limits");

let rateLimitClient = null;

function getRateLimitClient() {
  if (rateLimitClient) return rateLimitClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi untuk rate limit");
  }

  rateLimitClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: (url, options) => fetch(url, {
        ...options,
        cache: "no-store",
      }),
    },
  });

  return rateLimitClient;
}

export const RATE_LIMIT_SCOPES = {
  loginPasswordFailed: "login_password_failed",
  loginPinFailed: "login_pin_failed",
  webauthVerifyFailed: "webauth_verify_failed",
  settingsUpdate: "settings_update",
  settingsPinFailed: "settings_pin_failed",
  sessionRevoke: "session_revoke",
  paymentCreate: "payment_create",
  paymentBulkCreate: "payment_bulk_create",
  paymentProofSubmit: "payment_proof_submit",
  paymentProofReview: "payment_proof_review",
  depositPayNow: "deposit_pay_now",
  cashflowCreate: "cashflow_create",
  whatsappPaymentReminder: "whatsapp_payment_reminder",
};

export const RATE_LIMIT_RULES = {
  [RATE_LIMIT_SCOPES.loginPasswordFailed]: {
    limit: 5,
    windowSeconds: 10 * 60,
    message: "Terlalu banyak percobaan login. Silakan coba lagi nanti.",
  },
  [RATE_LIMIT_SCOPES.loginPinFailed]: {
    limit: 5,
    windowSeconds: 10 * 60,
    message: "Terlalu banyak percobaan PIN. Silakan coba lagi nanti.",
  },
  [RATE_LIMIT_SCOPES.webauthVerifyFailed]: {
    limit: 10,
    windowSeconds: 10 * 60,
    message: "Terlalu banyak percobaan passkey. Silakan coba lagi nanti.",
  },
  [RATE_LIMIT_SCOPES.settingsUpdate]: {
    limit: 5,
    windowSeconds: 10 * 60,
    message: "Terlalu banyak perubahan settings. Silakan coba lagi nanti.",
  },
  [RATE_LIMIT_SCOPES.settingsPinFailed]: {
    limit: 5,
    windowSeconds: 10 * 60,
    message: "Terlalu banyak percobaan PIN settings. Silakan coba lagi nanti.",
  },
  [RATE_LIMIT_SCOPES.sessionRevoke]: {
    limit: 10,
    windowSeconds: 10 * 60,
    message: "Terlalu banyak permintaan revoke session. Silakan coba lagi nanti.",
  },
  [RATE_LIMIT_SCOPES.paymentCreate]: {
    limit: 20,
    windowSeconds: 60,
    message: "Terlalu banyak input payment. Silakan coba lagi nanti.",
  },
  [RATE_LIMIT_SCOPES.paymentBulkCreate]: {
    limit: 5,
    windowSeconds: 60,
    message: "Terlalu banyak proses bulk payment. Silakan coba lagi nanti.",
  },
  [RATE_LIMIT_SCOPES.paymentProofSubmit]: {
    limit: 3,
    windowSeconds: 10 * 60,
    message: "Terlalu banyak upload bukti transfer. Silakan coba lagi nanti.",
  },
  [RATE_LIMIT_SCOPES.paymentProofReview]: {
    limit: 20,
    windowSeconds: 60,
    message: "Terlalu banyak proses verifikasi bukti transfer. Silakan coba lagi nanti.",
  },
  [RATE_LIMIT_SCOPES.depositPayNow]: {
    limit: 5,
    windowSeconds: 60,
    message: "Terlalu banyak proses booking payment. Silakan coba lagi nanti.",
  },
  [RATE_LIMIT_SCOPES.cashflowCreate]: {
    limit: 10,
    windowSeconds: 60,
    message: "Terlalu banyak input cashflow. Silakan coba lagi nanti.",
  },
  [RATE_LIMIT_SCOPES.whatsappPaymentReminder]: {
    limit: 3,
    windowSeconds: 60,
    message: "Terlalu banyak kirim reminder WhatsApp. Silakan coba lagi nanti.",
  },
};

function hash(value) {
  return crypto
    .createHash("sha256")
    .update(String(value || "unknown"))
    .digest("hex")
    .slice(0, 24);
}

function clean(value) {
  return String(value || "").trim();
}

function getRule(scope) {
  const rule = RATE_LIMIT_RULES[scope];

  if (!rule) {
    throw new Error(`Rate limit rule belum dikonfigurasi: ${scope}`);
  }

  return rule;
}

export function getClientIp(req) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function getUserAgent(req) {
  return req.headers.get("user-agent") || "unknown";
}

function getSessionIdentifier(req) {
  const sessionToken = req.cookies.get(getSessionCookieName())?.value;

  if (!sessionToken) return null;

  return `sess_${hash(sessionToken)}`;
}

function getClientIdentifier(req) {
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);

  return `ip_${hash(ip)}:ua_${hash(userAgent)}`;
}

function getIdentifier(req, identity) {
  if (identity === "session") {
    return getSessionIdentifier(req) || getClientIdentifier(req);
  }

  return getClientIdentifier(req);
}

export function buildRateLimitKey(req, scope, options = {}) {
  const identity = options.identity || "client";
  const targetId = clean(options.targetId);
  const identifier = getIdentifier(req, identity);

  return [scope, identifier, targetId ? `target_${hash(targetId)}` : ""]
    .filter(Boolean)
    .join(":");
}

function buildMetadata(req, options = {}) {
  return {
    ip: getClientIp(req),
    user_agent: getUserAgent(req),
    identity: options.identity || "client",
    target_id: clean(options.targetId) || null,
    app_env: process.env.APP_ENV || "unknown",
    platform: process.env.APP_PLATFORM || "local",
  };
}

function normalizeResult(result, fallbackRule) {
  const value = result || {};

  return {
    allowed: value.allowed !== false,
    limit: Number(value.limit || fallbackRule.limit),
    remaining: Number(value.remaining ?? fallbackRule.limit),
    resetAt: value.reset_at || null,
    retryAfter: Number(value.retry_after || 0),
    failOpen: Boolean(value.fail_open),
  };
}

function failOpenResult(rule) {
  return {
    allowed: true,
    limit: rule.limit,
    remaining: rule.limit,
    resetAt: null,
    retryAfter: 0,
    failOpen: true,
  };
}

async function callRateLimitRpc(functionName, payload, rule) {
  let client;

  try {
    client = getRateLimitClient();
  } catch (err) {
    console.error("Rate limit client unavailable:", err.message);
    return failOpenResult(rule);
  }

  const { data, error } = await client.rpc(functionName, payload);

  if (error) {
    console.error(`Rate limit ${functionName} failed:`, error.message);
    return failOpenResult(rule);
  }

  return normalizeResult(data, rule);
}

export async function checkRateLimit(req, scope, options = {}) {
  const rule = getRule(scope);
  const rateKey = buildRateLimitKey(req, scope, options);

  return callRateLimitRpc(
    "app_check_rate_limit",
    {
      p_table_name: RATE_LIMITS_TABLE,
      p_rate_key: rateKey,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    },
    rule,
  );
}

export async function consumeRateLimit(req, scope, options = {}) {
  const rule = getRule(scope);
  const rateKey = buildRateLimitKey(req, scope, options);

  return callRateLimitRpc(
    "app_consume_rate_limit",
    {
      p_table_name: RATE_LIMITS_TABLE,
      p_rate_key: rateKey,
      p_scope: scope,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
      p_metadata: buildMetadata(req, options),
    },
    rule,
  );
}

export async function clearRateLimit(req, scope, options = {}) {
  const rule = getRule(scope);
  const rateKey = buildRateLimitKey(req, scope, options);
  let client;

  try {
    client = getRateLimitClient();
  } catch (err) {
    console.error("Rate limit client unavailable:", err.message);
    return failOpenResult(rule);
  }

  const { error } = await client.rpc("app_clear_rate_limit", {
    p_table_name: RATE_LIMITS_TABLE,
    p_rate_key: rateKey,
  });

  if (error) {
    console.error("Rate limit clear failed:", error.message);
  }

  return failOpenResult(rule);
}

export function createRateLimitResponse(result, message = "Terlalu banyak percobaan. Silakan coba lagi nanti.") {
  const retryAfter = Math.max(Number(result.retryAfter || 0), 1);
  const headers = {
    "Retry-After": String(retryAfter),
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(Math.max(result.remaining, 0)),
  };

  if (result.resetAt) {
    headers["X-RateLimit-Reset"] = String(Math.ceil(new Date(result.resetAt).getTime() / 1000));
  }

  return NextResponse.json(
    {
      error: message,
      retry_after: retryAfter,
    },
    {
      status: 429,
      headers,
    },
  );
}

export async function enforceRateLimit(req, scope, options = {}) {
  const rule = getRule(scope);
  const result = await consumeRateLimit(req, scope, options);

  if (!result.allowed) {
    return createRateLimitResponse(result, rule.message);
  }

  return null;
}

export async function enforceFailureRateLimit(req, scope, options = {}) {
  const rule = getRule(scope);
  const result = await checkRateLimit(req, scope, options);

  if (!result.allowed) {
    return createRateLimitResponse(result, rule.message);
  }

  return null;
}

export async function recordRateLimitFailure(req, scope, options = {}) {
  return consumeRateLimit(req, scope, options);
}
