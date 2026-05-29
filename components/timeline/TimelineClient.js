"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PublicThemeSelector from "@/components/theme/PublicThemeSelector";

const VISITOR_ID_KEY = "amarta_timeline_visitor_id";

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

function getCoverImage(post) {
  if (post.cover_image_url) return post.cover_image_url;

  const firstImage = Array.isArray(post.images) ? post.images[0] : null;
  return firstImage?.image_url || "";
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

export default function TimelineClient() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [likedIds, setLikedIds] = useState(() => new Set());
  const [likingIds, setLikingIds] = useState(() => new Set());

  useEffect(() => {
    let ignore = false;

    async function loadPosts() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/timeline/posts", { cache: "no-store" });
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
        },
        body: JSON.stringify({ visitor_id: visitorId }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Gagal menyimpan like");
      }

      setLikedIds((current) => {
        const next = new Set(current);
        next.add(postId);
        return next;
      });

      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? { ...post, like_count: getNextLikeCount(post, data) }
            : post,
        ),
      );
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
          <PublicThemeSelector />
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
            const coverImage = getCoverImage(post);
            const isLiked = likedIds.has(post.id);
            const isLiking = likingIds.has(post.id);

            return (
              <article className="timeline-card" key={post.id}>
                {coverImage ? (
                  <div className="timeline-card-media">
                    <img src={coverImage} alt={post.title || "Foto kegiatan warga"} />
                  </div>
                ) : null}

                <div className="timeline-card-body">
                  <div className="timeline-meta-row">
                    <span>{formatDate(post.event_date || post.created_at)}</span>
                    {post.category ? <span>{post.category}</span> : null}
                  </div>

                  <h1>{post.title}</h1>

                  {post.description ? <p>{post.description}</p> : null}

                  {Array.isArray(post.images) && post.images.length > 1 ? (
                    <div className="timeline-image-count">{post.images.length} foto dokumentasi</div>
                  ) : null}

                  <div className="timeline-card-actions">
                    <button
                      type="button"
                      className={`timeline-like-button${isLiked ? " active" : ""}`}
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
    </main>
  );
}
