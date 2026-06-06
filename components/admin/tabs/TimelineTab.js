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
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "ready", label: "Ready to Publish" },
  { value: "incomplete", label: "Incomplete" },
  { value: "draft", label: "Draft" },
];

function normalize(value) {
  return String(value || "").trim();
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
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

function TimelineSummary({ posts }) {
  const publishedCount = posts.filter((post) => post.published).length;
  const readyCount = posts.filter((post) => getReadiness(post).value === "ready").length;
  const incompleteCount = posts.filter((post) => getReadiness(post).value === "incomplete").length;
  const draftCount = posts.filter((post) => !post.published).length;

  return (
    <div className="admin-summary-cards timeline-admin-summary">
      <div className="admin-summary-card"><strong>{posts.length}</strong><span>Total Posts</span></div>
      <div className="admin-summary-card"><strong>{publishedCount}</strong><span>Published</span></div>
      <div className="admin-summary-card"><strong>{readyCount}</strong><span>Ready to Publish</span></div>
      <div className="admin-summary-card"><strong>{incompleteCount}</strong><span>Incomplete</span></div>
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
      setError(err.message || "Failed to load posts");
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

    setSaving(true);
    try {
      if (editingPost) {
        await sendJson(`/api/admin/timeline/posts/${editingPost.id}`, "PATCH", payload);
        showPopup?.("Post updated successfully", "success");
      } else {
        await sendJson("/api/admin/timeline/posts", "POST", { ...payload, published: false });
        showPopup?.("Post created as draft", "success");
      }
      resetForm();
      await loadPosts();
    } catch (err) {
      const message = err.message || "Failed to save post";
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
      showPopup?.(publishPost.published ? "Post saved as draft" : "Post published", "success");
      setPublishPost(null);
      await loadPosts();
    } catch (err) {
      const message = err.message || "Failed to change post status";
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
      setError("Select activity photos first");
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
      showPopup?.(`${imageFiles.length} photos uploaded successfully`, "success");
      resetPhotoState();
      await loadPosts();
    } catch (err) {
      const message = err.message || "Failed to upload photo";
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
      showPopup?.("Cover updated successfully", "success");
      setPhotoPost((current) => current ? { ...current, cover_image_key: image.image_key, cover_image_url: image.image_url } : current);
      await loadPosts();
    } catch (err) {
      const message = err.message || "Failed to update cover";
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

      showPopup?.("Photo deleted successfully", "success");
      setPhotoPost((current) => current ? {
        ...current,
        images: remainingImages,
        cover_image_key: isCurrentCover ? (nextCover?.image_key || "") : current.cover_image_key,
        cover_image_url: isCurrentCover ? (nextCover?.image_url || "") : current.cover_image_url,
      } : current);
      await loadPosts();
    } catch (err) {
      const message = err.message || "Failed to delete photo";
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
      showPopup?.("Post deleted successfully", "success");
      setDeletePost(null);
      await loadPosts();
    } catch (err) {
      const message = err.message || "Failed to delete post";
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
            <div className="activity-kicker">Resident Documentation</div>
            <h2 className="activity-title">Activity Posts</h2>
            <p className="activity-subtitle">Manage resident activity documentation before displaying it on the main page.</p>
          </div>
          <button className="admin-small-btn admin-refresh-btn" type="button" onClick={loadPosts} disabled={loading}>
            <LoadingButtonContent loading={loading}>Refresh</LoadingButtonContent>
          </button>
        </div>

        {error ? <div className="admin-error-box">{error}</div> : null}
        <TimelineSummary posts={posts} />

        <div className="admin-card">
          <div className="timeline-admin-form-header">
            <div>
              <h3>{editingPost ? `Editing: ${editingPost.title}` : "Timeline Content Studio"}</h3>
              <p>Create a post, complete the content, add photos, preview it, then publish.</p>
            </div>
            {showForm ? (
              <button type="button" className="admin-small-btn timeline-form-toggle" onClick={resetForm} disabled={saving}>Close Form</button>
            ) : (
              <button type="button" className="admin-small-btn timeline-form-toggle" onClick={openCreateForm}>+ Create Post</button>
            )}
          </div>

          {showForm ? (
            <form className="admin-form admin-collapsible-panel" onSubmit={handleSubmit}>
              <input className="admin-input" placeholder="Activity title" value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} />
              <textarea className="admin-input timeline-admin-textarea" placeholder="Activity description" value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} />
              <div className="timeline-admin-grid">
                <input className="admin-input" placeholder="Category, example: Community Cleanup" value={form.category} onChange={(e) => setForm((current) => ({ ...current, category: e.target.value }))} />
                <input className="admin-input" type="date" value={form.event_date} onChange={(e) => setForm((current) => ({ ...current, event_date: e.target.value }))} />
              </div>
              <label className="timeline-admin-check">
                <input type="checkbox" checked={form.published} onChange={(e) => setForm((current) => ({ ...current, published: e.target.checked }))} />
                <span>Publish to main page</span>
              </label>
              <button className="admin-btn" disabled={saving}>
                <LoadingButtonContent loading={saving} loadingText="Saving...">{editingPost ? "Save Changes" : "Save Draft"}</LoadingButtonContent>
              </button>
            </form>
          ) : null}
        </div>

        <div className="admin-card">
          <div className="timeline-admin-form-header">
            <div>
              <h3>Post List</h3>
              <p>Showing {filteredPosts.length} of {posts.length} posts.</p>
            </div>
          </div>

          <div className="timeline-admin-grid" style={{ marginBottom: 12 }}>
            <input className="admin-input" placeholder="Search title, category, date..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <div className="timeline-admin-actions">
              {statusFilters.map((item) => (
                <button key={item.value} type="button" className={statusFilter === item.value ? "admin-small-btn timeline-filter-btn timeline-filter-btn-active active" : "admin-small-btn timeline-filter-btn"} onClick={() => setStatusFilter(item.value)}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p>Loading posts...</p>
          ) : posts.length === 0 ? (
            <div className="admin-empty-state">No resident activity posts yet.</div>
          ) : filteredPosts.length === 0 ? (
            <div className="admin-empty-state">No posts match the selected filter.</div>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-table timeline-admin-table">
                <thead>
                  <tr>
                    <th className="admin-th">Post</th>
                    <th className="admin-th">Status</th>
                    <th className="admin-th">Photo</th>
                    <th className="admin-th">Reaction</th>
                    <th className="admin-th">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPosts.map((post, index) => {
                    const cover = getPostCover(post);
                    const photoCount = post.images?.length || 0;
                    const state = getReadiness(post);

                    return (
                      <tr key={post.id} className={index % 2 ? "admin-row-alt timeline-admin-row" : "timeline-admin-row"}>
                        <td className="admin-td timeline-admin-title-cell">
                          <div className="timeline-admin-post-cell">
                            <div className="timeline-admin-thumb" aria-hidden="true">
                              {cover ? <img src={cover.image_url} alt="" /> : <span>📸</span>}
                            </div>
                            <div>
                              <strong>{post.title}</strong>
                              <span>{post.category || "Uncategorized"} • {formatDate(post.event_date || post.created_at)}</span>
                              {!state.ready && state.missing.length ? <span>Missing: {state.missing.join(", ")}</span> : null}
                            </div>
                          </div>
                        </td>
                        <td className="admin-td"><StatusBadge state={state} /></td>
                        <td className="admin-td"><span className={photoCount > 0 ? "timeline-admin-photo-badge ready" : "timeline-admin-photo-badge warning"}>{photoCount > 0 ? `${photoCount} photos` : "No photos yet"}</span></td>
                        <td className="admin-td">{Number(post.reaction_total ?? post.like_count ?? 0).toLocaleString("id-ID")}</td>
                        <td className="admin-td">
                          <div className="timeline-admin-actions">
                            <button className="admin-small-btn" type="button" onClick={() => setPreviewPost(post)}>Preview</button>
                            <button className="admin-small-btn" type="button" onClick={() => openEdit(post)}>Edit</button>
                            <button className="admin-small-btn" type="button" onClick={() => setPhotoPost(post)}>Manage Photos</button>
                            <button className="admin-small-btn" type="button" disabled={saving} onClick={() => setPublishPost(post)}>{post.published ? "Save as Draft" : "Publish"}</button>
                            <button className="admin-small-btn timeline-danger-btn" type="button" onClick={() => setDeletePost(post)}>Delete</button>
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
            <h3>Manage Post Photos</h3>
            <p>{photoPost.title}</p>

            {photoPost.images?.length ? (
              <div className="timeline-admin-photo-grid">
                {photoPost.images.map((image) => {
                  const isCover = photoPost.cover_image_key === image.image_key || photoPost.cover_image_url === image.image_url;
                  return (
                    <div key={image.id} className="timeline-admin-photo-item">
                      <img src={image.image_url} alt="" />
                      {isCover ? <span className="timeline-admin-photo-badge ready">Cover</span> : null}
                      <button type="button" className="admin-small-btn" onClick={() => handleSetCover(image)} disabled={saving || isCover}>Set as Cover</button>
                      <button type="button" className="admin-small-btn timeline-danger-btn" onClick={() => handleDeleteImage(image)} disabled={saving}>Delete Photo</button>
                    </div>
                  );
                })}
              </div>
            ) : <div className="admin-empty-state">This post has no photos yet.</div>}

            <form className="admin-form admin-collapsible-panel" onSubmit={handleUpload}>
              <input ref={fileInputRef} className="admin-input" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setImageFiles(Array.from(e.target.files || []))} />
              {imageFiles.length ? <div className="admin-deposit-meta timeline-selected-files">{imageFiles.length} photos selected.</div> : null}
              <input className="admin-input" placeholder="Optional general caption" value={imageCaption} onChange={(e) => setImageCaption(e.target.value)} />
              <label className="timeline-admin-check">
                <input type="checkbox" checked={setAsCover} onChange={(e) => setSetAsCover(e.target.checked)} />
                <span>Use the first photo as the cover</span>
              </label>
              <button className="admin-btn" disabled={uploading}>
                <LoadingButtonContent loading={uploading} loadingText="Uploading...">Upload {imageFiles.length || ""} Photos</LoadingButtonContent>
              </button>
              <button type="button" className="admin-small-btn" onClick={resetPhotoState} disabled={uploading}>Close</button>
            </form>
          </div>
        </div>
      ) : null}

      {previewPost ? (
        <div className={modalStyles.overlay} onClick={() => setPreviewPost(null)}>
          <div className={modalStyles.box} onClick={(e) => e.stopPropagation()}>
            <h3>Post Preview</h3>
            {getPostCover(previewPost) ? <img className="timeline-admin-preview-image" src={getPostCover(previewPost).image_url} alt="" /> : null}
            <p>{previewPost.category || "Uncategorized"} • {formatDate(previewPost.event_date || previewPost.created_at)}</p>
            <h2>{previewPost.title}</h2>
            <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{previewPost.description || "No description yet."}</p>
            <div className="timeline-admin-confirm-actions">
              <button type="button" className="admin-small-btn" onClick={() => window.open(getPostPreviewUrl(previewPost.id), "_blank", "noopener,noreferrer")}>Open Public Page</button>
              <button type="button" className="admin-small-btn" onClick={() => setPreviewPost(null)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}

      {publishPost ? (
        <div className={modalStyles.overlay} onClick={() => setPublishPost(null)}>
          <div className={modalStyles.box} onClick={(e) => e.stopPropagation()}>
            <h3>{publishPost.published ? "Save as Draft?" : "Publish Post?"}</h3>
            <p>{publishPost.published ? `Post "${publishPost.title}" will be hidden from the residents' main page.` : `Post "${publishPost.title}" will appear on the residents' main page.`}</p>
            <div className="timeline-admin-confirm-actions">
              <button type="button" className="admin-small-btn" onClick={() => setPublishPost(null)} disabled={saving}>Cancel</button>
              <button type="button" className="admin-small-btn" onClick={handleTogglePublish} disabled={saving}>
                <LoadingButtonContent loading={saving} loadingText="Saving...">{publishPost.published ? "Save as Draft" : "Publish"}</LoadingButtonContent>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deletePost ? (
        <div className={modalStyles.overlay} onClick={() => setDeletePost(null)}>
          <div className={modalStyles.box} onClick={(e) => e.stopPropagation()}>
            <h3>Delete Post?</h3>
            <p>{`Post "${deletePost.title}" will be deleted along with related photos and reactions in the database.`}</p>
            <div className="timeline-admin-confirm-actions">
              <button type="button" className="admin-small-btn" onClick={() => setDeletePost(null)} disabled={!!deletingId}>Cancel</button>
              <button type="button" className="admin-small-btn timeline-danger-btn" onClick={handleDelete} disabled={!!deletingId}>
                <LoadingButtonContent loading={deletingId === deletePost.id} loadingText="Deleting...">Delete</LoadingButtonContent>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}