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

function statusClassName(published) {
  return published
    ? "admin-deposit-status admin-deposit-status-paid"
    : "admin-deposit-status admin-deposit-status-waiting";
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

function TimelineSummary({ posts }) {
  const publishedCount = posts.filter((post) => post.published).length;
  const draftCount = posts.length - publishedCount;

  return (
    <div className="admin-summary-cards timeline-admin-summary">
      <div className="admin-summary-card">
        <strong>{posts.length}</strong>
        <span>Total Kegiatan</span>
      </div>
      <div className="admin-summary-card">
        <strong>{publishedCount}</strong>
        <span>Published</span>
      </div>
      <div className="admin-summary-card">
        <strong>{draftCount}</strong>
        <span>Draft</span>
      </div>
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
  const [uploadPost, setUploadPost] = useState(null);
  const [deletePost, setDeletePost] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imageCaption, setImageCaption] = useState("");
  const [setAsCover, setSetAsCover] = useState(true);
  const fileInputRef = useRef(null);

  const sortedPosts = useMemo(() => posts, [posts]);

  async function loadPosts() {
    try {
      setLoading(true);
      setError("");
      const data = await readJson("/api/admin/timeline/posts");
      setPosts(Array.isArray(data.posts) ? data.posts : []);
    } catch (err) {
      setError(err.message || "Gagal memuat kegiatan");
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
  }

  function resetUploadState() {
    setUploadPost(null);
    setImageFile(null);
    setImageCaption("");
    setSetAsCover(true);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const payload = buildPostPayload(form);

    if (!payload.title) {
      setError("Judul kegiatan wajib diisi");
      return;
    }

    setSaving(true);

    try {
      if (editingPost) {
        await sendJson(`/api/admin/timeline/posts/${editingPost.id}`, "PATCH", payload);
        showPopup?.("Kegiatan berhasil diperbarui", "success");
      } else {
        await sendJson("/api/admin/timeline/posts", "POST", payload);
        showPopup?.("Kegiatan berhasil dibuat", "success");
      }

      resetForm();
      await loadPosts();
    } catch (err) {
      const message = err.message || "Gagal menyimpan kegiatan";
      setError(message);
      showPopup?.(message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePublish(post) {
    setError("");
    setSaving(true);

    try {
      await sendJson(`/api/admin/timeline/posts/${post.id}`, "PATCH", {
        published: !post.published,
      });
      showPopup?.(post.published ? "Kegiatan dipindahkan ke draft" : "Kegiatan dipublikasikan", "success");
      await loadPosts();
    } catch (err) {
      const message = err.message || "Gagal mengubah status kegiatan";
      setError(message);
      showPopup?.(message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(e) {
    e.preventDefault();

    if (!uploadPost) return;

    if (!imageFile) {
      setError("Pilih foto kegiatan terlebih dahulu");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("post_id", uploadPost.id);
      formData.append("image", imageFile);
      formData.append("caption", imageCaption);
      formData.append("set_as_cover", setAsCover ? "true" : "false");
      formData.append("sort_order", String(uploadPost.images?.length || 0));

      await sendFormData("/api/admin/timeline/upload", "POST", formData);
      showPopup?.("Foto kegiatan berhasil diunggah", "success");
      resetUploadState();
      await loadPosts();
    } catch (err) {
      const message = err.message || "Gagal mengunggah foto kegiatan";
      setError(message);
      showPopup?.(message, "error");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!deletePost) return;

    setDeletingId(deletePost.id);
    setError("");

    try {
      await sendJson(`/api/admin/timeline/posts/${deletePost.id}`, "DELETE", {});
      showPopup?.("Kegiatan berhasil dihapus", "success");
      setDeletePost(null);
      await loadPosts();
    } catch (err) {
      const message = err.message || "Gagal menghapus kegiatan";
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
            <div className="activity-kicker">Timeline Warga</div>
            <h2 className="activity-title">Kegiatan Warga</h2>
            <p className="activity-subtitle">
              Kelola postingan kegiatan yang tampil di dashboard publik halaman utama.
            </p>
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
              <h3>{editingPost ? "Edit Kegiatan" : "Tambah Kegiatan"}</h3>
              <p>Isi judul, deskripsi, kategori, tanggal, lalu publish jika siap tampil di publik.</p>
            </div>
            {editingPost ? (
              <button type="button" className="admin-small-btn" onClick={resetForm}>
                Batal Edit
              </button>
            ) : null}
          </div>

          <form className="admin-form" onSubmit={handleSubmit}>
            <input
              className="admin-input"
              placeholder="Judul kegiatan"
              value={form.title}
              onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
            />
            <textarea
              className="admin-input timeline-admin-textarea"
              placeholder="Deskripsi kegiatan"
              value={form.description}
              onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
            />
            <div className="timeline-admin-grid">
              <input
                className="admin-input"
                placeholder="Kategori, contoh: Kerja Bakti"
                value={form.category}
                onChange={(e) => setForm((current) => ({ ...current, category: e.target.value }))}
              />
              <input
                className="admin-input"
                type="date"
                value={form.event_date}
                onChange={(e) => setForm((current) => ({ ...current, event_date: e.target.value }))}
              />
            </div>
            <label className="timeline-admin-check">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => setForm((current) => ({ ...current, published: e.target.checked }))}
              />
              <span>Publish ke halaman utama</span>
            </label>
            <button className="admin-btn" disabled={saving}>
              <LoadingButtonContent loading={saving} loadingText="Menyimpan...">
                {editingPost ? "Simpan Perubahan" : "Tambah Kegiatan"}
              </LoadingButtonContent>
            </button>
          </form>
        </div>

        <div className="admin-card">
          <div className="timeline-admin-form-header">
            <div>
              <h3>Daftar Kegiatan</h3>
              <p>Upload foto, publish/unpublish, edit, atau hapus postingan kegiatan.</p>
            </div>
          </div>

          {loading ? (
            <p>Loading kegiatan...</p>
          ) : sortedPosts.length === 0 ? (
            <div className="admin-empty-state">Belum ada kegiatan warga.</div>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-table timeline-admin-table">
                <thead>
                  <tr>
                    <th className="admin-th">Kegiatan</th>
                    <th className="admin-th">Tanggal</th>
                    <th className="admin-th">Status</th>
                    <th className="admin-th">Foto</th>
                    <th className="admin-th">Like</th>
                    <th className="admin-th">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPosts.map((post, index) => (
                    <tr key={post.id} className={index % 2 ? "admin-row-alt" : ""}>
                      <td className="admin-td timeline-admin-title-cell">
                        <strong>{post.title}</strong>
                        <span>{post.category || "Tanpa kategori"}</span>
                      </td>
                      <td className="admin-td">{formatDate(post.event_date || post.created_at)}</td>
                      <td className="admin-td">
                        <span className={statusClassName(post.published)}>
                          {post.published ? "Published" : "Draft"}
                        </span>
                      </td>
                      <td className="admin-td">{post.images?.length || 0}</td>
                      <td className="admin-td">{Number(post.like_count || 0).toLocaleString("id-ID")}</td>
                      <td className="admin-td">
                        <div className="timeline-admin-actions">
                          <button className="admin-small-btn" type="button" onClick={() => setUploadPost(post)}>
                            Foto
                          </button>
                          <button className="admin-small-btn" type="button" onClick={() => openEdit(post)}>
                            Edit
                          </button>
                          <button
                            className="admin-small-btn"
                            type="button"
                            disabled={saving}
                            onClick={() => handleTogglePublish(post)}
                          >
                            {post.published ? "Draft" : "Publish"}
                          </button>
                          <button className="admin-small-btn timeline-danger-btn" type="button" onClick={() => setDeletePost(post)}>
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {uploadPost ? (
        <div className={modalStyles.overlay} onClick={resetUploadState}>
          <div className={`${modalStyles.box} timeline-admin-modal`} onClick={(e) => e.stopPropagation()}>
            <h3>Upload Foto Kegiatan</h3>
            <p>{uploadPost.title}</p>
            <form className="admin-form" onSubmit={handleUpload}>
              <input
                ref={fileInputRef}
                className="admin-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              />
              <input
                className="admin-input"
                placeholder="Caption foto opsional"
                value={imageCaption}
                onChange={(e) => setImageCaption(e.target.value)}
              />
              <label className="timeline-admin-check">
                <input
                  type="checkbox"
                  checked={setAsCover}
                  onChange={(e) => setSetAsCover(e.target.checked)}
                />
                <span>Jadikan cover postingan</span>
              </label>
              <button className="admin-btn" disabled={uploading}>
                <LoadingButtonContent loading={uploading} loadingText="Mengunggah...">
                  Upload Foto
                </LoadingButtonContent>
              </button>
              <button type="button" className="admin-small-btn" onClick={resetUploadState} disabled={uploading}>
                Batal
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {deletePost ? (
        <div className={modalStyles.overlay} onClick={() => setDeletePost(null)}>
          <div className={modalStyles.box} onClick={(e) => e.stopPropagation()}>
            <h3>Hapus Kegiatan?</h3>
            <p>Kegiatan "{deletePost.title}" akan dihapus beserta foto dan like yang terkait di database.</p>
            <div className="timeline-admin-confirm-actions">
              <button type="button" className="admin-small-btn" onClick={() => setDeletePost(null)} disabled={!!deletingId}>
                Batal
              </button>
              <button type="button" className="admin-small-btn timeline-danger-btn" onClick={handleDelete} disabled={!!deletingId}>
                <LoadingButtonContent loading={deletingId === deletePost.id} loadingText="Menghapus...">
                  Hapus
                </LoadingButtonContent>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
