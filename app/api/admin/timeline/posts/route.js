import { NextResponse } from "next/server";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { createTimelinePost, listAdminTimelinePosts } from "@/lib/timelineRepository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizePayload(body = {}) {
  const title = normalizeText(body.title);
  const description = normalizeText(body.description);

  if (!title) {
    throw new Error("Judul kegiatan wajib diisi");
  }

  return {
    title,
    description,
    category: normalizeText(body.category),
    event_date: normalizeText(body.event_date) || null,
    cover_image_key: normalizeText(body.cover_image_key),
    cover_image_url: normalizeText(body.cover_image_url),
    published: body.published === true,
  };
}

export async function GET(req) {
  try {
    if (!(await isAdmin(req))) {
      return unauthorized();
    }

    const posts = await listAdminTimelinePosts({ limit: 50 });

    return NextResponse.json({ ok: true, posts });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal membaca data kegiatan" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    if (!(await isAdmin(req))) {
      return unauthorized();
    }

    if (!validateCSRF(req)) {
      return NextResponse.json({ error: "CSRF tidak valid" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const post = await createTimelinePost(normalizePayload(body));

    return NextResponse.json({ ok: true, post });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal membuat kegiatan" }, { status: 500 });
  }
}
