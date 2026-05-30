import { NextResponse } from "next/server";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { uploadActivityImage } from "@/lib/r2Upload";
import { addTimelineImage, updateTimelinePost } from "@/lib/timelineRepository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeText(value) {
  return String(value || "").trim();
}

export async function POST(req) {
  try {
    if (!(await isAdmin(req))) {
      return unauthorized();
    }

    if (!validateCSRF(req)) {
      return NextResponse.json({ error: "CSRF tidak valid" }, { status: 403 });
    }

    const form = await req.formData();
    const files = form.getAll("images").filter(Boolean);
    const singleFile = form.get("image");
    const postId = normalizeText(form.get("post_id"));
    const caption = normalizeText(form.get("caption"));
    const sortOrder = Number(form.get("sort_order") || 0);
    const setAsCover = form.get("set_as_cover") === "true";
    const uploadFiles = files.length > 0 ? files : singleFile ? [singleFile] : [];

    if (!postId) {
      return NextResponse.json({ error: "Post ID wajib dikirim" }, { status: 400 });
    }

    if (!uploadFiles.length) {
      return NextResponse.json({ error: "Pilih foto kegiatan terlebih dahulu" }, { status: 400 });
    }

    const images = [];

    for (const [index, file] of uploadFiles.entries()) {
      const uploaded = await uploadActivityImage(file, { postId });
      const image = await addTimelineImage({
        post_id: postId,
        image_key: uploaded.key,
        image_url: uploaded.url,
        caption,
        sort_order: (Number.isFinite(sortOrder) ? sortOrder : 0) + index,
      });

      images.push(image);

      if (setAsCover && index === 0) {
        await updateTimelinePost(postId, {
          cover_image_key: uploaded.key,
          cover_image_url: uploaded.url,
        });
      }
    }

    return NextResponse.json({ ok: true, image: images[0], images });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal mengunggah foto kegiatan" }, { status: 500 });
  }
}
