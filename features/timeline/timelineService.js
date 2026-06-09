import { uploadActivityImage } from "@/lib/r2Upload";
import { withMediaPostUrls } from "@/lib/mediaUrl";
import {
  addTimelineImage,
  createTimelinePost,
  deleteTimelineImage,
  deleteTimelinePost,
  getTimelineImageById,
  listAdminTimelinePosts,
  updateTimelineImage,
  updateTimelinePost,
} from "@/lib/timelineRepository";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeCreatePostPayload(body = {}) {
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

function normalizeUpdatePostPayload(body = {}) {
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

function normalizeImagePayload(body = {}) {
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

export async function listTimelinePosts() {
  const posts = await listAdminTimelinePosts({ limit: 50 });

  return { ok: true, posts: posts.map(withMediaPostUrls) };
}

export async function createTimelinePostFromBody(body) {
  const post = await createTimelinePost(normalizeCreatePostPayload(body));

  return { ok: true, post: withMediaPostUrls(post) };
}

export async function updateTimelinePostFromBody(id, body) {
  const post = await updateTimelinePost(id, normalizeUpdatePostPayload(body));

  return { ok: true, post };
}

export async function deleteTimelinePostById(id) {
  await deleteTimelinePost(id);

  return { ok: true };
}

export async function uploadTimelineImagesFromForm(form) {
  const files = form.getAll("images").filter(Boolean);
  const singleFile = form.get("image");
  const postId = normalizeText(form.get("post_id"));
  const caption = normalizeText(form.get("caption"));
  const sortOrder = Number(form.get("sort_order") || 0);
  const setAsCover = form.get("set_as_cover") === "true";
  const uploadFiles = files.length > 0 ? files : singleFile ? [singleFile] : [];

  if (!postId) {
    return { status: 400, body: { error: "Post ID wajib dikirim" } };
  }

  if (!uploadFiles.length) {
    return { status: 400, body: { error: "Pilih foto kegiatan terlebih dahulu" } };
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

  return { status: 200, body: { ok: true, image: images[0], images } };
}

export async function updateTimelineImageFromBody(id, body) {
  const payload = normalizeImagePayload(body);
  const shouldSetAsCover = body.set_as_cover === true;
  const image = Object.keys(payload).length > 0
    ? await updateTimelineImage(id, payload)
    : await getTimelineImageById(id);

  if (shouldSetAsCover) {
    await updateTimelinePost(image.post_id, {
      cover_image_key: image.image_key,
      cover_image_url: image.image_url,
    });
  }

  return { ok: true, image };
}

export async function deleteTimelineImageById(id) {
  const image = await deleteTimelineImage(id);

  return { ok: true, image };
}
