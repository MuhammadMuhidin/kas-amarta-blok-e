"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

const VISITOR_ID_KEY = "amarta_timeline_visitor_id";
const REACTION_POSTS_KEY = "amarta_timeline_reactions";
const LEGACY_LIKED_POSTS_KEY = "amarta_timeline_liked_posts";
const GALLERY_SWIPE_THRESHOLD = 42;
const DESCRIPTION_PREVIEW_LIMIT = 180;
const TIMELINE_PAGE_SIZE = 6;
const LONG_PRESS_DELAY = 420;
const HIGHLIGHT_DELAY = 1800;

const REACTIONS = [
  { type: "like", emoji: "👍", label: "Suka" },
  { type: "care", emoji: "❤️", label: "Peduli" },
  { type: "thanks", emoji: "🙏", label: "Terima kasih" },
  { type: "appreciate", emoji: "👏", label: "Apresiasi" },
  { type: "informative", emoji: "💡", label: "Informatif" },
];

const DEFAULT_REACTION = REACTIONS[0];

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
  const [reactingIds, setReactingIds] = useState(() => new Set());
  const [animatedReactionIds, setAnimatedReactionIds] = useState(() => new Set());
  const [expandedPostIds, setExpandedPostIds] = useState(() => new Set());
  const [selectedGallery, setSelectedGallery] = useState(null);
  const [gallerySwipeDirection, setGallerySwipeDirection] = useState("");
  const [reactionPickerPostId, setReactionPickerPostId] = useState("");
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [highlightPostId, setHighlightPostId] = useState("");
  const swipeStartRef = useRef(null);
  const loadMoreRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);
  const sharedPostIdRef = useRef("");

  const loadPosts = useCallback(async ({ offset = 0, reset = false, postId = "" } = {}) => {
    try {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError("");

      const response = await fetch(getTimelinePostsUrl({ offset, postId }), {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(data.error || "Gagal memuat kegiatan warga");

      if (postId) {
        const sharedPost = data.post;

        if (sharedPost?.id) {
          setPosts((currentPosts) => mergePosts([sharedPost], currentPosts));
          setHighlightPostId(sharedPost.id);
          window.setTimeout(() => {
            document.getElementById(`timeline-post-${sharedPost.id}`)?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
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
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedPostId = params.get("post") || "";
    sharedPostIdRef.current = sharedPostId;

    loadPosts({ offset: 0, reset: true });
  }, [loadPosts]);

  useEffect(() => {
    if (!sharedPostIdRef.current || loading || posts.length === 0) return;

    const sharedPostId = sharedPostIdRef.current;
    const hasSharedPost = posts.some((post) => post.id === sharedPostId);

    if (hasSharedPost) {
      setHighlightPostId(sharedPostId);
      window.setTimeout(() => {
        document.getElementById(`timeline-post-${sharedPostId}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
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

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;

        if (entry.isIntersecting && hasMore && !loading && !loadingMore) {
          loadPosts({ offset: nextOffset });
        }
      },
      { rootMargin: "420px 0px" },
    );

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
      if (!event.target.closest?.(".timeline-reaction-wrap")) {
        setReactionPickerPostId("");
      }
    }

    document.addEventListener("pointerdown", closePicker);

    return () => document.removeEventListener("pointerdown", closePicker);
  }, []);

  const hasPosts = posts.length > 0;
  const selectedGalleryImage = useMemo(() => {
    if (!selectedGallery) return null;

    return selectedGallery.images[selectedGallery.index] || null;
  }, [selectedGallery]);

  function persistReaction(postId, reactionType) {
    setReactionMap((current) => {
      const next = { ...current };

      if (reactionType) {
        next[postId] = reactionType;
      } else {
        delete next[postId];
      }

      writeReactionMap(next);
      return next;
    });
  }

  function toggleExpandedPost(postId) {
    setExpandedPostIds((current) => {
      const next = new Set(current);

      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }

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

    setGallerySwipeDirection("");
    setSelectedGallery({
      postTitle: post.title,
      images,
      index: Math.min(Math.max(startIndex, 0), images.length - 1),
    });
  }

  function moveGallery(step) {
    setSelectedGallery((current) => {
      if (!current || current.images.length < 2) return current;

      setGallerySwipeDirection(step > 0 ? "next" : "prev");
      window.setTimeout(() => setGallerySwipeDirection(""), 360);

      return {
        ...current,
        index: (current.index + step + current.images.length) % current.images.length,
      };
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

  function startLongPress(postId) {
    longPressTriggeredRef.current = false;
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setReactionPickerPostId(postId);
    }, LONG_PRESS_DELAY);
  }

  function cancelLongPress() {
    window.clearTimeout(longPressTimerRef.current);
  }

  async function handleReaction(postId, reactionType = DEFAULT_REACTION.type) {
    if (reactingIds.has(postId)) return;

    const visitorId = getVisitorId();
    setError("");
    setReactionPickerPostId("");

    setReactingIds((current) => {
      const next = new Set(current);
      next.add(postId);
      return next;
    });

    try {
      const response = await fetch(`/api/timeline/posts/${postId}/like`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
        body: JSON.stringify({ visitor_id: visitorId, reaction_type: reactionType }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(data.error || "Gagal menyimpan reaction");

      persistReaction(postId, data.current_reaction || "");

      setPosts((current) =>
        current.map((post) =>
          post.id === postId ? updatePostReaction(post, data, reactionType) : post,
        ),
      );

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

  function handleReactionButtonClick(postId) {
    const isCoarsePointer = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    if (isCoarsePointer) {
      handleReaction(postId, DEFAULT_REACTION.type);
      return;
    }

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
      <header className="hero-header timeline-hero">
        <div className="hero-eyebrow">Amarta Residence • Blok E</div>
        <p className="hero-desc">
          Ruang informasi kegiatan warga, dokumentasi lingkungan,
          <br />
          dan kabar terbaru Amarta Residence Blok E.
        </p>
        <div className="timeline-hero-actions">
          <Link className="timeline-kas-link" href="/kas">
            Lihat Kas Warga
          </Link>
        </div>
      </header>

      {error ? <div className="timeline-alert">{error}</div> : null}

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
            const isAnimating = animatedReactionIds.has(post.id);
            const isExpanded = expandedPostIds.has(post.id);
            const descriptionIsLong = isLongDescription(post.description || "");
            const coverCaption = coverImage?.caption || "";
            const postDate = post.event_date || post.created_at;
            const cardHighlighted = highlightPostId === post.id;

            return (
              <article id={`timeline-post-${post.id}`} className={`timeline-card${cardHighlighted ? " highlighted" : ""}`} key={post.id}>
                <div className="timeline-post-header">
                  <div className="timeline-post-avatar" aria-hidden="true">A</div>
                  <div className="timeline-post-author">
                    <strong>Amarta Residence Blok E</strong>
                    <span>{formatRelativeDate(postDate)} • {post.category || "Dokumentasi Warga"}</span>
                  </div>
                </div>

                <div className="timeline-card-body timeline-card-copy">
                  <h1>{post.title}</h1>

                  {post.description ? (
                    <>
                      <p className={descriptionIsLong && !isExpanded ? "timeline-description-clamped" : ""}>
                        {post.description}
                      </p>
                      {descriptionIsLong ? (
                        <button type="button" className="timeline-read-more" onClick={() => toggleExpandedPost(post.id)}>
                          {isExpanded ? "Tampilkan lebih sedikit" : "Lihat selengkapnya"}
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </div>

                {coverImage ? (
                  <div className={`timeline-collage photo-count-${Math.min(images.length, 3)}`}>
                    <button className="timeline-collage-main" type="button" onClick={() => openGallery(post, 0)}>
                      <img src={coverImage.image_url} alt={coverCaption || post.title || "Foto kegiatan warga"} />
                    </button>

                    {secondImage ? (
                      <button className="timeline-collage-side top" type="button" onClick={() => openGallery(post, 1)}>
                        <img src={secondImage.image_url} alt={secondImage.caption || post.title || "Foto kegiatan warga"} />
                        {images.length === 2 ? (
                          <span className="timeline-collage-overlay">
                            <strong>2 Foto</strong>
                            <small>Lihat dokumentasi</small>
                          </span>
                        ) : null}
                      </button>
                    ) : null}

                    {thirdImage ? (
                      <button className="timeline-collage-side bottom" type="button" onClick={() => openGallery(post, 2)}>
                        <img src={thirdImage.image_url} alt={thirdImage.caption || post.title || "Foto kegiatan warga"} />
                        <span className="timeline-collage-overlay">
                          <strong>{remainingPhotoCount > 1 ? `+${remainingPhotoCount} Foto` : "3 Foto"}</strong>
                          <small>Lihat semua</small>
                        </span>
                      </button>
                    ) : null}
                  </div>
                ) : null}

                <div className="timeline-card-body timeline-card-footer">
                  {coverCaption ? <div className="timeline-cover-caption">{coverCaption}</div> : null}

                  {images.length > 1 ? (
                    <button type="button" className="timeline-image-count" onClick={() => openGallery(post, 0)}>
                      Lihat semua {images.length} foto dokumentasi
                    </button>
                  ) : null}

                  <div className="timeline-social-actions">
                    <div className="timeline-reaction-wrap">
                      {reactionPickerPostId === post.id ? (
                        <div className="timeline-reaction-picker" role="menu" aria-label="Pilih reaction">
                          {REACTIONS.map((reaction) => (
                            <button
                              key={reaction.type}
                              type="button"
                              className={currentReactionType === reaction.type ? "active" : ""}
                              onClick={() => handleReaction(post.id, reaction.type)}
                              aria-label={reaction.label}
                            >
                              <span aria-hidden="true">{reaction.emoji}</span>
                              <small>{reaction.label}</small>
                            </button>
                          ))}
                        </div>
                      ) : null}

                      <button
                        type="button"
                        className={`timeline-like-button${currentReaction ? " active" : ""}${isAnimating ? " animate" : ""}`}
                        disabled={isReacting}
                        onPointerDown={() => startLongPress(post.id)}
                        onPointerUp={cancelLongPress}
                        onPointerCancel={cancelLongPress}
                        onPointerLeave={cancelLongPress}
                        onClick={() => handleReactionButtonClick(post.id)}
                      >
                        <span aria-hidden="true">{currentReaction?.emoji || DEFAULT_REACTION.emoji}</span>
                        {currentReaction?.label || DEFAULT_REACTION.label}
                      </button>
                    </div>

                    <div className="timeline-reaction-summary" aria-label={`${reactionTotal} reaksi`}>
                      {topReactions.length ? (
                        <span className="timeline-reaction-icons">
                          {topReactions.map((reaction) => (
                            <span key={reaction.type} aria-hidden="true">{reaction.emoji}</span>
                          ))}
                        </span>
                      ) : null}
                      <span>{reactionTotal.toLocaleString("id-ID")} reaksi</span>
                    </div>

                    <button type="button" className="timeline-share-button" onClick={() => handleShare(post)}>
                      Bagikan
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

      {!loading && hasMore ? (
        <div className="timeline-load-more" ref={loadMoreRef} aria-live="polite">
          {loadingMore ? "Memuat kegiatan lainnya..." : "Scroll untuk memuat kegiatan lainnya"}
        </div>
      ) : null}

      {!loading && hasPosts && !hasMore ? (
        <div className="timeline-end-message">Semua kegiatan sudah ditampilkan.</div>
      ) : null}

      {showBackToTop ? (
        <button type="button" className="timeline-back-to-top" onClick={scrollToTop} aria-label="Kembali ke atas">
          ↑
        </button>
      ) : null}

      {selectedGallery && selectedGalleryImage ? (
        <div className="timeline-gallery-overlay" onClick={() => setSelectedGallery(null)}>
          <section className="timeline-gallery-modal" onClick={(event) => event.stopPropagation()}>
            <button className="timeline-gallery-close" type="button" onClick={() => setSelectedGallery(null)} aria-label="Tutup galeri">
              ×
            </button>

            <div className="timeline-gallery-header">
              <div>
                <div className="timeline-gallery-kicker">Dokumentasi</div>
                <h2>{selectedGallery.postTitle}</h2>
              </div>
              <span>{selectedGallery.index + 1} / {selectedGallery.images.length}</span>
            </div>

            <div
              className={`timeline-gallery-photo-wrap${gallerySwipeDirection ? ` swipe-${gallerySwipeDirection}` : ""}`}
              onMouseDown={(event) => startGallerySwipe(event.clientX, event.clientY)}
              onMouseUp={(event) => finishGallerySwipe(event.clientX, event.clientY)}
              onMouseLeave={() => {
                swipeStartRef.current = null;
              }}
              onTouchStart={(event) => startGallerySwipe(event.touches[0].clientX, event.touches[0].clientY)}
              onTouchEnd={(event) => {
                const touch = event.changedTouches[0];
                finishGallerySwipe(touch.clientX, touch.clientY);
              }}
            >
              <img src={selectedGalleryImage.image_url} alt={selectedGalleryImage.caption || selectedGallery.postTitle || "Foto kegiatan warga"} />
              {selectedGallery.images.length > 1 ? (
                <>
                  <button type="button" className="timeline-gallery-arrow prev" onClick={() => moveGallery(-1)} aria-label="Foto sebelumnya">
                    ‹
                  </button>
                  <button type="button" className="timeline-gallery-arrow next" onClick={() => moveGallery(1)} aria-label="Foto berikutnya">
                    ›
                  </button>
                  <div className="timeline-gallery-swipe-hint">Geser atau pakai tombol ← →</div>
                </>
              ) : null}
            </div>

            {selectedGallery.images.length > 1 ? (
              <div className="timeline-gallery-dots" aria-label="Indikator foto galeri">
                {selectedGallery.images.map((image, index) => (
                  <button
                    key={image.id || image.image_key || image.image_url}
                    type="button"
                    className={index === selectedGallery.index ? "active" : ""}
                    onClick={() => {
                      setGallerySwipeDirection(index > selectedGallery.index ? "next" : "prev");
                      setSelectedGallery((current) => current ? { ...current, index } : current);
                      window.setTimeout(() => setGallerySwipeDirection(""), 360);
                    }}
                    aria-label={`Lihat foto ${index + 1}`}
                  />
                ))}
              </div>
            ) : null}

            <p className="timeline-gallery-caption">
              {selectedGalleryImage.caption || "Belum ada caption untuk foto ini."}
            </p>
          </section>
        </div>
      ) : null}
    </main>
  );
}
