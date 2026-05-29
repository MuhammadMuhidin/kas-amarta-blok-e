import { NextResponse } from "next/server";
import { listPublishedTimelinePosts } from "@/lib/timelineRepository";

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
    const limit = Number(searchParams.get("limit") || 8);
    const offset = Number(searchParams.get("offset") || 0);
    const result = await listPublishedTimelinePosts({ limit, offset });

    return jsonNoStore({ ok: true, ...result });
  } catch (err) {
    return jsonNoStore({ error: err.message || "Gagal membaca timeline kegiatan" }, { status: 500 });
  }
}
