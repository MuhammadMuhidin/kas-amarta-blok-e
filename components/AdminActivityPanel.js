"use client";

import { useEffect, useMemo, useState } from "react";
import "./AdminActivityPanel.css";

const modules = [
  "",
  "personal",
  "payment",
  "deposit",
  "cashflow",
  "trash",
  "session",
  "settings-app",
  "settings-auth",
];

const severities = ["", "info", "success", "warning", "error"];

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function titleCase(value) {
  if (!value) return "All";

  return String(value)
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function DetailRow({ label, value }) {
  return (
    <div className="activity-modal-row">
      <span>{label}</span>
      <b>{value || "-"}</b>
    </div>
  );
}

export default function AdminActivityPanel() {
  const [activities, setActivities] = useState([]);
  const [module, setModule] = useState("");
  const [severity, setSeverity] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("desc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 });

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "20");
    params.set("page", String(page));
    params.set("sort", sort);

    if (module) params.set("module", module);
    if (severity) params.set("severity", severity);
    if (search.trim()) params.set("search", search.trim());
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);

    return params.toString();
  }, [module, severity, search, sort, dateFrom, dateTo, page]);

  const activeFilterLabel = useMemo(() => {
    const items = [];
    if (module) items.push(titleCase(module));
    if (severity) items.push(titleCase(severity));
    if (dateFrom || dateTo) items.push(`${dateFrom || "..."} - ${dateTo || "..."}`);
    if (search.trim()) items.push(`Search: ${search.trim()}`);
    return items.length ? items.join(" • ") : "All activity";
  }, [module, severity, dateFrom, dateTo, search]);

  async function loadActivities() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/activities?${query}`, { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed load activities");

      setActivities(data.activities || []);
      setPagination(data.pagination || { page: 1, total_pages: 1, total: 0 });
    } catch (err) {
      setActivities([]);
      setError(err.message || "Failed load activities");
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() {
    setSearch("");
    setModule("");
    setSeverity("");
    setSort("desc");
    setDateFrom("");
    setDateTo("");
    setPage(1);
    setSelectedActivity(null);
  }

  useEffect(() => {
    loadActivities();
  }, [query]);

  useEffect(() => {
    setPage(1);
    setSelectedActivity(null);
  }, [module, severity, search, sort, dateFrom, dateTo]);

  return (
    <div className="admin-card activity-panel">
      <div className="activity-header">
        <div>
          <h3 className="activity-title">Activity Log</h3>
          <p className="activity-subtitle">Riwayat aktivitas admin dan perubahan data.</p>
        </div>

        <button type="button" onClick={loadActivities} className="admin-small-btn activity-refresh-btn" disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="activity-summary-bar">
        <div><b>{pagination.total || 0}</b> records</div>
        <span>{activeFilterLabel}</span>
        <span>{sort === "desc" ? "Newest first" : "Oldest first"}</span>
        <span className={error ? "activity-status-error" : "activity-status-ready"}>
          {error ? "Error" : loading ? "Loading" : "Ready"}
        </span>
      </div>

      <div className="activity-toolbar">
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} className="admin-input activity-search" placeholder="Search actor, action, IP, device, location..." />

        <select value={module} onChange={(e) => setModule(e.target.value)} className="admin-input activity-input">
          {modules.map((item) => <option key={item || "all-module"} value={item}>{item ? titleCase(item) : "All modules"}</option>)}
        </select>

        <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="admin-input activity-input">
          {severities.map((item) => <option key={item || "all-severity"} value={item}>{item ? titleCase(item) : "All severities"}</option>)}
        </select>

        <select value={sort} onChange={(e) => setSort(e.target.value)} className="admin-input activity-input">
          <option value="desc">Newest first</option>
          <option value="asc">Oldest first</option>
        </select>

        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="admin-input activity-input" aria-label="From date" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="admin-input activity-input" aria-label="To date" />
        <button type="button" className="admin-small-btn activity-reset-btn" onClick={resetFilters}>Reset</button>
      </div>

      {error && <div className="admin-error-box">{error}</div>}

      <div className="admin-table-wrapper activity-table-wrap">
        <table className="admin-table activity-table">
          <thead>
            <tr>
              <th className="admin-th">Date</th>
              <th className="admin-th">Actor</th>
              <th className="admin-th">Action</th>
              <th className="admin-th">Location</th>
              <th className="admin-th">Status</th>
              <th className="admin-th">Detail</th>
            </tr>
          </thead>
          <tbody>
            {activities.length === 0 && !loading ? (
              <tr><td colSpan={6} className="admin-td activity-empty">No activity found</td></tr>
            ) : activities.map((item, index) => (
              <tr key={item.id} className={index % 2 ? "admin-row-alt activity-row" : "activity-row"}>
                <td className="admin-td activity-cell"><div className="activity-when">{formatDate(item.created_at)}</div></td>
                <td className="admin-td activity-cell"><div className="activity-primary">{item.actor || "-"}</div><div className="activity-muted">{item.device_name || "-"}</div></td>
                <td className="admin-td activity-cell activity-message-cell"><div className="activity-primary">{item.message}</div><div className="activity-muted">{item.module} • {item.type}</div></td>
                <td className="admin-td activity-cell"><div className="activity-primary">{item.location || "-"}</div><div className="activity-muted">{item.ip || "-"}</div></td>
                <td className="admin-td activity-cell"><span className={`activity-badge activity-badge-${item.severity || "info"}`}>{item.severity || "info"}</span></td>
                <td className="admin-td activity-cell"><button type="button" className="admin-small-btn activity-detail-btn" onClick={() => setSelectedActivity(item)}>Detail</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="activity-mobile-list">
        {activities.length === 0 && !loading ? (
          <div className="activity-empty-card">No activity found</div>
        ) : activities.map((item) => (
          <button key={item.id} type="button" className="activity-mobile-card" onClick={() => setSelectedActivity(item)}>
            <div className="activity-mobile-top">
              <div>
                <div className="activity-mobile-title">{item.message || "Activity"}</div>
                <div className="activity-mobile-meta">{formatDate(item.created_at)}</div>
              </div>
              <span className={`activity-badge activity-badge-${item.severity || "info"}`}>{item.severity || "info"}</span>
            </div>
            <div className="activity-mobile-info">
              <span>{item.actor || "-"}</span>
              <span>{item.module || "-"}</span>
              <span>{item.location || item.ip || "-"}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="activity-pagination">
        <button type="button" className="admin-small-btn activity-page-btn" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(p - 1, 1))}>Prev</button>
        <span className="activity-page-info">{pagination.page || 1} / {pagination.total_pages || 1}</span>
        <button type="button" className="admin-small-btn activity-page-btn" disabled={page >= (pagination.total_pages || 1) || loading} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>

      {selectedActivity && (
        <div className="activity-modal-overlay" role="dialog" aria-modal="true" onClick={() => setSelectedActivity(null)}>
          <div className="activity-modal" onClick={(e) => e.stopPropagation()}>
            <div className="activity-modal-header">
              <div><h3>Activity Detail</h3><p>{formatDate(selectedActivity.created_at)}</p></div>
              <button type="button" className="activity-modal-close" onClick={() => setSelectedActivity(null)}>×</button>
            </div>
            <div className="activity-modal-body">
              <DetailRow label="Actor" value={selectedActivity.actor} />
              <DetailRow label="Action" value={selectedActivity.message} />
              <DetailRow label="Module" value={selectedActivity.module} />
              <DetailRow label="Type" value={selectedActivity.type} />
              <DetailRow label="Status" value={selectedActivity.severity || "info"} />
              <DetailRow label="Device" value={selectedActivity.device_name} />
              <DetailRow label="Location" value={selectedActivity.location} />
              <DetailRow label="IP Address" value={selectedActivity.ip} />
              {selectedActivity.metadata && Object.keys(selectedActivity.metadata || {}).length > 0 && (
                <div className="activity-modal-meta"><span>Metadata</span><pre>{JSON.stringify(selectedActivity.metadata, null, 2)}</pre></div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
