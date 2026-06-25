"use client";

import AdminDataSkeleton from "@/components/admin/AdminDataSkeleton";
import useInfiniteRows from "@/components/admin/useInfiniteRows";
import Toast from "@/components/Toast";
import { useCallback, useEffect, useState } from "react";

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

function useModalScrollLock(open) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [open]);
}

function PhotoProofModal({ row, onClose }) {
  useModalScrollLock(Boolean(row));

  if (!row) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        style={{ width: "min(100%, 760px)", maxHeight: "calc(100dvh - 64px)", display: "grid", gap: 14, overflow: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div
            style={{
              width: "100%",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 14,
            }}
          >
            <div>
              <div className="modal-title">Attachment — {row.rumah}</div>
              <div className="modal-section">{row.nama} · {date(row.created_at)}</div>
            </div>
            <button
              type="button"
              className="activity-modal-close"
              onClick={onClose}
              aria-label="Close modal"
            >
              ×
            </button>
          </div>
        </div>
        {row.photo_url ? (
          <div
            style={{
              display: "grid",
              placeItems: "center",
              minHeight: 240,
              borderRadius: 12,
              border: "1px solid var(--admin-border)",
              background: "var(--admin-row)",
              overflow: "hidden",
            }}
          >
            <img src={row.photo_url} alt="Attachment" style={{ width: "100%", maxHeight: "70dvh", objectFit: "contain", display: "block" }} />
          </div>
        ) : (
          <div className="admin-empty-state">Photo is unavailable.</div>
        )}
        <div
          style={{
            display: "grid",
            gap: 8,
            padding: 12,
            borderRadius: 12,
            border: "1px solid var(--admin-border)",
            background: "var(--admin-row)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--admin-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            Message
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              lineHeight: 1.6,
              color: "var(--admin-text)",
              overflowWrap: "anywhere",
            }}
          >
            {row.kritik}
          </div>
        </div>
      </div>
    </div>
  );
}

function ComplaintCard({ row, onViewPhoto }) {
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
        <div className="cs-photo-grid">
          {row.photo_url ? (
            <button
              type="button"
              className="cs-photo-btn"
              onClick={() => onViewPhoto(row)}
              aria-label="View photo"
            >
              <img src={row.photo_url} alt="Attachment" loading="lazy" className="cs-thumb-btn" />
            </button>
          ) : null}
        </div>
      </div>
      <div className="cs-body-desktop">{row.kritik}</div>
    </article>
  );
}

function ComplaintListPanel({ showToast }) {
  const {
    items: rows,
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

  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const initialLoading = loading && !rows.length;

  return (
    <div role="tabpanel" id="complaint-suggestions-panel">
      <div className="cs-list-header">
        <div>
          <div className="activity-kicker">Resident Feedback</div>
          <h3 className="activity-title cs-title">Complaint and Suggestions</h3>
          <p className="activity-subtitle">
            Complaints, feedback, and suggestions submitted by residents via the public form.
          </p>
        </div>
      </div>

      {error && <div className="admin-error-box">{error}</div>}

      {initialLoading ? (
        <AdminDataSkeleton rows={5} />
      ) : rows.length === 0 ? (
        <div className="admin-empty-state" style={{ padding: "14px 12px" }}>
          Belum ada pengaduan dari warga.
        </div>
      ) : (
        <div className="cs-list">
          {rows.map((row) => (
            <ComplaintCard key={row.id} row={row} onViewPhoto={setSelectedPhoto} />
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

      <PhotoProofModal row={selectedPhoto} onClose={() => setSelectedPhoto(null)} />
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
.cs-head{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:12px}
.cs-list{display:grid;gap:12px}
.cs-card{display:grid;gap:10px;padding:14px;border:1px solid var(--admin-border);border-radius:16px;background:var(--admin-card)}
.cs-head{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px}
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
.cs-loader{text-align:center;padding:12px;color:var(--admin-muted);font-size:12px;font-weight:700}
.cs-title{color:var(--admin-text)!important}
@media(min-width:641px){.cs-body-mobile{display:none}.cs-body-desktop{display:block}}
@media(max-width:640px){.cs-head{flex-direction:column}.cs-photo-btn{width:56px;height:56px}}
`;
