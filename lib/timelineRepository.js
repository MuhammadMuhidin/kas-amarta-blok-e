import { createHash } from "crypto";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

const POSTS_TABLE = "activity_posts";
const IMAGES_TABLE = "activity_images";
const LIKES_TABLE = "activity_likes";

function normalizePost(row = {}) {
  return {
    id: row.id,
    title: row.title || "",
    description: row.description || "",
    category: row.category || "",
    event_date: row.event_date || "",
    cover_image_key: row.cover_image_key || "",
    cover_image_url: row.cover_image_url || "",
    like_count: Number(row.like_count || 0),
    published: Boolean(row.published),
    created_at: row.created_at || "",
    updated_at: row.updated_at || "",
  };
}

function normalizeImage(row = {}) {
  return {
    id: row.id,
    post_id: row.post_id,
    image_key: row.image_key || "",
    image_url: row.image_url || "",
    caption: row.caption || "",
    sort_order: Number(row.sort_order || 0),
    created_at: row.created_at || "",
  };
}

function attachImages(posts = [], images = []) {
  const imageMap = new Map();

  images.forEach((image) => {
    const normalized = normalizeImage(image);
    const list = imageMap.get(normalized.post_id) || [];
    list.push(normalized);
    imageMap.set(normalized.post_id, list);
  });

  return posts.map((post) => ({
    ...normalizePost(post),
    images: (imageMap.get(post.id) || []).sort((a, b) => a.sort_order - b.sort_order),
  }));
}

async function listImagesForPosts(supabase, postIds = []) {
  if (!postIds.length) return [];

  const { data, error } = await supabase
    .from(IMAGES_TABLE)
    .select("*")
    .in("post_id", postIds)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message || "Gagal membaca foto kegiatan");
  }

  return data || [];
}

export function hashVisitorId(visitorId = "") {
  const value = String(visitorId || "").trim();

  if (!value) {
    throw new Error("Visitor ID wajib dikirim");
  }

  return createHash("sha256").update(value).digest("hex");
}

export async function listPublishedTimelinePosts({ limit = 8, offset = 0 } = {}) {
  const supabase = getSupabaseServerClient();
  const safeLimit = Math.min(Math.max(Number(limit) || 8, 1), 20);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const from = safeOffset;
  const to = safeOffset + safeLimit - 1;

  const { data, error, count } = await supabase
    .from(POSTS_TABLE)
    .select("*", { count: "exact" })
    .eq("published", true)
    .order("event_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(error.message || "Gagal membaca timeline kegiatan");
  }

  const posts = data || [];
  const images = await listImagesForPosts(supabase, posts.map((post) => post.id));

  return {
    posts: attachImages(posts, images),
    total: count || 0,
    limit: safeLimit,
    offset: safeOffset,
    nextOffset: safeOffset + posts.length,
    hasMore: safeOffset + posts.length < (count || 0),
  };
}

export async function listAdminTimelinePosts({ limit = 50 } = {}) {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from(POSTS_TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message || "Gagal membaca data kegiatan");
  }

  const posts = data || [];
  const images = await listImagesForPosts(supabase, posts.map((post) => post.id));

  return attachImages(posts, images);
}

export async function createTimelinePost(payload) {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from(POSTS_TABLE)
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message || "Gagal membuat kegiatan");
  }

  return normalizePost(data);
}

export async function updateTimelinePost(id, payload) {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from(POSTS_TABLE)
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message || "Gagal memperbarui kegiatan");
  }

  return normalizePost(data);
}

export async function deleteTimelinePost(id) {
  const supabase = getSupabaseServerClient();

  const { error } = await supabase.from(POSTS_TABLE).delete().eq("id", id);

  if (error) {
    throw new Error(error.message || "Gagal menghapus kegiatan");
  }

  return true;
}

export async function addTimelineImage(payload) {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from(IMAGES_TABLE)
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message || "Gagal menyimpan foto kegiatan");
  }

  return normalizeImage(data);
}

export async function likeTimelinePost(postId, visitorId) {
  const supabase = getSupabaseServerClient();
  const visitorIdHash = hashVisitorId(visitorId);

  const { error: likeError } = await supabase
    .from(LIKES_TABLE)
    .insert({ post_id: postId, visitor_id_hash: visitorIdHash });

  if (likeError) {
    if (likeError.code === "23505") {
      return { liked: false, duplicate: true };
    }

    throw new Error(likeError.message || "Gagal menyimpan like");
  }

  const { data, error: postError } = await supabase
    .from(POSTS_TABLE)
    .select("like_count")
    .eq("id", postId)
    .single();

  if (postError) {
    throw new Error(postError.message || "Gagal membaca jumlah like");
  }

  const likeCount = Number(data?.like_count || 0) + 1;

  const { error: updateError } = await supabase
    .from(POSTS_TABLE)
    .update({ like_count: likeCount, updated_at: new Date().toISOString() })
    .eq("id", postId);

  if (updateError) {
    throw new Error(updateError.message || "Gagal memperbarui jumlah like");
  }

  return { liked: true, duplicate: false, like_count: likeCount };
}
