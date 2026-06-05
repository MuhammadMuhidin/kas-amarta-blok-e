import { NextResponse } from "next/server";

import { recordAdminActivity } from "@/lib/adminActivity";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import {
  enforceRateLimit,
  RATE_LIMIT_SCOPES,
} from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const DEFAULT_PAYMENT_REMINDER_MESSAGE = [
  "Assalamu’alaikum bapak/ibu warga Amarta Residence 2 Blok E.",
  "",
  "Izin mengingatkan bahwa pembayaran kas dan sampah bulan ini jatuh tempo hari ini. Bagi bapak/ibu yang belum melakukan pembayaran, mohon dapat segera melakukan pembayaran.",
  "",
  "Terima kasih 🙏",
  "@semua",
].join("\n");

function clean(value) {
  return String(value || "").trim();
}

function firstEnv(...keys) {
  for (const key of keys) {
    const value = clean(process.env[key]);
    if (value) return value;
  }

  return "";
}

function readConfig() {
  const endpoint = firstEnv(
    "WHATSAPP_REPORT_ENDPOINT",
    "WHATSAPP_API_URL",
    "WHATSAPP_REMINDER_ENDPOINT",
  );
  const groupId = firstEnv(
    "WHATSAPP_REPORT_GROUP_ID",
    "WHATSAPP_GROUP_ID",
    "WHATSAPP_REMINDER_GROUP_ID",
  );
  const session = firstEnv(
    "WHATSAPP_REPORT_SESSION",
    "WHATSAPP_SESSION",
    "WHATSAPP_REMINDER_SESSION",
  ) || "default";
  const token = firstEnv(
    "WHATSAPP_REPORT_TOKEN",
    "WHATSAPP_API_TOKEN",
  );

  if (!endpoint) {
    throw new Error("Endpoint WhatsApp report belum dikonfigurasi.");
  }

  if (!groupId) {
    throw new Error("Group ID WhatsApp report belum dikonfigurasi.");
  }

  return { endpoint, groupId, session, token };
}

function buildHeaders(token) {
  const headers = { "Content-Type": "application/json" };

  if (token) {
    headers.Authorization = token;
  }

  return headers;
}

async function deliverReminder(message) {
  const { endpoint, groupId, session, token } = readConfig();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: buildHeaders(token),
    body: JSON.stringify({ chatId: groupId, text: message, message, session }),
  });
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(responseText || "Gagal mengirim WhatsApp reminder.");
  }

  return { ok: true };
}

export async function POST(req) {
  if (!(await isAdmin(req))) return unauthorized();

  if (!validateCSRF(req)) {
    return NextResponse.json({ error: "Invalid CSRF" }, { status: 403 });
  }

  const limit = await enforceRateLimit(
    req,
    RATE_LIMIT_SCOPES.whatsappPaymentReminder,
    { identity: "session", targetId: "payment-reminder" },
  );
  if (limit) return limit;

  const body = await req.json().catch(() => ({}));
  const message = clean(body.message) || DEFAULT_PAYMENT_REMINDER_MESSAGE;

  await deliverReminder(message);

  await recordAdminActivity(req, {
    type: "send",
    module: "whatsapp",
    severity: "success",
    message: "Send payment reminder WhatsApp",
    metadata: { target: "resident_group", message_length: message.length },
  });

  return NextResponse.json({ success: true });
}
