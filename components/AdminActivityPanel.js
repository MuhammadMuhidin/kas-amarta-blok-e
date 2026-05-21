"use client";

import { useEffect, useMemo, useState } from "react";

const modules = ["", "personal", "payment", "deposit", "cashflow", "settings", "session"];
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

function hasMetadata(value) {
  return value && Object.keys(value || {}).length > 0;
}

function titleCase(value) {
  if (!value) return "All";

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function AdminActivityPanel() {
  const [activities, setActivities] = useState([]);
  const [module, setModule] = useState("");
  const [severity, setSeverity] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("desc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    total_pages: 1,
    total: 0,
  });

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
      const res = await fetch(`/api/admin/activities?${query}`, {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed load activities");

      setActivities(data.activities || []);
      setPagination(data.pagination || {});
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
    setExpandedId(null);
  }

  useEffect(() => {
    loadActivities();
  }, [query]);

  useEffect(() => {
    setPage(1);
    setExpandedId(null);
  }, [module, severity, search, sort, dateFrom, dateTo]);

  return (
    <div className="admin-card activity-panel">
      <div className="activity-header">
        <div>
          <h3 className="activity-title">Activity Log</h3>
          <p className="activity-subtitle">Riwayat aktivitas admin dan perubahan data.</p>
        </div>

        <button
          type="button"
          onClick={loadActivities}
          className="admin-small-btn activity-refresh-btn"
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="activity-summary-bar">
        <div>
          <b>{pagination.total || 0}</b> records
        </div>
        <span>{activeFilterLabel}</span>
        <span>{sort === "desc" ? "Newest first" : "Oldest first"}</span>
        <span className={error ? "activity-status-error" : "activity-status-ready"}>
          {error ? "Error" : loading ? "Loading" : "Ready"}
        </span>
      </div>

      <div className="activity-toolbar">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="admin-input activity-search"
          placeholder="Search actor, action, IP, device, location..."
        />

        <select value={module} onChange={(e) => setModule(e.target.value)} className="admin-input activity-input">
          {modules.map((item) => (
            <option key={item || "all-module"} value={item}>{item ? titleCase(item) : "All modules"}</option>
          ))}
        </select>

        <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="admin-input activity-input">
          {severities.map((item) => (
            <option key={item || "all-severity"} value={item}>{item ? titleCase(item) : "All severities"}</option>
          ))}
        </select>

        <select value={sort} onChange={(e) => setSort(e.target.value)} className="admin-input activity-input">
          <option value="desc">Newest first</option>
          <option value="asc">Oldest first</option>
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="admin-input activity-input"
          aria-label="From date"
        />

        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="admin-input activity-input"
          aria-label="To date"
        />

        <button type="button" className="admin-small-btn activity-reset-btn" onClick={resetFilters}>Reset</button>
      </div>

      {error && <div className="admin-error-box">{error}</div>}

      <div className="admin-table-wrapper activity-table-wrap">
        <table className="admin-table activity-table">
          <thead>
            <tr>
              <th className="admin-th">When</th>
              <th className="admin-th">Who</th>
              <th className="admin-th">What</th>
              <th className="admin-th">Where</th>
              <th className="admin-th">Status</th>
              <th className="admin-th">Detail</th>
            </tr>
          </thead>

          <tbody>
            {activities.length === 0 && !loading ? (
              <tr>
                <td colSpan={6} className="admin-td activity-empty">No activity found</td>
              </tr>
            ) : (
              activities.map((item, index) => {
                const opened = expandedId === item.id;

                return (
                  <tr key={item.id} className={index % 2 ? "admin-row-alt activity-row" : "activity-row"}>
                    <td className="admin-td activity-cell" data-label="When">
                      <div className="activity-when">{formatDate(item.created_at)}</div>
                    </td>

                    <td className="admin-td activity-cell" data-label="Who">
                      <div className="activity-primary">{item.actor || "-"}</div>
                      <div className="activity-muted">{item.device_name || "-"}</div>
                    </td>

                    <td className="admin-td activity-cell activity-message-cell" data-label="What">
                      <div className="activity-primary">{item.message}</div>
                      <div className="activity-muted">{item.module} • {item.type}</div>
                    </td>

                    <td className="admin-td activity-cell" data-label="Where">
                      <div className="activity-primary">{item.location || "-"}</div>
                      <div className="activity-muted">{item.ip || "-"}</div>
                    </td>

                    <td className="admin-td activity-cell" data-label="Status">
                      <span className={`activity-badge activity-badge-${item.severity || "info"}`}>
                        {item.severity || "info"}
                      </span>
                    </td>

                    <td className="admin-td activity-cell activity-detail-cell" data-label="Detail">
                      <button
                        type="button"
                        className="admin-small-btn activity-detail-btn"
                        disabled={!hasMetadata(item.metadata)}
                        onClick={() => setExpandedId(opened ? null : item.id)}
                      >
                        {opened ? "Hide" : "View"}
                      </button>

                      {opened && hasMetadata(item.metadata) && (
                        <pre className="activity-metadata">{JSON.stringify(item.metadata, null, 2)}</pre>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="activity-pagination">
        <button
          type="button"
          className="admin-small-btn activity-page-btn"
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => Math.max(p - 1, 1))}
        >
          Prev
        </button>

        <span className="activity-page-info">{pagination.page || 1} / {pagination.total_pages || 1}</span>

        <button
          type="button"
          className="admin-small-btn activity-page-btn"
          disabled={page >= (pagination.total_pages || 1) || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
