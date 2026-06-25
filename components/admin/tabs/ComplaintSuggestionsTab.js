"use client";

import AdminDataSkeleton from "@/components/admin/AdminDataSkeleton";
import useInfiniteRows from "@/components/admin/useInfiniteRows";
import Toast from "@/components/Toast";
import { sendJson } from "@/components/admin/adminClientApi";
import { useCallback, useState } from "react";

const API = "/api/admin/complaint-suggestions";
const PAGE_SIZE = 10;

function date(value) {
  const parsed = new Date(value);
  return value && !Number.isNaN(parsed.getTime())
    ? parsed.toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";
}

function statusLabel(status) {
  const map = {
    baru: "Baru",
    diproses: "Diproses",
    selesai: "Selesai",
    ditolak: "Ditolak",
  };
  return map[status] || status || "-";
}

function statusClass(status) {
  const key = String(status || "").toLowerCase();
  if (key === "selesai") return "cs-ok";
  if (key === "ditolak") return "cs-bad";
  if (key === "diproses") return "cs-progress";
  return "cs-new";
}

function ComplaintCard({ row, onStatusChange, running }) {
  const [open, setOpen] = useState(false);

  return (
    <article className="cs-card">
      <div className="cs-head">
        <div>
          <div className="cs-date">{date(row.created_at)}</div>
          <div className="cs-meta">
            <span className="cs-role">{row.nama}</span>
            <span className="cs-house"> · {row.rumah}</span>
          </div>
        </div>
        <span className={`cs-status ${statusClass(row.status)}`}>{statusLabel(row.status)}</span>
      </div>
      <div className="cs-body">{row.kritik}</div>
      {row.photo_url ? (
        <div className="cs-attachment">
          <img src={row.photo_url} alt="Lampiran" loading="lazy" className="cs-thumb" />
        </div>
      ) : null}
      <div className="cs-actions">
        <button
          type="button"
          className="admin-small-btn"
          onClick={() => setOpen(!open)}
        >
          {open ? "Tutup" : "Ubah Status"}
        </button>
      </div>
      {open ? (
        <div className="cs-status-picker">
          {["baru", "diproses", "selesai", "ditolak"].map((s) => (
            <button
              key={s}
              type="button"
              className={`cs-status-btn ${statusClass(s)} ${row.status === s ? "cs-active" : ""}`}
              disabled={running === `${row.id}-${s}`}
              onClick={() => onStatusChange(row, s)}
            >
              {running === `${row.id}-${s}` ? "..." : statusLabel(s)}
            </button>
          ))}
        </div>
      ) : null}
      <div className="cs-footer">
        <small>IP: {row.ip_address || "-"}</small>
      </div>
    </article>
  );
}

function ComplaintListPanel({ showToast, refreshVersion, onCountChange }) {
  const [running, setRunning] = useState("");
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
    deps: [refreshVersion],
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

  const handleStatusChange = useCallback(
    async (row, newStatus) => {
      if (row.status === newStatus) return;
      try {
        setRunning(`${row.id}-${newStatus}`);
        const payload = await sendJson(`${API}/${row.id}`, "PATCH", { status: newStatus });
        if (payload.ok) {
          showToast(`Status diubah ke ${statusLabel(newStatus)}`);
          await refresh();
          if (onCountChange) onCountChange();
        }
      } catch (err) {
        showToast(err.message || "Gagal mengubah status", "error");
      } finally {
        setRunning("");
      }
    },
    [refresh, showToast, onCountChange],
  );

  const initialLoading = loading && !rows.length;

  return (
    <div role="tabpanel" id="complaint-suggestions-panel">
      <div className="cs-list-header">
        <div>
          <div className="activity-kicker">Pengaduan Warga</div>
          <h3 className="activity-title cs-title">Complaint and Suggestions</h3>
          <p className="activity-subtitle">
            Semua inputan pengaduan dari warga. Terbaru ditampilkan paling atas.
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
            <ComplaintCard
              key={row.id}
              row={row}
              running={running}
              onStatusChange={handleStatusChange}
            />
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
  const [refreshVersion, setRefreshVersion] = useState(0);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const handleCountChange = useCallback(() => {
    setRefreshVersion((v) => v + 1);
  }, []);

  return (
    <>
      <Toast show={Boolean(toast)} type={toast?.type} message={toast?.message} />
      <style jsx global>{CSS}</style>
      <div className="admin-card" style={{ height: "auto", overflow: "visible" }}>
        <ComplaintListPanel
          key={refreshVersion}
          showToast={showToast}
          refreshVersion={refreshVersion}
          onCountChange={handleCountChange}
        />
      </div>
    </>
  );
}

const CSS = `
.cs-list-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px}.cs-list{display:grid;gap:12px}.cs-card{display:grid;gap:10px;padding:12px;border:1px solid var(--admin-border);border-radius:16px;background:var(--admin-card)}.cs-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.cs-head>div{min-width:0}.cs-date{font-size:11px;color:var(--admin-muted);font-weight:800;letter-spacing:.03em;text-transform:uppercase}.cs-meta{margin-top:4px;font-size:14px;font-weight:800;color:var(--admin-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70%}.cs-house{color:var(--admin-muted);font-weight:700}.cs-status{flex:0 0 auto;font-size:12px;font-weight:900;padding:3px 10px;border-radius:999px;line-height:1.4}.cs-new{background:#dbeafe;color:#1e40af}.cs-progress{background:#fef3c7;color:#92400e}.cs-ok{background:#dcfce7;color:#166534}.cs-bad{background:#fee2e2;color:#991b1b}.cs-body{font-size:13px;font-weight:500;line-height:1.5;color:var(--admin-text);overflow-wrap:anywhere}.cs-attachment{margin-top:2px}.cs-thumb{width:100%;max-height:240px;object-fit:cover;border-radius:12px;border:1px solid var(--admin-border)}.cs-actions{display:flex;gap:8px;margin-top:4px}.cs-status-picker{display:flex;gap:6px;flex-wrap:wrap;padding-top:8px;border-top:1px solid var(--admin-border)}.cs-status-btn{min-height:32px;padding:0 12px;border-radius:999px;font-size:11px;font-weight:800;border:1px solid var(--admin-border);background:var(--admin-row);color:var(--admin-text);cursor:pointer}.cs-status-btn.cs-active{opacity:.6;cursor:default}.cs-footer{margin-top:4px;color:var(--admin-muted);font-size:10px;font-weight:700}.cs-loader{text-align:center;padding:12px;color:var(--admin-muted);font-size:12px;font-weight:700}.cs-title{color:var(--admin-text)!important}
@media(max-width:640px){.cs-head{flex-direction:column}.cs-status{align-self:flex-start}}
`;
