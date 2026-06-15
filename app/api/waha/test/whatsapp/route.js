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

function parseSsePayload(block) {
  const data = String(block || "")
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("data:"))
    .map((line) => line.trim().slice(5).trim())
    .join("\n");

  if (!data) return null;

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function normalizePairingCode(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const digits = raw.replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 12) return "";

  return digits.match(/.{1,4}/g)?.join("-") || digits;
}

function findPairingCode(payload) {
  if (!payload || typeof payload !== "object") return "";

  const containers = [
    payload,
    payload.event,
    payload.data,
    payload.result,
    payload.payload,
    payload.details,
    payload.event?.data,
    payload.data?.result,
  ].filter((value) => value && typeof value === "object");

  const keys = [
    "pairingCode",
    "pairing_code",
    "pairCode",
    "pair_code",
    "code",
  ];

  for (const container of containers) {
    for (const key of keys) {
      const code = normalizePairingCode(container[key]);
      if (code) return code;
    }
  }

  const textCandidates = [
    payload.message,
    payload.event?.message,
    payload.data?.message,
    payload.error,
  ];

  for (const value of textCandidates) {
    const match = String(value || "").match(/(?:pairing(?:\s+code)?|kode(?:\s+pairing)?)[^0-9]*(\d[\d\s-]{5,15})/i);
    const code = normalizePairingCode(match?.[1]);
    if (code) return code;
  }

  return "";
}

function normalizeExternalWhatsAppStream(body, sessionId) {
  if (!body) return null;

  const reader = body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let emittedPairingCode = "";

  function processBlock(block, controller) {
    const normalizedBlock = String(block || "").trim();
    if (!normalizedBlock) return;

    controller.enqueue(encoder.encode(`${normalizedBlock}\n\n`));

    const payload = parseSsePayload(normalizedBlock);
    const pairingCode = findPairingCode(payload);
    const status = String(
      payload?.status
        || payload?.event?.status
        || payload?.type
        || "",
    ).toUpperCase();

    if (!pairingCode || pairingCode === emittedPairingCode || status === "PAIRING_CODE") return;

    emittedPairingCode = pairingCode;
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      status: "PAIRING_CODE",
      code: pairingCode,
      message: "Pairing code diterima dari external WhatsApp API.",
      sessionId,
    })}\n\n`));
  }

  return new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

          const blocks = buffer.split(/\r?\n\r?\n/);
          buffer = blocks.pop() || "";
          blocks.forEach((block) => processBlock(block, controller));

          if (done) break;
        }

        processBlock(buffer, controller);
        controller.close();
      } catch (error) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          status: "FAILED",
          message: error.message || "Gagal membaca stream external WhatsApp API.",
          sessionId,
        })}\n\n`));
        controller.close();
      } finally {
        reader.releaseLock();
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
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

    const stream = normalizeExternalWhatsAppStream(
      upstream.response.body,
      upstream.sessionId,
    );

    if (!stream) {
      return NextResponse.json(
        { error: "External WhatsApp API tidak mengembalikan response stream." },
        { status: 502 },
      );
    }

    return new Response(stream, {
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
