"use client";

import AdminDataSkeleton from "@/components/admin/AdminDataSkeleton";
import useInfiniteRows from "@/components/admin/useInfiniteRows";
import Toast from "@/components/Toast";
import { useCallback, useState } from "react";

const API = "/api/admin/complaint-suggestions";
const PAGE_SIZE = 10;

function date(value) {
  const parsed = new Date(value);
  return value && !Number.isNaN(parsed.getTime())
    ? parsed.toLocaleString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";
}

function ComplaintCard({ row }) {
  const [photoModal, setPhotoModal] = useState(false);

  return (
    <article className="cs-card">
      <div className="cs-head">
        <div className="cs-main-info">
          <div className="cs-date">{date(row.created_at)}</div>
          <div className="cs-meta">
            <span className="cs-name">{row.nama}</span>
            <span className="cs-sep">·</span>
            <span className="cs-house">{row.rumah}</span>
          </div>
          <div className="cs-body-mobile">{row.kritik}</div>
        </div>
        {row.photo_url ? (
          <button
            type="button"
            className="cs-photo-btn"
            onClick={() => setPhotoModal(true)}
            aria-label="View photo"
          >
            <img src={row.photo_url} alt="Attachment" loading="lazy" className="cs-thumb-btn" />
          </button>
        ) : null}
      </div>
      <div className="cs-body-desktop">{row.kritik}</div>

      {photoModal && (
        <div className="cs-modal-overlay" onClick={() => setPhotoModal(false)}>
          <div className="cs-modal-box" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="cs-modal-close" onClick={() => setPhotoModal(false)} aria-label="Close">×</button>
            <img src={row.photo_url} alt="Attachment" className="cs-modal-img" />
          </div>
        </div>
      )}
    </article>
  );
}

function ComplaintListPanel({ showToast }) {
  const {
    items: rows,
    total,
    loading,
    loadingMore,
    error,
    hasMore,
    loaderRef,
    refresh,
  } = useInfiniteRows({
    pageSize: PAGE_SIZE,
    buildUrl: ({ page, limit }) => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      return `${API}?${params.toString()}`;
    },
    getItems: (data) => data.complaints || [],
    getPagination: (data) => data.pagination || {},
  });

  const initialLoading = loading && !rows.length;

  return (
    <div role="tabpanel" id="complaint-suggestions-panel">
      <div className="cs-list-header">
        <div>
          <div className="activity-kicker">Resident Complaints</div>
          <h3 className="activity-title cs-title">Complaint and Suggestions</h3>
          <p className="activity-subtitle">
            All complaints from residents. Latest shown first.
          </p>
        </div>
      </div>

      {error && <div className="admin-error-box">{error}</div>}

      {initialLoading ? (
        <AdminDataSkeleton rows={5} />
      ) : rows.length === 0 ? (
        <div className="admin-empty-state" style={{ padding: "14px 12px" }}>
          No complaints from residents yet.
        </div>
      ) : (
        <div className="cs-list">
          {rows.map((row) => (
            <ComplaintCard key={row.id} row={row} />
          ))}
        </div>
      )}

      <div ref={loaderRef} className="cs-loader">
        {initialLoading
          ? ""
          : loadingMore
            ? "Loading more..."
            : hasMore
              ? "Scroll to load more"
              : "All complaints loaded"}
      </div>
    </div>
  );
}

export default function ComplaintSuggestionsTab() {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  return (
    <>
      <Toast show={Boolean(toast)} type={toast?.type} message={toast?.message} />
      <style jsx global>{CSS}</style>
      <div className="admin-card" style={{ height: "auto", overflow: "visible" }}>
        <ComplaintListPanel showToast={showToast} />
      </div>
    </>
  );
}

const CSS = `
.cs-list-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px}
.cs-list{display:grid;gap:12px}
.cs-card{display:grid;gap:10px;padding:14px;border:1px solid var(--admin-border);border-radius:16px;background:var(--admin-card)}
.cs-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.cs-main-info{min-width:0;flex:1}
.cs-date{font-size:11px;color:var(--admin-muted);font-weight:800;letter-spacing:.03em;text-transform:uppercase}
.cs-meta{margin-top:4px;font-size:15px;font-weight:800;color:var(--admin-text);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.cs-name{font-weight:800}
.cs-sep{color:var(--admin-muted);font-weight:600}
.cs-house{color:var(--admin-text);font-weight:700}
.cs-body-mobile{margin-top:8px;font-size:13px;font-weight:500;line-height:1.5;color:var(--admin-text);overflow-wrap:anywhere;display:block}
.cs-body-desktop{margin-top:4px;font-size:13px;font-weight:500;line-height:1.5;color:var(--admin-text);overflow-wrap:anywhere;display:none}
.cs-photo-btn{flex:0 0 auto;width:64px;height:64px;border-radius:12px;overflow:hidden;border:1px solid var(--admin-border);cursor:pointer;background:var(--admin-row);padding:0}
.cs-photo-btn:hover{border-color:var(--admin-primary)}
.cs-thumb-btn{width:100%;height:100%;object-fit:cover}
.cs-modal-overlay{position:fixed;inset:0999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.7)}
.cs-modal-box{position:relative;max-width:min(90vw,600px);max-height:90vh}
.cs-modal-close{position:absolute;top:-12px;right:-12px;width:32px;height:32px;border-radius:999px;border:none;background:var(--admin-card);color:var(--admin-text);font-size:20px;font-weight:800;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2)}
.cs-modal-img{width:100%;max-height:85vh;object-fit:contain;border-radius:12px;border:1px solid var(--admin-border)}
.cs-loader{text-align:center;padding:12px;color:var(--admin-muted);font-size:12px;font-weight:700}
.cs-title{color:var(--admin-text)!important}
@media(min-width:641px){.cs-body-mobile{display:none}.cs-body-desktop{display:block}}
@media(max-width:640px){.cs-head{flex-direction:column}.cs-photo-btn{width:56px;height:56px}}
`;
