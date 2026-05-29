import { createHash } from "crypto";
import { dbTable } from "@/lib/dbTable";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

const POSTS_TABLE = dbTable("activity_posts");
const IMAGES_TABLE = dbTable("activity_images");
const LIKES_TABLE = dbTable("activity_likes");
const REACTIONS_TABLE = dbTable("activity_post_reactions");

const REACTION_TYPES = ["like", "care", "thanks", "appreciate", "informative"];
const REACTION_TYPE_SET = new Set(REACTION_TYPES);

function createEmptyReactionCounts() {
  return REACTION_TYPES.reduce((counts, type) => ({ ...counts, [type]: 0 }), {});
}

function normalizeReactionType(type = "") {
  const value = String(type || "").trim();

  if (!REACTION_TYPE_SET.has(value)) {
    throw new Error("Tipe reaction tidak valid");
  }

  return value;
}

function normalizePost(row = {}) {
  const reactionCounts = row.reaction_counts || createEmptyReactionCounts();
  const reactionTotal = Number(row.reaction_total ?? row.like_count ?? 0);

  return {
    id: row.id,
    title: row.title || "",
    description: row.description || "",
    category: row.category || "",
    event_date: row.event_date || "",
    cover_image_key: row.cover_image_key || "",
    cover_image_url: row.cover_image_url || "",
    like_count: reactionTotal,
    reaction_total: reactionTotal,
    reaction_counts: {
      ...createEmptyReactionCounts(),
      ...reactionCounts,
    },
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

function buildReactionMap(reactions = []) {
  const reactionMap = new Map();

  reactions.forEach((reaction) => {
    const postId = reaction.post_id;
    const reactionType = reaction.reaction_type;

    if (!postId || !REACTION_TYPE_SET.has(reactionType)) return;

    const current = reactionMap.get(postId) || createEmptyReactionCounts();
    current[reactionType] = Number(current[reactionType] || 0) + 1;
    reactionMap.set(postId, current);
  });

  return reactionMap;
}

function getReactionTotal(counts = {}) {
  return REACTION_TYPES.reduce((total, type) => total + Number(counts[type] || 0), 0);
}

function attachImagesAndReactions(posts = [], images = [], reactions = []) {
  const imageMap = new Map();
  const reactionMap = buildReactionMap(reactions);

  images.forEach((image) => {
    const normalized = normalizeImage(image);
    const list = imageMap.get(normalized.post_id) || [];
    list.push(normalized);
    imageMap.set(normalized.post_id, list);
  });

  return posts.map((post) => {
    const reactionCounts = reactionMap.get(post.id) || createEmptyReactionCounts();
    const reactionTotal = getReactionTotal(reactionCounts);

    return {
      ...normalizePost({
        ...post,
        reaction_counts: reactionCounts,
        reaction_total: reactionTotal || Number(post.like_count || 0),
      }),
      images: (imageMap.get(post.id) || []).sort((a, b) => a.sort_order - b.sort_order),
    };
  });
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

async function listReactionsForPosts(supabase, postIds = []) {
  if (!postIds.length) return [];

  const { data, error } = await supabase
    .from(REACTIONS_TABLE)
    .select("post_id,reaction_type")
    .in("post_id", postIds);

  if (error) {
    throw new Error(error.message || "Gagal membaca reaction kegiatan");
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
  const postIds = posts.map((post) => post.id);
  const images = await listImagesForPosts(supabase, postIds);
  const reactions = await listReactionsForPosts(supabase, postIds);

  return {
    posts: attachImagesAndReactions(posts, images, reactions),
    total: count || 0,
    limit: safeLimit,
    offset: safeOffset,
    nextOffset: safeOffset + posts.length,
    hasMore: safeOffset + posts.length < (count || 0),
  };
}

export async function getPublishedTimelinePostById(id) {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from(POSTS_TABLE)
    .select("*")
    .eq("id", id)
    .eq("published", true)
    .single();

  if (error) {
    throw new Error(error.message || "Gagal membaca kegiatan");
  }

  const images = await listImagesForPosts(supabase, [id]);
  const reactions = await listReactionsForPosts(supabase, [id]);

  return attachImagesAndReactions([data], images, reactions)[0] || null;
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
  const postIds = posts.map((post) => post.id);
  const images = await listImagesForPosts(supabase, postIds);
  const reactions = await listReactionsForPosts(supabase, postIds);

  return attachImagesAndReactions(posts, images, reactions);
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

async function getPostReactionResult(supabase, postId, currentReaction = "") {
  const reactions = await listReactionsForPosts(supabase, [postId]);
  const reactionCounts = buildReactionMap(reactions).get(postId) || createEmptyReactionCounts();
  const reactionTotal = getReactionTotal(reactionCounts);

  const { error: updateError } = await supabase
    .from(POSTS_TABLE)
    .update({ like_count: reactionTotal, updated_at: new Date().toISOString() })
    .eq("id", postId);

  if (updateError) {
    throw new Error(updateError.message || "Gagal memperbarui jumlah reaction");
  }

  return {
    reaction_type: currentReaction,
    current_reaction: currentReaction,
    reaction_counts: reactionCounts,
    reaction_total: reactionTotal,
    like_count: reactionTotal,
  };
}

export async function setTimelinePostReaction(postId, visitorId, reactionType) {
  const supabase = getSupabaseServerClient();
  const visitorIdHash = hashVisitorId(visitorId);
  const nextReactionType = normalizeReactionType(reactionType);

  const { data: existingReaction, error: existingError } = await supabase
    .from(REACTIONS_TABLE)
    .select("id,reaction_type")
    .eq("post_id", postId)
    .eq("visitor_id_hash", visitorIdHash)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message || "Gagal membaca reaction");
  }

  if (existingReaction?.reaction_type === nextReactionType) {
    return getPostReactionResult(supabase, postId, nextReactionType);
  }

  if (existingReaction?.id) {
    const { error: updateError } = await supabase
      .from(REACTIONS_TABLE)
      .update({ reaction_type: nextReactionType, updated_at: new Date().toISOString() })
      .eq("id", existingReaction.id);

    if (updateError) {
      throw new Error(updateError.message || "Gagal mengganti reaction");
    }

    return getPostReactionResult(supabase, postId, nextReactionType);
  }

  const { error: insertError } = await supabase
    .from(REACTIONS_TABLE)
    .insert({
      post_id: postId,
      visitor_id_hash: visitorIdHash,
      reaction_type: nextReactionType,
    });

  if (insertError) {
    throw new Error(insertError.message || "Gagal menyimpan reaction");
  }

  return getPostReactionResult(supabase, postId, nextReactionType);
}

export async function likeTimelinePost(postId, visitorId) {
  const supabase = getSupabaseServerClient();
  const visitorIdHash = hashVisitorId(visitorId);

  const { error: likeError } = await supabase
    .from(LIKES_TABLE)
    .insert({ post_id: postId, visitor_id_hash: visitorIdHash });

  if (likeError && likeError.code !== "23505") {
    throw new Error(likeError.message || "Gagal menyimpan like");
  }

  const result = await setTimelinePostReaction(postId, visitorId, "like");

  return {
    ...result,
    liked: result.current_reaction === "like",
    duplicate: likeError?.code === "23505",
  };
}
