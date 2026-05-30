import { NextResponse } from "next/server";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { deleteTimelineImage, getTimelineImageById, updateTimelineImage, updateTimelinePost } from "@/lib/timelineRepository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizePayload(body = {}) {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(body, "caption")) {
    payload.caption = normalizeText(body.caption);
  }

  if (Object.prototype.hasOwnProperty.call(body, "sort_order")) {
    const sortOrder = Number(body.sort_order);
    payload.sort_order = Number.isFinite(sortOrder) ? sortOrder : 0;
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
    const payload = normalizePayload(body);
    const shouldSetAsCover = body.set_as_cover === true;
    const image = Object.keys(payload).length > 0
      ? await updateTimelineImage(params.id, payload)
      : await getTimelineImageById(params.id);

    if (shouldSetAsCover) {
      await updateTimelinePost(image.post_id, {
        cover_image_key: image.image_key,
        cover_image_url: image.image_url,
      });
    }

    return NextResponse.json({ ok: true, image });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal memperbarui foto kegiatan" }, { status: 500 });
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

    const image = await deleteTimelineImage(params.id);

    return NextResponse.json({ ok: true, image });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal menghapus foto kegiatan" }, { status: 500 });
  }
}
