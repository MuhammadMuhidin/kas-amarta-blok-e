import { NextResponse } from "next/server";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { deleteTimelinePost, updateTimelinePost } from "@/lib/timelineRepository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizePayload(body = {}) {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    const title = normalizeText(body.title);

    if (!title) {
      throw new Error("Judul kegiatan wajib diisi");
    }

    payload.title = title;
  }

  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    payload.description = normalizeText(body.description);
  }

  if (Object.prototype.hasOwnProperty.call(body, "category")) {
    payload.category = normalizeText(body.category);
  }

  if (Object.prototype.hasOwnProperty.call(body, "event_date")) {
    payload.event_date = normalizeText(body.event_date) || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "cover_image_key")) {
    payload.cover_image_key = normalizeText(body.cover_image_key);
  }

  if (Object.prototype.hasOwnProperty.call(body, "cover_image_url")) {
    payload.cover_image_url = normalizeText(body.cover_image_url);
  }

  if (Object.prototype.hasOwnProperty.call(body, "published")) {
    payload.published = body.published === true;
  }

  return payload;
}

export async function PATCH(req, { params }) {
  try {
    if (!(await isAdmin(req))) {
      return unauthorized();
    }

    if (!validateCSRF(req)) {
      return NextResponse.json({ error: "CSRF tidak valid" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const post = await updateTimelinePost(params.id, normalizePayload(body));

    return NextResponse.json({ ok: true, post });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal memperbarui kegiatan" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    if (!(await isAdmin(req))) {
      return unauthorized();
    }

    if (!validateCSRF(req)) {
      return NextResponse.json({ error: "CSRF tidak valid" }, { status: 403 });
    }

    await deleteTimelinePost(params.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal menghapus kegiatan" }, { status: 500 });
  }
}
