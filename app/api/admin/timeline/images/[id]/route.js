import { NextResponse } from "next/server";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import {
  deleteTimelineImageById,
  updateTimelineImageFromBody,
} from "@/features/timeline/timelineService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(req, { params }) {
  try {
    if (!(await isAdmin(req))) {
      return unauthorized();
    }

    if (!validateCSRF(req)) {
      return NextResponse.json({ error: "CSRF tidak valid" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const result = await updateTimelineImageFromBody(params.id, body);

    return NextResponse.json(result);
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

    const result = await deleteTimelineImageById(params.id);

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal menghapus foto kegiatan" }, { status: 500 });
  }
}
