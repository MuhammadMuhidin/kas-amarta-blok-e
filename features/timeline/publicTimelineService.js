import { withMediaPostUrls } from "@/lib/mediaUrl";
import {
  getPublishedTimelinePostById,
  likeTimelinePost,
  listPublishedTimelinePosts,
  setTimelinePostReaction,
} from "@/lib/timelineRepository";

export async function getPublicTimelinePosts(searchParams) {
  const postId = String(searchParams.get("post") || "").trim();

  if (postId) {
    const post = await getPublishedTimelinePostById(postId);

    return { ok: true, post: withMediaPostUrls(post) };
  }

  const limit = Number(searchParams.get("limit") || 8);
  const offset = Number(searchParams.get("offset") || 0);
  const result = await listPublishedTimelinePosts({ limit, offset });

  return {
    ok: true,
    ...result,
    posts: Array.isArray(result.posts) ? result.posts.map(withMediaPostUrls) : [],
  };
}

export async function savePublicTimelineReaction({ postId, body }) {
  const visitorId = String(body.visitor_id || "").trim();
  const reactionType = String(body.reaction_type || "").trim();

  if (!visitorId) {
    return {
      status: 400,
      body: { error: "Visitor ID wajib dikirim" },
    };
  }

  const result = reactionType
    ? await setTimelinePostReaction(postId, visitorId, reactionType)
    : await likeTimelinePost(postId, visitorId);

  return {
    status: 200,
    body: { ok: true, ...result },
  };
}
