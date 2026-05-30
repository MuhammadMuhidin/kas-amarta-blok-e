import { NextResponse } from "next/server";
import { getPublishedTimelinePostById, listPublishedTimelinePosts } from "@/lib/timelineRepository";
import { withMediaPostUrls } from "@/lib/mediaUrl";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

function jsonNoStore(payload, init = {}) {
  const response = NextResponse.json(payload, init);

  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  return response;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const postId = String(searchParams.get("post") || "").trim();

    if (postId) {
      const post = await getPublishedTimelinePostById(postId);

      return jsonNoStore({ ok: true, post: withMediaPostUrls(post) });
    }

    const limit = Number(searchParams.get("limit") || 8);
    const offset = Number(searchParams.get("offset") || 0);
    const result = await listPublishedTimelinePosts({ limit, offset });

    return jsonNoStore({
      ok: true,
      ...result,
      posts: Array.isArray(result.posts) ? result.posts.map(withMediaPostUrls) : [],
    });
  } catch (err) {
    return jsonNoStore({ error: err.message || "Gagal membaca timeline kegiatan" }, { status: 500 });
  }
}
