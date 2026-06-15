import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getWhatsAppTestState } from "@/lib/whatsappTestState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    if (!(await isAdmin(req))) return unauthorized();

    const jobId = new URL(req.url).searchParams.get("jobId")?.trim() || "";
    if (!jobId) {
      return NextResponse.json({ error: "Job ID wajib diisi" }, { status: 400 });
    }

    const state = await getWhatsAppTestState(jobId);
    return NextResponse.json({ ok: true, ...state });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Gagal membaca status test WhatsApp" },
      { status: 500 },
    );
  }
}
