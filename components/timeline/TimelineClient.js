"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

const VISITOR_ID_KEY = "amarta_timeline_visitor_id";
const LIKED_POSTS_KEY = "amarta_timeline_liked_posts";
const GALLERY_SWIPE_THRESHOLD = 42;
const DESCRIPTION_PREVIEW_LIMIT = 180;
const TIMELINE_PAGE_SIZE = 6;

function createVisitorId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

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

function readLikedPostIds() {
  if (typeof window === "undefined") return new Set();

  try {
    const parsed = JSON.parse(window.localStorage.getItem(LIKED_POSTS_KEY) || "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

function writeLikedPostIds(nextLikedIds) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(LIKED_POSTS_KEY, JSON.stringify([...nextLikedIds]));
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

function formatRelativeDate(value) {
  if (!value) return "Tanggal belum diisi";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDate(value);

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "Baru saja";
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays === 1) return "Kemarin";
  if (diffDays < 7) return `${diffDays} hari lalu`;

  return formatDate(value);
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

function getNextLikeCount(post, data) {
  const apiLikeCount = Number(data?.like_count);

  if (Number.isFinite(apiLikeCount)) {
    return apiLikeCount;
  }

  if (data?.liked === true) {
    return Number(post.like_count || 0) + 1;
  }

  return Number(post.like_count || 0);
}

function getTimelinePostsUrl({ limit = TIMELINE_PAGE_SIZE, offset = 0 } = {}) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    t: String(Date.now()),
  });

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
  const [likedIds, setLikedIds] = useState(() => new Set());
  const [likingIds, setLikingIds] = useState(() => new Set());
  const [animatedLikeIds, setAnimatedLikeIds] = useState(() => new Set());
  const [expandedPostIds, setExpandedPostIds] = useState(() => new Set());
  const [selectedGallery, setSelectedGallery] = useState(null);
  const [gallerySwipeDirection, setGallerySwipeDirection] = useState("");
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const swipeStartRef = useRef(null);
  const loadMoreRef = useRef(null);

  useEffect(() => {
    setLikedIds(readLikedPostIds());
  }, []);

  const loadPosts = useCallback(async ({ offset = 0, reset = false } = {}) => {
    try {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError("");

      const response = await fetch(getTimelinePostsUrl({ offset }), {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Gagal memuat kegiatan warga");
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
    loadPosts({ offset: 0, reset: true });
  }, [loadPosts]);

  useEffect(() => {
    function handleScroll() {
      setShowBackToTop(window.scrollY > 700);
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

  const hasPosts = posts.length > 0;
  const selectedGalleryImage = useMemo(() => {
    if (!selectedGallery) return null;

    return selectedGallery.images[selectedGallery.index] || null;
  }, [selectedGallery]);

  function persistLikedPost(postId) {
    setLikedIds((current) => {
      const next = new Set(current);
      next.add(postId);
      writeLikedPostIds(next);
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

  function animateLike(postId) {
    setAnimatedLikeIds((current) => {
      const next = new Set(current);
      next.add(postId);
      return next;
    });

    window.setTimeout(() => {
      setAnimatedLikeIds((current) => {
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

  async function handleLike(postId) {
    if (likedIds.has(postId) || likingIds.has(postId)) return;

    const visitorId = getVisitorId();
    setError("");

    setLikingIds((current) => {
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
        body: JSON.stringify({ visitor_id: visitorId }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Gagal menyimpan like");
      }

      persistLikedPost(postId);

      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? { ...post, like_count: getNextLikeCount(post, data) }
            : post,
        ),
      );

      if (data.liked === true) {
        animateLike(postId);
      }
    } catch (err) {
      setError(err.message || "Gagal menyimpan like");
    } finally {
      setLikingIds((current) => {
        const next = new Set(current);
        next.delete(postId);
        return next;
      });
    }
  }

  return (
    <main className="page-wrap timeline-page">
      <header className="hero-header timeline-hero">
        <div className="hero-eyebrow">Amarta Residence • Blok E</div>
        <p className="hero-desc">
          Dashboard kegiatan warga
          <br />
          dan dokumentasi lingkungan
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
            const isLiked = likedIds.has(post.id);
            const isLiking = likingIds.has(post.id);
            const isAnimating = animatedLikeIds.has(post.id);
            const isExpanded = expandedPostIds.has(post.id);
            const descriptionIsLong = isLongDescription(post.description || "");
            const coverCaption = coverImage?.caption || "";
            const postDate = post.event_date || post.created_at;
            const likeCount = Number(post.like_count || 0);

            return (
              <article className="timeline-card" key={post.id}>
                <div className="timeline-post-header">
                  <div className="timeline-post-avatar" aria-hidden="true">A</div>
                  <div className="timeline-post-author">
                    <strong>Amarta Residence Blok E</strong>
                    <span>{formatRelativeDate(postDate)} • {post.category || "Dokumentasi Warga"}</span>
                  </div>
                  <span className="timeline-post-badge">Kegiatan</span>
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
                    <button
                      type="button"
                      className={`timeline-like-button${isLiked ? " active" : ""}${isAnimating ? " animate" : ""}`}
                      disabled={isLiked || isLiking}
                      onClick={() => handleLike(post.id)}
                    >
                      <span aria-hidden="true">{isLiked ? "♥" : "♡"}</span>
                      {isLiked ? "Disukai" : "Suka"}
                    </button>
                    <span className="timeline-like-count">{likeCount.toLocaleString("id-ID")} suka</span>
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
              {selectedGallery.images.length > 1 ? <div className="timeline-gallery-swipe-hint">Geser untuk foto lain</div> : null}
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
