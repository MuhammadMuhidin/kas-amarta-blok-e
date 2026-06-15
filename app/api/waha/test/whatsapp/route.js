import { NextResponse } from "next/server";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { sendWaMessage } from "@/lib/waClient";
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
    const period = String(body.period || "-").trim();
    const chatId = getTestChatId();

    if (!chatId) {
      return NextResponse.json(
        { error: "WA_TEST_CHAT_ID atau WA_ALERT_CHAT_ID belum dikonfigurasi." },
        { status: 500 },
      );
    }

    await sendWaMessage({
      chatId,
      text: `Uji notifikasi WhatsApp Sistem Kas Amarta Residence Blok E (${period}).`,
      source: "admin-test-whatsapp-api",
    });

    return NextResponse.json({
      ok: true,
      channel: "external-api",
      message: "Pesan test WhatsApp berhasil dikirim melalui external API.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Gagal mengirim test WhatsApp" },
      { status: 500 },
    );
  }
}
