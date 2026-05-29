"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

const VISITOR_ID_KEY = "amarta_timeline_visitor_id";
const LIKED_POSTS_KEY = "amarta_timeline_liked_posts";
const GALLERY_SWIPE_THRESHOLD = 42;

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

function getTimelinePostsUrl() {
  return `/api/timeline/posts?t=${Date.now()}`;
}

export default function TimelineClient() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [likedIds, setLikedIds] = useState(() => new Set());
  const [likingIds, setLikingIds] = useState(() => new Set());
  const [animatedLikeIds, setAnimatedLikeIds] = useState(() => new Set());
  const [selectedGallery, setSelectedGallery] = useState(null);
  const [gallerySwipeDirection, setGallerySwipeDirection] = useState("");
  const swipeStartRef = useRef(null);

  useEffect(() => {
    setLikedIds(readLikedPostIds());
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadPosts() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(getTimelinePostsUrl(), {
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

        if (!ignore) {
          setPosts(Array.isArray(data.posts) ? data.posts : []);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || "Gagal memuat kegiatan warga");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadPosts();

    return () => {
      ignore = true;
    };
  }, []);

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

      {loading ? (
        <section className="timeline-placeholder">
          <div className="timeline-placeholder-icon">📸</div>
          <h1>Memuat Kegiatan Warga</h1>
          <p>Data kegiatan sedang dimuat dari server.</p>
        </section>
      ) : null}

      {!loading && !hasPosts ? (
        <section className="timeline-placeholder">
          <div className="timeline-placeholder-icon">📸</div>
          <h1>Kegiatan Warga</h1>
          <p>
            Belum ada kegiatan yang dipublikasikan. Setelah admin menambahkan dan mempublikasikan
            kegiatan, dokumentasinya akan tampil di sini.
          </p>
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
            const coverCaption = coverImage?.caption || "";

            return (
              <article className="timeline-card" key={post.id}>
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

                <div className="timeline-card-body">
                  <div className="timeline-meta-row">
                    <span>{formatDate(post.event_date || post.created_at)}</span>
                    {post.category ? <span>{post.category}</span> : null}
                  </div>

                  <h1>{post.title}</h1>

                  {post.description ? <p>{post.description}</p> : null}

                  {coverCaption ? <div className="timeline-cover-caption">{coverCaption}</div> : null}

                  {images.length > 1 ? (
                    <button type="button" className="timeline-image-count" onClick={() => openGallery(post, 0)}>
                      Lihat semua {images.length} foto dokumentasi
                    </button>
                  ) : null}

                  <div className="timeline-card-actions">
                    <button
                      type="button"
                      className={`timeline-like-button${isLiked ? " active" : ""}${isAnimating ? " animate" : ""}`}
                      disabled={isLiked || isLiking}
                      onClick={() => handleLike(post.id)}
                    >
                      <span aria-hidden="true">♥</span>
                      {Number(post.like_count || 0).toLocaleString("id-ID")}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
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

            <p className="timeline-gallery-caption">
              {selectedGalleryImage.caption || "Belum ada caption untuk foto ini."}
            </p>
          </section>
        </div>
      ) : null}
    </main>
  );
}
