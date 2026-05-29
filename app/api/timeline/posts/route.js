import { NextResponse } from "next/server";
import { listPublishedTimelinePosts } from "@/lib/timelineRepository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const posts = await listPublishedTimelinePosts({ limit: 20 });

    return NextResponse.json({ ok: true, posts });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal membaca timeline kegiatan" }, { status: 500 });
  }
}
