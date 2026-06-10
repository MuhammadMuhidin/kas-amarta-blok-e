"use client";

import LoadingButtonContent from "@/components/admin/LoadingButtonContent";
import modalStyles from "@/components/admin/AdminModal.module.css";
import { readJson, sendFormData, sendJson } from "@/components/admin/adminClientApi";
import { formatJakartaDate } from "@/lib/localDate";
import { useEffect, useMemo, useRef, useState } from "react";

const emptyForm = {
  title: "",
  description: "",
  category: "",
  event_date: "",
  published: false,
};

const statusFilters = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "ready", label: "Ready to Publish" },
  { value: "incomplete", label: "Incomplete" },
  { value: "draft", label: "Draft" },
];

const reactionItems = [
  { key: "like", emoji: "👍", label: "Suka" },
  { key: "care", emoji: "❤️", label: "Peduli" },
  { key: "thanks", emoji: "🙏", label: "Terima kasih" },
  { key: "appreciate", emoji: "👏", label: "Apresiasi" },
  { key: "informative", emoji: "💡", label: "Informatif" },
];

function normalize(value) {
  return String(value || "").trim();
}

function formatDate(value) {
  return formatJakartaDate(value, "id-ID");
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("id-ID");
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

function getPostImages(post) {
  return Array.isArray(post?.images) ? post.images.filter((image) => image?.image_url) : [];
}

function getPostCover(post) {
  const images = getPostImages(post);

  if (post.cover_image_url) {
    return images.find((image) => image.image_url === post.cover_image_url || image.image_key === post.cover_image_key) || {
      image_url: post.cover_image_url,
    };
  }

  return images[0] || null;
}

function imageIsCover(post, image) {
  if (!post || !image) return false;

  return Boolean(
    (post.cover_image_key && image.image_key === post.cover_image_key) ||
    (post.cover_image_url && image.image_url === post.cover_image_url),
  );
}

function getReadiness(post) {
  const missing = [];

  if (!normalize(post.title)) missing.push("title");
  if (!normalize(post.description)) missing.push("description");
  if (!normalize(post.event_date)) missing.push("date");
  if (!post.images?.length) missing.push("photo");

  if (post.published) return { value: "published", label: "Published", missing, ready: missing.length === 0 };
  if (missing.length > 0) return { value: "incomplete", label: "Incomplete", missing, ready: false };
  return { value: "ready", label: "Ready to Publish", missing, ready: true };
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

function ReactionSummary({ post }) {
  const counts = post?.reaction_counts || {};
  const total = Number(post?.reaction_total ?? post?.like_count ?? 0);

  return (
    <div className="timeline-admin-reactions" aria-label={`${formatNumber(total)} total reactions`}>
      <span className="timeline-admin-reaction-total">💬 {formatNumber(total)}</span>
      <div className="timeline-admin-reaction-breakdown">
        {reactionItems.map((reaction) => (
          <span key={reaction.key} title={reaction.label}>
            <span aria-hidden="true">{reaction.emoji}</span> {formatNumber(counts[reaction.key] || 0)}
          </span>
        ))}
      </div>
    </div>
  );
}

function TimelineSummary({ posts }) {
  const publishedCount = posts.filter((post) => post.published).length;
  const readyCount = posts.filter((post) => getReadiness(post).value === "ready").length;
  const incompleteCount = posts.filter((post) => getReadiness(post).value === "incomplete").length;
  const draftCount = posts.filter((post) => !post.published).length;
  const reactionCount = posts.reduce((sum, post) => sum + Number(post.reaction_total ?? post.like_count ?? 0), 0);

  return (
    <div className="admin-summary-cards timeline-admin-summary">
      <div className="admin-summary-card"><strong>{posts.length}</strong><span>Total Posts</span></div>
      <div className="admin-summary-card"><strong>{publishedCount}</strong><span>Published</span></div>
      <div className="admin-summary-card"><strong>{readyCount}</strong><span>Ready to Publish</span></div>
      <div className="admin-summary-card"><strong>{incompleteCount}</strong><span>Incomplete</span></div>
      <div className="admin-summary-card"><strong>{draftCount}</strong><span>Draft</span></div>
      <div className="admin-summary-card"><strong>{formatNumber(reactionCount)}</strong><span>Reactions</span></div>
    </div>
  );
}

export default function TimelineTab({ showPopup }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [imageActionId, setImageActionId] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingPost, setEditingPost] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [photoPost, setPhotoPost] = useState(null);
  const [previewPost, setPreviewPost] = useState(null);
  const [deletePost, setDeletePost] = useState(null);
  const [deleteImageTarget, setDeleteImageTarget] = useState(null);
  const [publishPost, setPublishPost] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [imageCaption, setImageCaption] = useState("");
  const [imageSortOrder, setImageSortOrder] = useState("");
  const [imageDrafts, setImageDrafts] = useState({});
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

  function buildImageDrafts(post) {
    return Object.fromEntries(
      getPostImages(post).map((image) => [
        image.id,
        {
          caption: image.caption || "",
          sort_order: String(image.sort_order ?? 0),
        },
      ]),
    );
  }

  async function loadPosts(options = {}) {
    const { keepPhotoPostId = "", silent = false } = options;

    try {
      if (!silent) setLoading(true);
      setError("");
      const data = await readJson("/api/admin/timeline/posts");
      const nextPosts = Array.isArray(data.posts) ? data.posts : [];
      setPosts(nextPosts);

      if (keepPhotoPostId) {
        const nextPhotoPost = nextPosts.find((post) => post.id === keepPhotoPostId) || null;
        setPhotoPost(nextPhotoPost);
        setImageDrafts(buildImageDrafts(nextPhotoPost));
      }

      return nextPosts;
    } catch (err) {
      setError(err.message || "Failed to load posts");
      return [];
    } finally {
      if (!silent) setLoading(false);
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

  function openPhotos(post) {
    setPhotoPost(post);
    setImageDrafts(buildImageDrafts(post));
    setImageFiles([]);
    setImageCaption("");
    setImageSortOrder("");
    setSetAsCover(!getPostImages(post).length);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function resetPhotoState() {
    setPhotoPost(null);
    setImageFiles([]);
    setImageCaption("");
    setImageSortOrder("");
    setImageDrafts({});
    setSetAsCover(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function validateBeforePublish(post) {
    const state = getReadiness(post);
    if (state.ready) return true;

    const message = `Complete ${state.missing.join(", ")} before publishing the post.`;
    setError(message);
    showPopup?.(message, "warning");
    return false;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const payload = buildPostPayload(form);
    if (!payload.title) {
      setError("Activity title is required");
      return;
    }

    if (payload.published) {
      const nextPost = { ...(editingPost || {}), ...payload, images: editingPost?.images || [] };
      if (!validateBeforePublish(nextPost)) return;
    }

    try {
      setSaving(true);
      if (editingPost?.id) await sendJson(`/api/admin/timeline/posts/${editingPost.id}`, "PATCH", payload);
      else await sendJson("/api/admin/timeline/posts", "POST", payload);
      showPopup?.("Timeline post saved", "success");
      resetForm();
      await loadPosts();
    } catch (err) {
      setError(err.message || "Failed to save post");
      showPopup?.(err.message || "Failed to save post", "error");
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhotos(e) {
    e.preventDefault();
    if (!photoPost?.id || imageFiles.length === 0) return;

    try {
      setUploading(true);
      const formData = new FormData();
      imageFiles.forEach((file) => formData.append("images", file));
      formData.append("post_id", photoPost.id);
      formData.append("caption", imageCaption);
      formData.append("sort_order", normalize(imageSortOrder) || String(getPostImages(photoPost).length));
      formData.append("set_as_cover", setAsCover ? "true" : "false");
      await sendFormData("/api/admin/timeline/upload", "POST", formData);
      showPopup?.("Photos uploaded", "success");
      setImageFiles([]);
      setImageCaption("");
      setImageSortOrder("");
      setSetAsCover(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadPosts({ keepPhotoPostId: photoPost.id, silent: true });
    } catch (err) {
      setError(err.message || "Failed to upload photos");
      showPopup?.(err.message || "Failed to upload photos", "error");
    } finally {
      setUploading(false);
    }
  }

  async function updateImage(image, payload, successMessage) {
    if (!image?.id || imageActionId) return;

    try {
      setImageActionId(image.id);
      await sendJson(`/api/admin/timeline/images/${image.id}`, "PATCH", payload);
      showPopup?.(successMessage || "Photo updated", "success");
      await loadPosts({ keepPhotoPostId: photoPost?.id || image.post_id, silent: true });
    } catch (err) {
      setError(err.message || "Failed to update photo");
      showPopup?.(err.message || "Failed to update photo", "error");
    } finally {
      setImageActionId("");
    }
  }

  async function saveImageDetails(image) {
    const draft = imageDrafts[image.id] || {};
    await updateImage(
      image,
      {
        caption: draft.caption || "",
        sort_order: Number(draft.sort_order || 0),
      },
      "Photo details saved",
    );
  }

  async function setImageAsCover(image) {
    await updateImage(image, { set_as_cover: true }, "Cover photo updated");
  }

  async function moveImage(image, direction) {
    if (!image?.id || imageActionId) return;
    const images = getPostImages(photoPost).slice().sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
    const currentIndex = images.findIndex((item) => item.id === image.id);
    const targetIndex = currentIndex + direction;
    const targetImage = images[targetIndex];

    if (currentIndex < 0 || !targetImage) return;

    try {
      setImageActionId(image.id);
      await sendJson(`/api/admin/timeline/images/${image.id}`, "PATCH", { sort_order: Number(targetImage.sort_order || targetIndex) });
      await sendJson(`/api/admin/timeline/images/${targetImage.id}`, "PATCH", { sort_order: Number(image.sort_order || currentIndex) });
      showPopup?.("Photo order updated", "success");
      await loadPosts({ keepPhotoPostId: photoPost?.id || image.post_id, silent: true });
    } catch (err) {
      setError(err.message || "Failed to move photo");
      showPopup?.(err.message || "Failed to move photo", "error");
    } finally {
      setImageActionId("");
    }
  }

  async function deleteImage(image) {
    if (!image?.id || imageActionId) return;

    try {
      setImageActionId(image.id);
      await sendJson(`/api/admin/timeline/images/${image.id}`, "DELETE", {});
      showPopup?.("Photo deleted", "success");
      setDeleteImageTarget(null);
      await loadPosts({ keepPhotoPostId: photoPost?.id || image.post_id, silent: true });
    } catch (err) {
      setError(err.message || "Failed to delete photo");
      showPopup?.(err.message || "Failed to delete photo", "error");
    } finally {
      setImageActionId("");
    }
  }

  async function deleteSelectedPost() {
    if (!deletePost?.id || deletingId) return;

    try {
      setDeletingId(deletePost.id);
      await sendJson(`/api/admin/timeline/posts/${deletePost.id}`, "DELETE", {});
      showPopup?.("Timeline post deleted", "success");
      setDeletePost(null);
      await loadPosts();
    } catch (err) {
      setError(err.message || "Failed to delete post");
      showPopup?.(err.message || "Failed to delete post", "error");
    } finally {
      setDeletingId("");
    }
  }

  async function togglePublish(post, published) {
    if (!post?.id || saving) return;
    const nextPost = { ...post, published };
    if (published && !validateBeforePublish(nextPost)) return;

    try {
      setSaving(true);
      await sendJson(`/api/admin/timeline/posts/${post.id}`, "PATCH", { published });
      showPopup?.(published ? "Timeline post published" : "Timeline post unpublished", "success");
      setPublishPost(null);
      await loadPosts();
    } catch (err) {
      setError(err.message || "Failed to update publish status");
      showPopup?.(err.message || "Failed to update publish status", "error");
    } finally {
      setSaving(false);
    }
  }

  function closeMediaModals() {
    if (uploading || deletingId || saving || imageActionId) return;
    resetPhotoState();
    setPreviewPost(null);
    setDeletePost(null);
    setDeleteImageTarget(null);
    setPublishPost(null);
  }

  const photoImages = getPostImages(photoPost).slice().sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

  return (
    <div className="admin-card timeline-admin">
      <div className="timeline-admin-header">
        <div>
          <h3>Timeline Management</h3>
          <p>Create and manage public activity posts.</p>
        </div>
        <button type="button" className="admin-btn" onClick={openCreateForm}>Add Post</button>
      </div>

      {error && <div className="admin-error-box">{error}</div>}

      <TimelineSummary posts={posts} />

      <div className="timeline-admin-toolbar">
        <input className="admin-input" type="search" placeholder="Search timeline..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        <select className="admin-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {statusFilters.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>

      {loading ? <p>Loading timeline...</p> : (
        <div className="timeline-admin-list">
          {filteredPosts.map((post) => {
            const state = getReadiness(post);
            const cover = getPostCover(post);
            return <div key={post.id} className="timeline-admin-item">
              <div className="timeline-admin-cover">{cover ? <img src={cover.image_url} alt={post.title || "Timeline cover"} /> : <span>No Photo</span>}</div>
              <div className="timeline-admin-content">
                <div className="timeline-admin-title-row"><h4>{post.title || "Untitled"}</h4><StatusBadge state={state} /></div>
                <p>{post.description || "No description"}</p>
                <div className="timeline-admin-meta">{post.category || "Uncategorized"} • {formatDate(post.event_date || post.created_at)} • {post.images?.length || 0} photo</div>
                <ReactionSummary post={post} />
                {state.missing.length > 0 && <div className="timeline-admin-missing">Missing: {state.missing.join(", ")}</div>}
                <div className="timeline-admin-actions">
                  <button type="button" className="admin-small-btn" onClick={() => openEdit(post)}>Edit</button>
                  <button type="button" className="admin-small-btn" onClick={() => openPhotos(post)}>Photos</button>
                  <button type="button" className="admin-small-btn" onClick={() => setPreviewPost(post)}>Preview</button>
                  {post.published ? (
                    <button type="button" className="admin-small-btn" disabled={saving} onClick={() => togglePublish(post, false)}>Unpublish</button>
                  ) : (
                    <button type="button" className="admin-small-btn" disabled={saving} onClick={() => setPublishPost(post)}>Publish</button>
                  )}
                  <button type="button" className="admin-small-btn" onClick={() => setDeletePost(post)} style={{ borderColor: "var(--admin-expense)", color: "var(--admin-expense)" }}>Delete</button>
                </div>
              </div>
            </div>;
          })}
          {filteredPosts.length === 0 && <div className="admin-empty-state">No timeline posts found.</div>}
        </div>
      )}

      {showForm && (
        <div className={modalStyles.overlay} onClick={saving ? undefined : resetForm}>
          <div className={modalStyles.box} onClick={(e) => e.stopPropagation()}>
            <div className="timeline-admin-form-header">
              <div>
                <h3>{editingPost?.id ? "Edit Post" : "Add Post"}</h3>
                <p>{editingPost?.id ? editingPost.title || "Untitled" : "Buat postingan kegiatan baru."}</p>
              </div>
            </div>
            <form className="timeline-form" onSubmit={handleSubmit}>
              <input className="admin-input" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <textarea className="admin-input" placeholder="Description" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <input className="admin-input" placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <input className="admin-input" type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
              <label className="timeline-check"><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> Publish immediately</label>
              <div className="timeline-form-actions">
                <button type="button" className="admin-small-btn" disabled={saving} onClick={resetForm}>Cancel</button>
                <button type="submit" className="admin-btn" disabled={saving}>
                  <LoadingButtonContent loading={saving} loadingText="Saving...">Save Post</LoadingButtonContent>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {photoPost && (
        <div className={modalStyles.overlay} onClick={closeMediaModals}>
          <div className={modalStyles.box} onClick={(e) => e.stopPropagation()}>
            <div className="timeline-admin-form-header">
              <div>
                <h3>Manage Photos</h3>
                <p>{photoPost.title} • {photoImages.length} photo</p>
              </div>
            </div>

            <section className="timeline-form">
              <h4 style={{ margin: 0 }}>Upload Photos</h4>
              <form onSubmit={uploadPhotos} className="timeline-photo-upload-form">
                <input ref={fileInputRef} className="admin-input" type="file" multiple accept="image/*" onChange={(e) => setImageFiles(Array.from(e.target.files || []))} />
                <input className="admin-input" placeholder="Caption untuk foto baru" value={imageCaption} onChange={(e) => setImageCaption(e.target.value)} />
                <input className="admin-input" type="number" placeholder={`Sort order, default ${photoImages.length}`} value={imageSortOrder} onChange={(e) => setImageSortOrder(e.target.value)} />
                <label className="timeline-check"><input type="checkbox" checked={setAsCover} onChange={(e) => setSetAsCover(e.target.checked)} /> Set first image as cover</label>
                <div className="timeline-form-actions">
                  <button className="admin-btn" disabled={uploading || imageFiles.length === 0}>
                    <LoadingButtonContent loading={uploading} loadingText="Uploading...">Upload</LoadingButtonContent>
                  </button>
                </div>
              </form>
            </section>

            <section className="timeline-photo-manage-section">
              <h4>Existing Photos</h4>
              {photoImages.length > 0 ? (
                <div className="timeline-admin-photo-grid timeline-admin-photo-manage-grid">
                  {photoImages.map((image, index) => {
                    const draft = imageDrafts[image.id] || { caption: image.caption || "", sort_order: String(image.sort_order ?? 0) };
                    const isCover = imageIsCover(photoPost, image);
                    const busy = imageActionId === image.id;

                    return (
                      <div className="timeline-admin-photo-item timeline-admin-photo-manage-item" key={image.id || image.image_url}>
                        <div className="timeline-admin-photo-preview-wrap">
                          <img src={image.image_url} alt={image.caption || photoPost.title || "Foto kegiatan"} />
                          {isCover ? <span className="timeline-admin-cover-badge">Cover</span> : null}
                        </div>
                        <input
                          className="admin-input"
                          placeholder="Caption"
                          value={draft.caption}
                          onChange={(e) => setImageDrafts((current) => ({
                            ...current,
                            [image.id]: { ...draft, caption: e.target.value },
                          }))}
                        />
                        <input
                          className="admin-input"
                          type="number"
                          placeholder="Sort order"
                          value={draft.sort_order}
                          onChange={(e) => setImageDrafts((current) => ({
                            ...current,
                            [image.id]: { ...draft, sort_order: e.target.value },
                          }))}
                        />
                        <div className="timeline-admin-photo-move-actions">
                          <button type="button" className="admin-small-btn" disabled={busy || index === 0} onClick={() => moveImage(image, -1)}>↑ Up</button>
                          <button type="button" className="admin-small-btn" disabled={busy || index === photoImages.length - 1} onClick={() => moveImage(image, 1)}>↓ Down</button>
                        </div>
                        <div className="timeline-admin-photo-actions">
                          <button type="button" className="admin-small-btn" disabled={busy} onClick={() => saveImageDetails(image)}>
                            <LoadingButtonContent loading={busy} loadingText="Saving...">Save</LoadingButtonContent>
                          </button>
                          <button type="button" className="admin-small-btn" disabled={busy || isCover} onClick={() => setImageAsCover(image)}>
                            Set Cover
                          </button>
                          <button type="button" className="admin-small-btn" disabled={busy} onClick={() => setDeleteImageTarget(image)} style={{ borderColor: "var(--admin-expense)", color: "var(--admin-expense)" }}>
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="admin-empty-state">Belum ada foto untuk post ini.</div>
              )}
            </section>
          </div>
        </div>
      )}

      {previewPost && <div className={modalStyles.overlay} onClick={closeMediaModals}><div className={modalStyles.box} onClick={(e) => e.stopPropagation()}><h3>{previewPost.title}</h3><p>{formatDate(previewPost.event_date || previewPost.created_at)}</p><p>{previewPost.description}</p><ReactionSummary post={previewPost} /><div className="timeline-preview-grid">{(previewPost.images || []).map((image) => <img key={image.id || image.image_url} src={image.image_url} alt={image.caption || previewPost.title} />)}</div></div></div>}

      {deletePost && <div className={modalStyles.overlay} onClick={closeMediaModals}><div className={modalStyles.box} onClick={(e) => e.stopPropagation()}><h3>Delete Post?</h3><p>{deletePost.title}</p><div className="timeline-form-actions"><button type="button" className="admin-small-btn" disabled={Boolean(deletingId)} onClick={closeMediaModals}>Cancel</button><button type="button" className="admin-btn" disabled={Boolean(deletingId)} onClick={deleteSelectedPost}><LoadingButtonContent loading={deletingId === deletePost.id} loadingText="Deleting...">Delete</LoadingButtonContent></button></div></div></div>}

      {deleteImageTarget && <div className={modalStyles.overlay} onClick={closeMediaModals}><div className={modalStyles.box} onClick={(e) => e.stopPropagation()}><h3>Delete Photo?</h3><p>{deleteImageTarget.caption || photoPost?.title || "Foto kegiatan"}</p>{deleteImageTarget.image_url ? <img className="timeline-admin-preview-image" src={deleteImageTarget.image_url} alt={deleteImageTarget.caption || "Foto kegiatan"} /> : null}<div className="timeline-form-actions"><button type="button" className="admin-small-btn" disabled={Boolean(imageActionId)} onClick={() => setDeleteImageTarget(null)}>Cancel</button><button type="button" className="admin-btn" disabled={Boolean(imageActionId)} onClick={() => deleteImage(deleteImageTarget)}><LoadingButtonContent loading={imageActionId === deleteImageTarget.id} loadingText="Deleting...">Delete Photo</LoadingButtonContent></button></div></div></div>}

      {publishPost && <div className={modalStyles.overlay} onClick={closeMediaModals}><div className={modalStyles.box} onClick={(e) => e.stopPropagation()}><h3>Publish Post?</h3><p>{publishPost.title}</p><div className="timeline-form-actions"><button type="button" className="admin-small-btn" disabled={saving} onClick={closeMediaModals}>Cancel</button><button type="button" className="admin-btn" disabled={saving} onClick={() => togglePublish(publishPost, true)}><LoadingButtonContent loading={saving} loadingText="Publishing...">Publish</LoadingButtonContent></button></div></div></div>}
    </div>
  );
}
