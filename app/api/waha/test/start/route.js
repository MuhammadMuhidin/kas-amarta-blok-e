import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { isWhatsAppServicesEnabled } from "@/lib/webauth";
import { getWhatsAppWorkflowDefaults, triggerWhatsAppWorkflow } from "@/lib/whatsappWorkflow";
import { appendWhatsAppTestEvent, createWhatsAppTestCallbackToken, initializeWhatsAppTestState } from "@/lib/whatsappTestState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizePhoneNumber(value) {
  let phone = String(value || "").replace(/\D/g, "");
  if (phone.startsWith("0")) phone = `62${phone.slice(1)}`;
  if (phone.startsWith("620")) phone = `62${phone.slice(3)}`;
  return phone;
}

function getPublicOrigin(req) {
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedHost) return `${forwardedProto || "https"}://${forwardedHost}`;
  return new URL(req.url).origin;
}

export async function POST(req) {
  try {
    if (!(await isAdmin(req))) return unauthorized();
    if (!validateCSRF(req)) return NextResponse.json({ error: "CSRF tidak valid" }, { status: 403 });
    if (!(await isWhatsAppServicesEnabled())) {
      return NextResponse.json({ error: "WhatsApp Services sedang dinonaktifkan dari Settings." }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const phoneNumber = normalizePhoneNumber(body.phoneNumber);
    if (!/^62\d{8,13}$/.test(phoneNumber)) {
      return NextResponse.json({ error: "Nomor WhatsApp harus menggunakan kode negara 62 dan terdiri dari 10–15 digit." }, { status: 400 });
    }

    const defaults = getWhatsAppWorkflowDefaults();
    const jobId = randomUUID();
    const period = String(body.period || "-").trim();
    const callbackUrl = new URL("/api/waha/callback", getPublicOrigin(req)).toString();
    const callbackToken = createWhatsAppTestCallbackToken(jobId);

    await initializeWhatsAppTestState(jobId);
    await appendWhatsAppTestEvent(jobId, { status: "QUEUED", message: "Pengujian WhatsApp masuk antrean GitHub Actions.", sessionId: defaults.sessionId });

    await triggerWhatsAppWorkflow({
      jobId,
      mode: "send",
      pairType: "CODE",
      phoneNumber,
      callbackUrl,
      callbackToken,
      chatId: defaults.alertChatId,
      message: `Uji notifikasi WhatsApp Sistem Kas Amarta Residence Blok E (${period}).`,
      period,
      sessionId: defaults.sessionId,
      targetEnv: defaults.targetEnv,
      source: "admin-test-whatsapp",
    });

    return NextResponse.json({ ok: true, jobId, sessionId: defaults.sessionId, message: "Pengujian WhatsApp dimulai." });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Gagal memulai pengujian WhatsApp" }, { status: 500 });
  }
}
