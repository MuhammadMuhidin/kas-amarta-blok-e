import { NextResponse } from "next/server";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { openWaMessageStream } from "@/lib/waClient";
import { isWhatsAppServicesEnabled } from "@/lib/webauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getTestChatId() {
  return String(
    process.env.WA_TEST_CHAT_ID
      || process.env.WA_ALERT_CHAT_ID
      || process.env.WA_ERROR_CHAT_ID
      || "",
  ).trim();
}

function normalizePhoneNumber(value) {
  let phone = String(value || "").replace(/\D/g, "");
  if (phone.startsWith("0")) phone = `62${phone.slice(1)}`;
  if (phone.startsWith("620")) phone = `62${phone.slice(3)}`;
  return phone;
}

export async function POST(req) {
  try {
    if (!(await isAdmin(req))) return unauthorized();
    if (!validateCSRF(req)) {
      return NextResponse.json({ error: "CSRF tidak valid" }, { status: 403 });
    }
    if (!(await isWhatsAppServicesEnabled())) {
      return NextResponse.json(
        { error: "WhatsApp Services sedang dinonaktifkan dari Settings." },
        { status: 409 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const phoneNumber = normalizePhoneNumber(body.phoneNumber);
    const period = String(body.period || "-").trim();
    const chatId = getTestChatId();

    if (!/^62\d{8,13}$/.test(phoneNumber)) {
      return NextResponse.json(
        { error: "Nomor WhatsApp harus menggunakan kode negara 62 dan terdiri dari 10–15 digit." },
        { status: 400 },
      );
    }

    if (!chatId) {
      return NextResponse.json(
        { error: "WA_TEST_CHAT_ID atau WA_ALERT_CHAT_ID belum dikonfigurasi." },
        { status: 500 },
      );
    }

    const upstream = await openWaMessageStream({
      chatId,
      text: `Uji notifikasi WhatsApp Sistem Kas Amarta Residence Blok E (${period}).`,
      source: "admin-test-whatsapp-api",
      phoneNumber,
      pairType: "CODE",
    });

    return new Response(upstream.response.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-WA-Session-Id": upstream.sessionId,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Gagal mengirim test WhatsApp" },
      { status: 500 },
    );
  }
}
