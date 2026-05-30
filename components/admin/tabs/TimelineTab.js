"use client";

import LoadingButtonContent from "@/components/admin/LoadingButtonContent";
import modalStyles from "@/components/admin/AdminModal.module.css";
import { readJson, sendFormData, sendJson } from "@/components/admin/adminClientApi";
import { useEffect, useMemo, useRef, useState } from "react";

const emptyForm = {
  title: "",
  description: "",
  category: "",
  event_date: "",
  published: false,
};

const statusFilters = [
  { value: "all", label: "Semua" },
  { value: "published", label: "Tayang" },
  { value: "ready", label: "Siap Tayang" },
  { value: "incomplete", label: "Belum Lengkap" },
  { value: "draft", label: "Draft" },
];

function normalize(value) {
  return String(value || "").trim();
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function buildPostPayload(form) {
  return {
    title: normalize(form.title),
    description: normalize(form.description),
    category: normalize(form.category),
    event_date: normalize(form.event_date),
    published: form.published === true,
  };
}

function getPostPreviewUrl(postId) {
  if (typeof window === "undefined") return `/?post=${postId}`;

  const url = new URL(window.location.origin);
  url.pathname = "/";
  url.searchParams.set("post", postId);

  return url.toString();
}

function getPostCover(post) {
  const images = Array.isArray(post.images) ? post.images.filter((image) => image?.image_url) : [];

  if (post.cover_image_url) {
    return images.find((image) => image.image_url === post.cover_image_url || image.image_key === post.cover_image_key) || {
      image_url: post.cover_image_url,
    };
  }

  return images[0] || null;
}

function getReadiness(post) {
  const missing = [];

  if (!normalize(post.title)) missing.push("judul");
  if (!normalize(post.description)) missing.push("deskripsi");
  if (!normalize(post.event_date)) missing.push("tanggal");
  if (!post.images?.length) missing.push("foto");

  if (post.published) return { value: "published", label: "Tayang", missing, ready: missing.length === 0 };
  if (missing.length > 0) return { value: "incomplete", label: "Belum Lengkap", missing, ready: false };
  return { value: "ready", label: "Siap Tayang", missing, ready: true };
}

function postMatchesSearch(post, keyword) {
  const search = normalize(keyword).toLowerCase();

  if (!search) return true;

  return [post.title, post.description, post.category, formatDate(post.event_date || post.created_at)]
    .some((value) => String(value || "").toLowerCase().includes(search));
}

function badgeStyle(type) {
  if (type === "ready" || type === "published") {
    return { background: "#dcfce7", color: "#166534", border: "1px solid #86efac" };
  }

  return { background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d" };
}

function StatusBadge({ state }) {
  return (
    <span
      style={{
        display: "inline-flex",
        padding: "5px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: "nowrap",
        ...badgeStyle(state.value),
      }}
    >
      {state.label}
    </span>
  );
}

function TimelineSummary({ posts }) {
  const publishedCount = posts.filter((post) => post.published).length;
  const readyCount = posts.filter((post) => getReadiness(post).value === "ready").length;
  const incompleteCount = posts.filter((post) => getReadiness(post).value === "incomplete").length;
  const draftCount = posts.filter((post) => !post.published).length;

  return (
    <div className="admin-summary-cards timeline-admin-summary">
      <div className="admin-summary-card"><strong>{posts.length}</strong><span>Total Postingan</span></div>
      <div className="admin-summary-card"><strong>{publishedCount}</strong><span>Tayang</span></div>
      <div className="admin-summary-card"><strong>{readyCount}</strong><span>Siap Tayang</span></div>
      <div className="admin-summary-card"><strong>{incompleteCount}</strong><span>Belum Lengkap</span></div>
      <div className="admin-summary-card"><strong>{draftCount}</strong><span>Draft</span></div>
    </div>
  );
}

export default function TimelineTab({ showPopup }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingPost, setEditingPost] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [photoPost, setPhotoPost] = useState(null);
  const [previewPost, setPreviewPost] = useState(null);
  const [deletePost, setDeletePost] = useState(null);
  const [publishPost, setPublishPost] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [imageCaption, setImageCaption] = useState("");
  const [setAsCover, setSetAsCover] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef(null);

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const state = getReadiness(post);
      const statusMatched = statusFilter === "all" || statusFilter === state.value || (statusFilter === "draft" && !post.published);
      return statusMatched && postMatchesSearch(post, searchTerm);
    });
  }, [posts, searchTerm, statusFilter]);

  async function loadPosts() {
    try {
      setLoading(true);
      setError("");
      const data = await readJson("/api/admin/timeline/posts");
      setPosts(Array.isArray(data.posts) ? data.posts : []);
    } catch (err) {
      setError(err.message || "Gagal memuat postingan");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPosts();
  }, []);

  function resetForm() {
    setForm(emptyForm);
    setEditingPost(null);
    setShowForm(false);
  }

  function openCreateForm() {
    setEditingPost(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(post) {
    setEditingPost(post);
    setForm({
      title: post.title || "",
      description: post.description || "",
      category: post.category || "",
      event_date: post.event_date || "",
      published: post.published === true,
    });
    setShowForm(true);
  }

  function resetPhotoState() {
    setPhotoPost(null);
    setImageFiles([]);
    setImageCaption("");
    setSetAsCover(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function validateBeforePublish(post) {
    const state = getReadiness(post);
    if (state.ready) return true;

    const message = `Lengkapi ${state.missing.join(", ")} sebelum postingan ditayangkan.`;
    setError(message);
    showPopup?.(message, "warning");
    return false;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const payload = buildPostPayload(form);
    if (!payload.title) {
      setError("Judul kegiatan wajib diisi");
      return;
    }

    if (payload.published) {
      const nextPost = { ...(editingPost || {}), ...payload, images: editingPost?.images || [] };
      if (!validateBeforePublish(nextPost)) return;
    }

    setSaving(true);
    try {
      if (editingPost) {
        await sendJson(`/api/admin/timeline/posts/${editingPost.id}`, "PATCH", payload);
        showPopup?.("Postingan berhasil diperbarui", "success");
      } else {
        await sendJson("/api/admin/timeline/posts", "POST", { ...payload, published: false });
        showPopup?.("Postingan dibuat sebagai draft", "success");
      }
      resetForm();
      await loadPosts();
    } catch (err) {
      const message = err.message || "Gagal menyimpan postingan";
      setError(message);
      showPopup?.(message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePublish() {
    if (!publishPost) return;
    if (!publishPost.published && !validateBeforePublish(publishPost)) {
      setPublishPost(null);
      return;
    }

    setSaving(true);
    setError("");
    try {
      await sendJson(`/api/admin/timeline/posts/${publishPost.id}`, "PATCH", { published: !publishPost.published });
      showPopup?.(publishPost.published ? "Postingan disimpan sebagai draft" : "Postingan ditayangkan", "success");
      setPublishPost(null);
      await loadPosts();
    } catch (err) {
      const message = err.message || "Gagal mengubah status postingan";
      setError(message);
      showPopup?.(message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!photoPost) return;

    if (!imageFiles.length) {
      setError("Pilih foto kegiatan terlebih dahulu");
      return;
    }

    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("post_id", photoPost.id);
      imageFiles.forEach((file) => formData.append("images", file));
      formData.append("caption", imageCaption);
      formData.append("set_as_cover", setAsCover ? "true" : "false");
      formData.append("sort_order", String(photoPost.images?.length || 0));

      await sendFormData("/api/admin/timeline/upload", "POST", formData);
      showPopup?.(`${imageFiles.length} foto berhasil diunggah`, "success");
      resetPhotoState();
      await loadPosts();
    } catch (err) {
      const message = err.message || "Gagal mengunggah foto";
      setError(message);
      showPopup?.(message, "error");
    } finally {
      setUploading(false);
    }
  }

  async function handleSetCover(image) {
    if (!image?.id) return;

    setSaving(true);
    setError("");
    try {
      await sendJson(`/api/admin/timeline/images/${image.id}`, "PATCH", { set_as_cover: true });
      showPopup?.("Cover berhasil diperbarui", "success");
      setPhotoPost((current) => current ? { ...current, cover_image_key: image.image_key, cover_image_url: image.image_url } : current);
      await loadPosts();
    } catch (err) {
      const message = err.message || "Gagal mengubah cover";
      setError(message);
      showPopup?.(message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteImage(image) {
    if (!image?.id || !photoPost?.id) return;

    setSaving(true);
    setError("");
    try {
      const remainingImages = (photoPost.images || []).filter((item) => item.id !== image.id);
      const isCurrentCover = photoPost.cover_image_key === image.image_key || photoPost.cover_image_url === image.image_url;
      const nextCover = isCurrentCover ? remainingImages[0] : null;

      await sendJson(`/api/admin/timeline/images/${image.id}`, "DELETE", {});

      if (isCurrentCover) {
        await sendJson(`/api/admin/timeline/posts/${photoPost.id}`, "PATCH", {
          cover_image_key: nextCover?.image_key || "",
          cover_image_url: nextCover?.image_url || "",
        });
      }

      showPopup?.("Foto berhasil dihapus", "success");
      setPhotoPost((current) => current ? {
        ...current,
        images: remainingImages,
        cover_image_key: isCurrentCover ? (nextCover?.image_key || "") : current.cover_image_key,
        cover_image_url: isCurrentCover ? (nextCover?.image_url || "") : current.cover_image_url,
      } : current);
      await loadPosts();
    } catch (err) {
      const message = err.message || "Gagal menghapus foto";
      setError(message);
      showPopup?.(message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletePost) return;

    setDeletingId(deletePost.id);
    setError("");
    try {
      await sendJson(`/api/admin/timeline/posts/${deletePost.id}`, "DELETE", {});
      showPopup?.("Postingan berhasil dihapus", "success");
      setDeletePost(null);
      await loadPosts();
    } catch (err) {
      const message = err.message || "Gagal menghapus postingan";
      setError(message);
      showPopup?.(message, "error");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <>
      <div className="activity-panel">
        <div className="activity-header">
          <div>
            <div className="activity-kicker">Dokumentasi Warga</div>
            <h2 className="activity-title">Postingan Kegiatan</h2>
            <p className="activity-subtitle">Kelola dokumentasi kegiatan warga sebelum ditampilkan di halaman utama.</p>
          </div>
          <button className="admin-small-btn" type="button" onClick={loadPosts} disabled={loading}>
            <LoadingButtonContent loading={loading}>Refresh</LoadingButtonContent>
          </button>
        </div>

        {error ? <div className="admin-error-box">{error}</div> : null}
        <TimelineSummary posts={posts} />

        <div className="admin-card">
          <div className="timeline-admin-form-header">
            <div>
              <h3>{editingPost ? `Sedang Edit: ${editingPost.title}` : "Content Studio Timeline"}</h3>
              <p>Buat postingan, lengkapi konten, tambah foto, preview, lalu tayangkan.</p>
            </div>
            {showForm ? (
              <button type="button" className="admin-small-btn" onClick={resetForm} disabled={saving}>Tutup Form</button>
            ) : (
              <button type="button" className="admin-small-btn" onClick={openCreateForm}>+ Buat Postingan</button>
            )}
          </div>

          {showForm ? (
            <form className="admin-form" onSubmit={handleSubmit}>
              <input className="admin-input" placeholder="Judul kegiatan" value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} />
              <textarea className="admin-input timeline-admin-textarea" placeholder="Deskripsi kegiatan" value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} />
              <div className="timeline-admin-grid">
                <input className="admin-input" placeholder="Kategori, contoh: Kerja Bakti" value={form.category} onChange={(e) => setForm((current) => ({ ...current, category: e.target.value }))} />
                <input className="admin-input" type="date" value={form.event_date} onChange={(e) => setForm((current) => ({ ...current, event_date: e.target.value }))} />
              </div>
              <label className="timeline-admin-check">
                <input type="checkbox" checked={form.published} onChange={(e) => setForm((current) => ({ ...current, published: e.target.checked }))} />
                <span>Tayangkan ke halaman utama</span>
              </label>
              <button className="admin-btn" disabled={saving}>
                <LoadingButtonContent loading={saving} loadingText="Menyimpan...">{editingPost ? "Simpan Perubahan" : "Simpan Draft"}</LoadingButtonContent>
              </button>
            </form>
          ) : null}
        </div>

        <div className="admin-card">
          <div className="timeline-admin-form-header">
            <div>
              <h3>Daftar Postingan</h3>
              <p>Menampilkan {filteredPosts.length} dari {posts.length} postingan.</p>
            </div>
          </div>

          <div className="timeline-admin-grid" style={{ marginBottom: 12 }}>
            <input className="admin-input" placeholder="Cari judul, kategori, tanggal..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <div className="timeline-admin-actions">
              {statusFilters.map((item) => (
                <button key={item.value} type="button" className={statusFilter === item.value ? "admin-small-btn active" : "admin-small-btn"} onClick={() => setStatusFilter(item.value)}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p>Loading postingan...</p>
          ) : posts.length === 0 ? (
            <div className="admin-empty-state">Belum ada postingan kegiatan warga.</div>
          ) : filteredPosts.length === 0 ? (
            <div className="admin-empty-state">Tidak ada postingan yang sesuai filter.</div>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-table timeline-admin-table">
                <thead>
                  <tr>
                    <th className="admin-th">Postingan</th>
                    <th className="admin-th">Status</th>
                    <th className="admin-th">Foto</th>
                    <th className="admin-th">Reaksi</th>
                    <th className="admin-th">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPosts.map((post, index) => {
                    const cover = getPostCover(post);
                    const photoCount = post.images?.length || 0;
                    const state = getReadiness(post);

                    return (
                      <tr key={post.id} className={index % 2 ? "admin-row-alt" : ""}>
                        <td className="admin-td timeline-admin-title-cell">
                          <div className="timeline-admin-post-cell">
                            <div className="timeline-admin-thumb" aria-hidden="true">
                              {cover ? <img src={cover.image_url} alt="" /> : <span>📸</span>}
                            </div>
                            <div>
                              <strong>{post.title}</strong>
                              <span>{post.category || "Tanpa kategori"} • {formatDate(post.event_date || post.created_at)}</span>
                              {!state.ready && state.missing.length ? <span>Kurang: {state.missing.join(", ")}</span> : null}
                            </div>
                          </div>
                        </td>
                        <td className="admin-td"><StatusBadge state={state} /></td>
                        <td className="admin-td"><span className={photoCount > 0 ? "timeline-admin-photo-badge ready" : "timeline-admin-photo-badge warning"}>{photoCount > 0 ? `${photoCount} foto` : "Belum ada foto"}</span></td>
                        <td className="admin-td">{Number(post.reaction_total ?? post.like_count ?? 0).toLocaleString("id-ID")}</td>
                        <td className="admin-td">
                          <div className="timeline-admin-actions">
                            <button className="admin-small-btn" type="button" onClick={() => setPreviewPost(post)}>Preview</button>
                            <button className="admin-small-btn" type="button" onClick={() => openEdit(post)}>Edit</button>
                            <button className="admin-small-btn" type="button" onClick={() => setPhotoPost(post)}>Kelola Foto</button>
                            <button className="admin-small-btn" type="button" disabled={saving} onClick={() => setPublishPost(post)}>{post.published ? "Simpan sebagai Draft" : "Tayangkan"}</button>
                            <button className="admin-small-btn timeline-danger-btn" type="button" onClick={() => setDeletePost(post)}>Hapus</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {photoPost ? (
        <div className={modalStyles.overlay} onClick={resetPhotoState}>
          <div className={`${modalStyles.box} timeline-admin-modal`} onClick={(e) => e.stopPropagation()}>
            <h3>Kelola Foto Postingan</h3>
            <p>{photoPost.title}</p>

            {photoPost.images?.length ? (
              <div className="timeline-admin-photo-grid">
                {photoPost.images.map((image) => {
                  const isCover = photoPost.cover_image_key === image.image_key || photoPost.cover_image_url === image.image_url;
                  return (
                    <div key={image.id} className="timeline-admin-photo-item">
                      <img src={image.image_url} alt="" />
                      {isCover ? <span className="timeline-admin-photo-badge ready">Cover</span> : null}
                      <button type="button" className="admin-small-btn" onClick={() => handleSetCover(image)} disabled={saving || isCover}>Jadikan Cover</button>
                      <button type="button" className="admin-small-btn timeline-danger-btn" onClick={() => handleDeleteImage(image)} disabled={saving}>Hapus Foto</button>
                    </div>
                  );
                })}
              </div>
            ) : <div className="admin-empty-state">Postingan ini belum memiliki foto.</div>}

            <form className="admin-form" onSubmit={handleUpload}>
              <input ref={fileInputRef} className="admin-input" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setImageFiles(Array.from(e.target.files || []))} />
              {imageFiles.length ? <div className="admin-deposit-meta">{imageFiles.length} foto dipilih.</div> : null}
              <input className="admin-input" placeholder="Caption umum opsional" value={imageCaption} onChange={(e) => setImageCaption(e.target.value)} />
              <label className="timeline-admin-check">
                <input type="checkbox" checked={setAsCover} onChange={(e) => setSetAsCover(e.target.checked)} />
                <span>Jadikan foto pertama sebagai cover</span>
              </label>
              <button className="admin-btn" disabled={uploading}>
                <LoadingButtonContent loading={uploading} loadingText="Mengunggah...">Upload {imageFiles.length || ""} Foto</LoadingButtonContent>
              </button>
              <button type="button" className="admin-small-btn" onClick={resetPhotoState} disabled={uploading}>Tutup</button>
            </form>
          </div>
        </div>
      ) : null}

      {previewPost ? (
        <div className={modalStyles.overlay} onClick={() => setPreviewPost(null)}>
          <div className={modalStyles.box} onClick={(e) => e.stopPropagation()}>
            <h3>Preview Postingan</h3>
            {getPostCover(previewPost) ? <img className="timeline-admin-preview-image" src={getPostCover(previewPost).image_url} alt="" /> : null}
            <p>{previewPost.category || "Tanpa kategori"} • {formatDate(previewPost.event_date || previewPost.created_at)}</p>
            <h2>{previewPost.title}</h2>
            <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{previewPost.description || "Belum ada deskripsi."}</p>
            <div className="timeline-admin-confirm-actions">
              <button type="button" className="admin-small-btn" onClick={() => window.open(getPostPreviewUrl(previewPost.id), "_blank", "noopener,noreferrer")}>Buka Halaman Publik</button>
              <button type="button" className="admin-small-btn" onClick={() => setPreviewPost(null)}>Tutup</button>
            </div>
          </div>
        </div>
      ) : null}

      {publishPost ? (
        <div className={modalStyles.overlay} onClick={() => setPublishPost(null)}>
          <div className={modalStyles.box} onClick={(e) => e.stopPropagation()}>
            <h3>{publishPost.published ? "Simpan sebagai Draft?" : "Tayangkan Postingan?"}</h3>
            <p>{publishPost.published ? `Postingan "${publishPost.title}" akan disembunyikan dari halaman utama warga.` : `Postingan "${publishPost.title}" akan tampil di halaman utama warga.`}</p>
            <div className="timeline-admin-confirm-actions">
              <button type="button" className="admin-small-btn" onClick={() => setPublishPost(null)} disabled={saving}>Batal</button>
              <button type="button" className="admin-small-btn" onClick={handleTogglePublish} disabled={saving}>
                <LoadingButtonContent loading={saving} loadingText="Menyimpan...">{publishPost.published ? "Simpan sebagai Draft" : "Tayangkan"}</LoadingButtonContent>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deletePost ? (
        <div className={modalStyles.overlay} onClick={() => setDeletePost(null)}>
          <div className={modalStyles.box} onClick={(e) => e.stopPropagation()}>
            <h3>Hapus Postingan?</h3>
            <p>{`Postingan "${deletePost.title}" akan dihapus beserta foto dan reaksi yang terkait di database.`}</p>
            <div className="timeline-admin-confirm-actions">
              <button type="button" className="admin-small-btn" onClick={() => setDeletePost(null)} disabled={!!deletingId}>Batal</button>
              <button type="button" className="admin-small-btn timeline-danger-btn" onClick={handleDelete} disabled={!!deletingId}>
                <LoadingButtonContent loading={deletingId === deletePost.id} loadingText="Menghapus...">Hapus</LoadingButtonContent>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
