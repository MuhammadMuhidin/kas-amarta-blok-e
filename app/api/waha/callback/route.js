import { NextResponse } from "next/server";
import {
  appendWhatsAppTestEvent,
  verifyWhatsAppTestCallbackToken,
} from "@/lib/whatsappTestState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearerToken(req) {
  const authorization = req.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const jobId = String(body.jobId || "").trim();
    const event = body.event && typeof body.event === "object" ? body.event : {};

    if (!jobId || !verifyWhatsAppTestCallbackToken(jobId, bearerToken(req))) {
      return NextResponse.json({ error: "Unauthorized callback" }, { status: 401 });
    }

    await appendWhatsAppTestEvent(jobId, event);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Gagal menyimpan callback WhatsApp" },
      { status: 500 },
    );
  }
}
