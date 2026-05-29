import { NextResponse } from "next/server";
import { likeTimelinePost } from "@/lib/timelineRepository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req, { params }) {
  try {
    const body = await req.json().catch(() => ({}));
    const visitorId = String(body.visitor_id || "").trim();

    if (!visitorId) {
      return NextResponse.json({ error: "Visitor ID wajib dikirim" }, { status: 400 });
    }

    const result = await likeTimelinePost(params.id, visitorId);

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal menyimpan like" }, { status: 500 });
  }
}
