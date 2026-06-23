"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

const VISITOR_ID_KEY = "amarta_timeline_visitor_id";
const REACTION_POSTS_KEY = "amarta_timeline_reactions";
const LEGACY_LIKED_POSTS_KEY = "amarta_timeline_liked_posts";
const READ_POSTS_KEY = "amarta_timeline_read_posts";
const GALLERY_SWIPE_THRESHOLD = 42;
const DESCRIPTION_PREVIEW_LIMIT = 180;
const TIMELINE_PAGE_SIZE = 6;
const HIGHLIGHT_DELAY = 1800;

const REACTIONS = [
  { type: "like", emoji: "👍", label: "Suka" },
  { type: "care", emoji: "❤️", label: "Peduli" },
  { type: "thanks", emoji: "🙏", label: "Terima kasih" },
  { type: "appreciate", emoji: "👏", label: "Apresiasi" },
  { type: "informative", emoji: "💡", label: "Informatif" },
];

const DEFAULT_REACTION = REACTIONS[0];

const timelineNavCss = `
  .timeline-page {
    padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px)) !important;
  }

  .timeline-hero-actions {
    display: none !important;
  }

  .timeline-story-rail {
    width: min(100%, 940px);
    margin: 0 auto 18px;
    padding: 10px 2px 12px;
    display: flex;
    gap: 12px;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .timeline-story-rail::-webkit-scrollbar {
    display: none;
  }

  .timeline-story-item {
    flex: 0 0 76px;
    width: 76px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--text);
    display: grid;
    justify-items: center;
    gap: 7px;
    cursor: pointer;
  }

  .timeline-story-ring {
    width: 68px;
    height: 68px;
    padding: 3px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, var(--border) 76%, transparent);
    transition: 0.18s ease;
  }

  .timeline-story-item.unread .timeline-story-ring {
    background: repeating-conic-gradient(from 0deg, var(--primary) 0deg 16deg, transparent 16deg 26deg);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 13%, transparent);
  }

  .timeline-story-item.read .timeline-story-ring {
    opacity: 0.66;
  }

  .timeline-story-ring img,
  .timeline-story-ring > span {
    width: 100%;
    height: 100%;
    border: 3px solid var(--surface);
    border-radius: 999px;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 68%, var(--success)));
    color: var(--tab-active-text);
    object-fit: cover;
    font-size: 22px;
    font-weight: 950;
  }

  .timeline-story-item small {
    width: 100%;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
    font-weight: 850;
    text-align: center;
  }

  .timeline-story-item:hover .timeline-story-ring {
    transform: translateY(-2px) scale(1.02);
  }

  .timeline-bottom-nav {
    position: fixed;
    left: 50%;
    bottom: max(12px, env(safe-area-inset-bottom, 0px));
    z-index: 9000;
    width: min(430px, calc(100vw - 28px));
    min-height: 64px;
    padding: 8px 10px;
    border: 1px solid color-mix(in srgb, var(--primary) 16%, var(--border));
    border-radius: 999px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
    background: color-mix(in srgb, var(--surface) 86%, transparent);
    box-shadow: 0 22px 54px rgba(15, 23, 42, 0.16), var(--shadow-soft);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    transform: translateX(-50%);
  }

  .timeline-bottom-nav-item {
    min-width: 0;
    min-height: 48px;
    padding: 5px 8px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--muted);
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    text-decoration: none;
    cursor: pointer;
    transition: 0.18s ease;
  }

  .timeline-bottom-nav-item span {
    min-width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--text);
    font-size: 18px;
    font-weight: 950;
    line-height: 1;
  }

  .timeline-bottom-nav-item strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
    font-weight: 950;
    line-height: 1.1;
  }

  .timeline-bottom-nav-item:hover,
  .timeline-bottom-nav-item:focus-visible {
    background: color-mix(in srgb, var(--primary) 11%, transparent);
    color: var(--text);
    outline: none;
  }

  .timeline-bottom-nav-item:active {
    transform: scale(0.96);
  }

  body:has(.timeline-page) .public-theme-button {
    width: 1px !important;
    height: 1px !important;
    min-width: 1px !important;
    min-height: 1px !important;
    padding: 0 !important;
    border: 0 !important;
    clip: rect(0 0 0 0) !important;
    clip-path: inset(50%) !important;
    overflow: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
  }

  @media (max-width: 700px) {
    .timeline-story-rail {
      width: 100%;
      margin-bottom: 12px;
    }

    .timeline-story-item {
      flex-basis: 68px;
      width: 68px;
    }

    .timeline-story-ring {
      width: 60px;
      height: 60px;
    }
  }
`;

function createVisitorId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();

  return `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getVisitorId() {
  if (typeof window === "undefined") return "";

  const existing = window.localStorage.getItem(VISITOR_ID_KEY);
  if (existing) return existing;

  const next = createVisitorId();
  window.localStorage.setItem(VISITOR_ID_KEY, next);
  return next;
}

function readReactionMap() {
  if (typeof window === "undefined") return {};

  try {
    const parsed = JSON.parse(window.localStorage.getItem(REACTION_POSTS_KEY) || "{}");
    const validTypes = new Set(REACTIONS.map((reaction) => reaction.type));
    const nextMap = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};

    try {
      const legacyLikedIds = JSON.parse(window.localStorage.getItem(LEGACY_LIKED_POSTS_KEY) || "[]");

      if (Array.isArray(legacyLikedIds)) {
        legacyLikedIds.filter(Boolean).forEach((postId) => {
          if (!nextMap[postId]) nextMap[postId] = DEFAULT_REACTION.type;
        });
      }
    } catch {
      // Ignore legacy liked-post migration errors.
    }

    return Object.fromEntries(
      Object.entries(nextMap).filter(([, value]) => validTypes.has(value)),
    );
  } catch {
    return {};
  }
}

function writeReactionMap(nextMap) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(REACTION_POSTS_KEY, JSON.stringify(nextMap));
}

function readReadPostIds() {
  if (typeof window === "undefined") return new Set();

  try {
    const parsed = JSON.parse(window.localStorage.getItem(READ_POSTS_KEY) || "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

function writeReadPostIds(nextSet) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(READ_POSTS_KEY, JSON.stringify([...nextSet]));
}

function formatDate(value) {
  if (!value) return "Tanggal belum diisi";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatRelativeDate(value) {
  if (!value) return "Tanggal belum diisi";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDate(value);

  const diffDays = Math.floor((startOfDay(new Date()) - startOfDay(date)) / 86400000);

  if (diffDays <= 0) return "Hari ini";
  if (diffDays === 1) return "Kemarin";
  if (diffDays < 7) return `${diffDays} hari lalu`;
  if (diffDays < 14) return "Seminggu lalu";
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} minggu lalu`;
  if (diffDays < 60) return "Sebulan lalu";
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} bulan lalu`;
  if (diffDays < 730) return "Setahun lalu";

  return `${Math.floor(diffDays / 365)} tahun lalu`;
}

function getPostImages(post) {
  return Array.isArray(post.images) ? post.images.filter((image) => image?.image_url) : [];
}

function getCoverImage(post) {
  const images = getPostImages(post);

  if (post.cover_image_url) {
    const matchedCover = images.find((image) => image.image_url === post.cover_image_url || image.image_key === post.cover_image_key);

    return matchedCover || {
      image_url: post.cover_image_url,
      image_key: post.cover_image_key || "cover",
      caption: "",
    };
  }

  return images[0] || null;
}

function getCollageImages(post) {
  const images = getPostImages(post);
  const cover = getCoverImage(post);

  if (!cover) return [];

  const rest = images.filter((image) => image.image_url !== cover.image_url);
  return [cover, ...rest];
}

function getTimelinePostsUrl({ limit = TIMELINE_PAGE_SIZE, offset = 0, postId = "" } = {}) {
  const params = new URLSearchParams({
    t: String(Date.now()),
  });

  if (postId) {
    params.set("post", postId);
  } else {
    params.set("limit", String(limit));
    params.set("offset", String(offset));
  }

  return `/api/timeline/posts?${params.toString()}`;
}

function isLongDescription(description = "") {
  return description.length > DESCRIPTION_PREVIEW_LIMIT || description.split("\n").length > 3;
}

function mergePosts(currentPosts, nextPosts) {
  const map = new Map();

  currentPosts.forEach((post) => map.set(post.id, post));
  nextPosts.forEach((post) => map.set(post.id, post));

  return [...map.values()];
}

function getReactionByType(type = "") {
  return REACTIONS.find((reaction) => reaction.type === type) || null;
}

function getReactionCounts(post) {
  return post.reaction_counts && typeof post.reaction_counts === "object" ? post.reaction_counts : {};
}

function getReactionTotal(post) {
  const counts = getReactionCounts(post);
  const total = REACTIONS.reduce((sum, reaction) => sum + Number(counts[reaction.type] || 0), 0);

  return total || Number(post.reaction_total ?? post.like_count ?? 0);
}

function getTopReactions(post) {
  const counts = getReactionCounts(post);

  return REACTIONS
    .map((reaction) => ({ ...reaction, count: Number(counts[reaction.type] || 0) }))
    .filter((reaction) => reaction.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

function buildSharedPostUrl(postId) {
  if (typeof window === "undefined") return `/?post=${postId}`;

  const url = new URL(window.location.href);
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  url.searchParams.set("post", postId);

  return url.toString();
}

function updatePostReaction(post, data, requestedReactionType) {
  const nextReactionType = data.current_reaction || data.reaction_type || "";
  const nextCounts = data.reaction_counts || post.reaction_counts || {};
  const nextTotal = Number(data.reaction_total ?? data.like_count ?? getReactionTotal({ ...post, reaction_counts: nextCounts }));

  return {
    ...post,
    reaction_counts: nextCounts,
    reaction_total: nextTotal,
    like_count: nextTotal,
    current_reaction: nextReactionType,
    last_reaction_type: requestedReactionType,
  };
}

function TimelineSkeleton({ count = 2 } = {}) {
  return (
    <section className="timeline-feed" aria-label="Memuat timeline kegiatan warga">
      {Array.from({ length: count }).map((_, item) => (
        <article className="timeline-card timeline-skeleton-card" key={item}>
          <div className="timeline-post-header">
            <div className="timeline-skeleton-avatar" />
            <div className="timeline-post-author">
              <div className="timeline-skeleton-line short" />
              <div className="timeline-skeleton-line tiny" />
            </div>
          </div>
          <div className="timeline-card-body timeline-card-copy">
            <div className="timeline-skeleton-line title" />
            <div className="timeline-skeleton-line" />
            <div className="timeline-skeleton-line mid" />
          </div>
          <div className="timeline-skeleton-media" />
          <div className="timeline-card-body">
            <div className="timeline-skeleton-line tiny" />
          </div>
        </article>
      ))}
    </section>
  );
}

export default function TimelineClient() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [reactionMap, setReactionMap] = useState({});
  const [readPostIds, setReadPostIds] = useState(() => new Set());
  const [reactingIds, setReactingIds] = useState(() => new Set());
  const [animatedReactionIds, setAnimatedReactionIds] = useState(() => new Set());
  const [expandedPostIds, setExpandedPostIds] = useState(() => new Set());
  const [selectedGallery, setSelectedGallery] = useState(null);
  const [gallerySwipeDirection, setGallerySwipeDirection] = useState("");
  const [galleryImageLoading, setGalleryImageLoading] = useState(false);
  const [reactionPickerPostId, setReactionPickerPostId] = useState("");
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [highlightPostId, setHighlightPostId] = useState("");
  const swipeStartRef = useRef(null);
  const loadMoreRef = useRef(null);
  const sharedPostIdRef = useRef("");

  const loadPosts = useCallback(async ({ offset = 0, reset = false, postId = "" } = {}) => {
    try {
      if (reset) setLoading(true);
      else setLoadingMore(true);
      setError("");

      const response = await fetch(getTimelinePostsUrl({ offset, postId }), {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(data.error || "Gagal memuat kegiatan warga");

      if (postId) {
        const sharedPost = data.post;
        if (sharedPost?.id) {
          setPosts((currentPosts) => mergePosts([sharedPost], currentPosts));
          setHighlightPostId(sharedPost.id);
          window.setTimeout(() => {
            document.getElementById(`timeline-post-${sharedPost.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 220);
          window.setTimeout(() => setHighlightPostId(""), HIGHLIGHT_DELAY);
        }
        return;
      }

      const nextPosts = Array.isArray(data.posts) ? data.posts : [];
      setPosts((currentPosts) => (reset ? nextPosts : mergePosts(currentPosts, nextPosts)));
      setNextOffset(Number(data.nextOffset || offset + nextPosts.length));
      setHasMore(Boolean(data.hasMore));
    } catch (err) {
      setError(err.message || "Gagal memuat kegiatan warga");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    setReactionMap(readReactionMap());
    setReadPostIds(readReadPostIds());
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    sharedPostIdRef.current = params.get("post") || "";
    loadPosts({ offset: 0, reset: true });
  }, [loadPosts]);

  useEffect(() => {
    if (!sharedPostIdRef.current || loading || posts.length === 0) return;
    const sharedPostId = sharedPostIdRef.current;
    const hasSharedPost = posts.some((post) => post.id === sharedPostId);
    if (hasSharedPost) {
      markPostRead(sharedPostId);
      setHighlightPostId(sharedPostId);
      window.setTimeout(() => {
        document.getElementById(`timeline-post-${sharedPostId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 220);
      window.setTimeout(() => setHighlightPostId(""), HIGHLIGHT_DELAY);
      sharedPostIdRef.current = "";
      return;
    }
    loadPosts({ postId: sharedPostId });
    sharedPostIdRef.current = "";
  }, [loading, loadPosts, posts]);

  useEffect(() => {
    function handleScroll() {
      setShowBackToTop(window.scrollY > 700);
      setReactionPickerPostId("");
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMore || loading || loadingMore) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasMore && !loading && !loadingMore) loadPosts({ offset: nextOffset });
    }, { rootMargin: "420px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, loadPosts, nextOffset]);

  useEffect(() => {
    if (!selectedGallery) return undefined;
    function handleGalleryKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        setSelectedGallery(null);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        moveGallery(1);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveGallery(-1);
      }
    }
    window.addEventListener("keydown", handleGalleryKeydown);
    return () => window.removeEventListener("keydown", handleGalleryKeydown);
  }, [selectedGallery]);

  useEffect(() => {
    function closePicker(event) {
      if (!event.target.closest?.(".timeline-reaction-wrap")) setReactionPickerPostId("");
    }
    document.addEventListener("pointerdown", closePicker);
    return () => document.removeEventListener("pointerdown", closePicker);
  }, []);

  const hasPosts = posts.length > 0;
  const selectedGalleryImage = useMemo(() => selectedGallery ? selectedGallery.images[selectedGallery.index] || null : null, [selectedGallery]);

  useEffect(() => {
    if (!selectedGalleryImage?.image_url) {
      setGalleryImageLoading(false);
      return undefined;
    }

    let cancelled = false;
    setGalleryImageLoading(true);

    const image = new Image();
    image.onload = () => {
      if (!cancelled) setGalleryImageLoading(false);
    };
    image.onerror = () => {
      if (!cancelled) setGalleryImageLoading(false);
    };
    image.src = selectedGalleryImage.image_url;

    return () => {
      cancelled = true;
    };
  }, [selectedGalleryImage?.image_url]);

  function markPostRead(postId) {
    if (!postId) return;
    setReadPostIds((current) => {
      if (current.has(postId)) return current;
      const next = new Set(current);
      next.add(postId);
      writeReadPostIds(next);
      return next;
    });
  }

  function scrollToPost(postId) {
    markPostRead(postId);
    setHighlightPostId(postId);
    document.getElementById(`timeline-post-${postId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => setHighlightPostId(""), HIGHLIGHT_DELAY);
  }

  function openThemePicker() {
    document.querySelector(".public-theme-button")?.click();
  }

  function persistReaction(postId, reactionType) {
    setReactionMap((current) => {
      const next = { ...current };
      if (reactionType) next[postId] = reactionType;
      else delete next[postId];
      writeReactionMap(next);
      return next;
    });
  }

  function toggleExpandedPost(postId) {
    setExpandedPostIds((current) => {
      const next = new Set(current);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }

  function animateReaction(postId) {
    setAnimatedReactionIds((current) => {
      const next = new Set(current);
      next.add(postId);
      return next;
    });
    window.setTimeout(() => {
      setAnimatedReactionIds((current) => {
        const next = new Set(current);
        next.delete(postId);
        return next;
      });
    }, 900);
  }

  function openGallery(post, startIndex = 0) {
    const images = getCollageImages(post);
    if (!images.length) return;
    markPostRead(post.id);
    setGallerySwipeDirection("");
    setGalleryImageLoading(true);
    setSelectedGallery({ postTitle: post.title, images, index: Math.min(Math.max(startIndex, 0), images.length - 1) });
  }

  function moveGallery(step) {
    setSelectedGallery((current) => {
      if (!current || current.images.length < 2) return current;
      setGalleryImageLoading(true);
      setGallerySwipeDirection(step > 0 ? "next" : "prev");
      window.setTimeout(() => setGallerySwipeDirection(""), 360);
      return { ...current, index: (current.index + step + current.images.length) % current.images.length };
    });
  }

  function startGallerySwipe(clientX, clientY = 0) {
    swipeStartRef.current = { x: clientX, y: clientY };
  }

  function finishGallerySwipe(clientX, clientY = 0) {
    if (!swipeStartRef.current || !selectedGallery || selectedGallery.images.length < 2) return;
    const deltaX = clientX - swipeStartRef.current.x;
    const deltaY = clientY - swipeStartRef.current.y;
    swipeStartRef.current = null;
    if (Math.abs(deltaX) < GALLERY_SWIPE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY)) return;
    moveGallery(deltaX < 0 ? 1 : -1);
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleReaction(postId, reactionType = DEFAULT_REACTION.type) {
    if (reactionMap[postId] || reactingIds.has(postId)) return;
    const visitorId = getVisitorId();
    setError("");
    setReactionPickerPostId("");
    setReactingIds((current) => new Set(current).add(postId));
    try {
      const response = await fetch(`/api/timeline/posts/${postId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
        body: JSON.stringify({ visitor_id: visitorId, reaction_type: reactionType }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan reaction");
      persistReaction(postId, data.current_reaction || "");
      setPosts((current) => current.map((post) => post.id === postId ? updatePostReaction(post, data, reactionType) : post));
      if (data.current_reaction) animateReaction(postId);
    } catch (err) {
      setError(err.message || "Gagal menyimpan reaction");
    } finally {
      setReactingIds((current) => {
        const next = new Set(current);
        next.delete(postId);
        return next;
      });
    }
  }

  function handleReactionButtonClick(postId, currentReactionType = "") {
    if (currentReactionType) return;
    setReactionPickerPostId((current) => (current === postId ? "" : postId));
  }

  async function handleShare(post) {
    const url = buildSharedPostUrl(post.id);
    const title = post.title || "Kegiatan Warga Amarta Residence Blok E";
    const text = `Kegiatan Warga Amarta Residence Blok E\n\n${title}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setError("Link kegiatan disalin");
      window.setTimeout(() => setError(""), 1800);
    } catch (err) {
      if (err?.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        setError("Link kegiatan disalin");
        window.setTimeout(() => setError(""), 1800);
      } catch {
        setError("Gagal membagikan link kegiatan");
      }
    }
  }

  return (
    <main className="page-wrap timeline-page">
      <style>{timelineNavCss}</style>
      <header className="hero-header timeline-hero">
        <h1 className="hero-title">Amarta Residence • Blok E</h1>
        <p className="hero-desc">Ruang informasi kegiatan warga, dan dokumentasi lingkungan.</p>
      </header>

      {error ? <div className="timeline-alert">{error}</div> : null}

      {!loading && hasPosts ? (
        <section className="timeline-story-rail" aria-label="Navigasi postingan kegiatan">
          {posts.map((post, index) => {
            const coverImage = getCoverImage(post);
            const isRead = readPostIds.has(post.id);
            return (
              <button key={post.id} type="button" className={`timeline-story-item${isRead ? " read" : " unread"}`} onClick={() => scrollToPost(post.id)} aria-label={`Buka postingan ${post.title || index + 1}`}>
                <span className="timeline-story-ring">
                  {coverImage ? <img src={coverImage.image_url} alt="" /> : <span aria-hidden="true">A</span>}
                </span>
                <small>{post.category || `Post ${index + 1}`}</small>
              </button>
            );
          })}
        </section>
      ) : null}

      {loading ? <TimelineSkeleton /> : null}

      {!loading && !hasPosts ? (
        <section className="timeline-placeholder timeline-empty-state">
          <div className="timeline-placeholder-icon">📸</div>
          <h1>Belum ada dokumentasi kegiatan</h1>
          <p>Kegiatan warga yang dipublikasikan admin akan tampil di sini.</p>
        </section>
      ) : null}

      {!loading && hasPosts ? (
        <section className="timeline-feed" aria-label="Timeline kegiatan warga">
          {posts.map((post) => {
            const images = getCollageImages(post);
            const coverImage = images[0] || null;
            const secondImage = images[1] || null;
            const thirdImage = images[2] || null;
            const remainingPhotoCount = Math.max(images.length - 2, 0);
            const currentReactionType = reactionMap[post.id] || post.current_reaction || "";
            const currentReaction = getReactionByType(currentReactionType);
            const topReactions = getTopReactions(post);
            const reactionTotal = getReactionTotal(post);
            const isReacting = reactingIds.has(post.id);
            const isReactionLocked = Boolean(currentReactionType);
            const isAnimating = animatedReactionIds.has(post.id);
            const isExpanded = expandedPostIds.has(post.id);
            const descriptionIsLong = isLongDescription(post.description || "");
            const coverCaption = coverImage?.caption || "";
            const postDate = post.event_date || post.created_at;
            const cardHighlighted = highlightPostId === post.id;
            return (
              <article id={`timeline-post-${post.id}`} className={`timeline-card${cardHighlighted ? " highlighted" : ""}`} key={post.id}>
                <div className="timeline-post-header"><div className="timeline-post-avatar" aria-hidden="true">A</div><div className="timeline-post-author"><strong>Amarta Residence Blok E</strong><span>{formatRelativeDate(postDate)} • {post.category || "Dokumentasi Warga"}</span></div></div>
                <div className="timeline-card-body timeline-card-copy"><h1>{post.title}</h1>{post.description ? <><p className={descriptionIsLong && !isExpanded ? "timeline-description-clamped" : ""}>{post.description}</p>{descriptionIsLong ? <button type="button" className="timeline-read-more" onClick={() => toggleExpandedPost(post.id)}>{isExpanded ? "Tampilkan lebih sedikit" : "Lihat selengkapnya"}</button> : null}</> : null}</div>
                {coverImage ? <div className={`timeline-collage photo-count-${Math.min(images.length, 3)}`}><button className="timeline-collage-main" type="button" onClick={() => openGallery(post, 0)}><img src={coverImage.image_url} alt={coverCaption || post.title || "Foto kegiatan warga"} /></button>{secondImage ? <button className="timeline-collage-side top" type="button" onClick={() => openGallery(post, 1)}><img src={secondImage.image_url} alt={secondImage.caption || post.title || "Foto kegiatan warga"} />{images.length === 2 ? <span className="timeline-collage-overlay"><strong>2 Foto</strong><small>Lihat dokumentasi</small></span> : null}</button> : null}{thirdImage ? <button className="timeline-collage-side bottom" type="button" onClick={() => openGallery(post, 2)}><img src={thirdImage.image_url} alt={thirdImage.caption || post.title || "Foto kegiatan warga"} /><span className="timeline-collage-overlay"><strong>{remainingPhotoCount > 1 ? `+${remainingPhotoCount} Foto` : "3 Foto"}</strong><small>Lihat semua</small></span></button> : null}</div> : null}
                <div className="timeline-card-body timeline-card-footer">{coverCaption ? <div className="timeline-cover-caption">{coverCaption}</div> : null}{images.length > 1 ? <button type="button" className="timeline-image-count" onClick={() => openGallery(post, 0)}>Lihat semua {images.length} foto dokumentasi</button> : null}<div className="timeline-social-actions"><div className="timeline-reaction-wrap">{reactionPickerPostId === post.id && !isReactionLocked ? <div className="timeline-reaction-picker" role="menu" aria-label="Pilih reaction">{REACTIONS.map((reaction) => <button key={reaction.type} type="button" className={currentReactionType === reaction.type ? "active" : ""} onClick={() => handleReaction(post.id, reaction.type)} onContextMenu={(event) => event.preventDefault()} aria-label={reaction.label}><span aria-hidden="true">{reaction.emoji}</span><small>{reaction.label}</small></button>)}</div> : null}<button type="button" className={`timeline-like-button${currentReaction ? " active muted" : ""}${isAnimating ? " animate" : ""}`} disabled={isReactionLocked || isReacting} onContextMenu={(event) => event.preventDefault()} onClick={() => handleReactionButtonClick(post.id, currentReactionType)} aria-label={currentReaction?.label || "Pilih reaction"}><span aria-hidden="true">{currentReaction?.emoji || DEFAULT_REACTION.emoji}</span>{currentReaction?.label || DEFAULT_REACTION.label}</button></div><div className="timeline-reaction-summary" aria-label={`${reactionTotal} reaksi`}>{topReactions.length ? <span className="timeline-reaction-icons">{topReactions.map((reaction) => <span key={reaction.type} aria-hidden="true">{reaction.emoji}</span>)}</span> : null}<span>{reactionTotal.toLocaleString("id-ID")} reaksi</span></div><button type="button" className="timeline-share-button" onClick={() => handleShare(post)}>Bagikan</button></div></div>
              </article>
            );
          })}
        </section>
      ) : null}

      {!loading && hasMore ? <div className="timeline-load-more" ref={loadMoreRef} aria-live="polite">{loadingMore ? "Memuat kegiatan lainnya..." : "Scroll untuk memuat kegiatan lainnya"}</div> : null}
      {!loading && hasPosts && !hasMore ? <div className="timeline-end-message">Semua kegiatan sudah ditampilkan.</div> : null}
      {showBackToTop ? <button type="button" className="timeline-back-to-top" onClick={scrollToTop} aria-label="Kembali ke atas">↑</button> : null}

      <nav className="timeline-bottom-nav" aria-label="Navigasi utama"><button type="button" className="timeline-bottom-nav-item" onClick={scrollToTop}><span aria-hidden="true">⌂</span><strong>Beranda</strong></button><Link className="timeline-bottom-nav-item" href="/kas"><span aria-hidden="true">Rp</span><strong>Kas Warga</strong></Link><button type="button" className="timeline-bottom-nav-item" onClick={openThemePicker}><span aria-hidden="true">🎨</span><strong>Tema</strong></button></nav>

      {selectedGallery && selectedGalleryImage ? <div className="timeline-gallery-overlay" onClick={() => setSelectedGallery(null)}><section className="timeline-gallery-modal" onClick={(event) => event.stopPropagation()}><button className="timeline-gallery-close" type="button" onClick={() => setSelectedGallery(null)} aria-label="Tutup galeri">×</button><div className="timeline-gallery-header"><div><div className="timeline-gallery-kicker">Dokumentasi</div><h2>{selectedGallery.postTitle}</h2></div><span>{selectedGallery.index + 1} / {selectedGallery.images.length}</span></div><div className={`timeline-gallery-photo-wrap${gallerySwipeDirection ? ` swipe-${gallerySwipeDirection}` : ""}${galleryImageLoading ? " is-loading" : ""}`} onMouseDown={(event) => startGallerySwipe(event.clientX, event.clientY)} onMouseUp={(event) => finishGallerySwipe(event.clientX, event.clientY)} onMouseLeave={() => { swipeStartRef.current = null; }} onTouchStart={(event) => startGallerySwipe(event.touches[0].clientX, event.touches[0].clientY)} onTouchEnd={(event) => { const touch = event.changedTouches[0]; finishGallerySwipe(touch.clientX, touch.clientY); }}>{galleryImageLoading ? <div className="timeline-gallery-loader" role="status" aria-label="Memuat foto"><span /></div> : null}<img key={selectedGalleryImage.image_url} src={selectedGalleryImage.image_url} alt={selectedGalleryImage.caption || selectedGallery.postTitle || "Foto kegiatan warga"} onLoad={() => setGalleryImageLoading(false)} onError={() => setGalleryImageLoading(false)} />{selectedGallery.images.length > 1 ? <><button type="button" className="timeline-gallery-arrow prev" onClick={() => moveGallery(-1)} aria-label="Foto sebelumnya">‹</button><button type="button" className="timeline-gallery-arrow next" onClick={() => moveGallery(1)} aria-label="Foto berikutnya">›</button><div className="timeline-gallery-swipe-hint">Geser atau pakai tombol ← →</div></> : null}</div>{selectedGallery.images.length > 1 ? <div className="timeline-gallery-dots" aria-label="Indikator foto galeri">{selectedGallery.images.map((image, index) => <button key={image.id || image.image_key || image.image_url} type="button" className={index === selectedGallery.index ? "active" : ""} onClick={() => { setGalleryImageLoading(true); setGallerySwipeDirection(index > selectedGallery.index ? "next" : "prev"); setSelectedGallery((current) => current ? { ...current, index } : current); window.setTimeout(() => setGallerySwipeDirection(""), 360); }} aria-label={`Lihat foto ${index + 1}`} />)}</div> : null}<p className="timeline-gallery-caption">{selectedGalleryImage.caption || "Belum ada caption untuk foto ini."}</p></section></div> : null}
    </main>
  );
}
