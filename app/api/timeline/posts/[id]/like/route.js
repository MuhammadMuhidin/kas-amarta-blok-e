import { NextResponse } from "next/server";
import { savePublicTimelineReaction } from "@/features/timeline/publicTimelineService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req, { params }) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await savePublicTimelineReaction({ postId: params.id, body });

    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal menyimpan reaction" }, { status: 500 });
  }
}
