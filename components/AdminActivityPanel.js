"use client";

import { useEffect, useMemo, useState } from "react";

const modules = [
  "",
  "personal",
  "payment",
  "deposit",
  "cashflow",
  "settings",
  "session",
];

const severities = [
  "",
  "info",
  "success",
  "warning",
  "error",
];

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function severityClass(value) {
  switch (value) {
    case "success":
      return styles.successBadge;
    case "warning":
      return styles.warningBadge;
    case "error":
      return styles.errorBadge;
    default:
      return styles.infoBadge;
  }
}

export default function AdminActivityPanel() {
  const [activities, setActivities] = useState([]);
  const [module, setModule] = useState("");
  const [severity, setSeverity] = useState("");
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

    if (module) {
      params.set("module", module);
    }

    if (severity) {
      params.set("severity", severity);
    }

    return params.toString();
  }, [module, severity, page]);

  async function loadActivities() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/activities?${query}`, {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed load activities");
      }

      setActivities(data.activities || []);
      setPagination(data.pagination || {});
    } catch (err) {
      setActivities([]);
      setError(err.message || "Failed load activities");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActivities();
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [module, severity]);

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>Activity Audit</h3>
          <p style={styles.subtitle}>
            Session, payment, settings, dan activity admin.
          </p>
        </div>

        <button
          type="button"
          onClick={loadActivities}
          style={styles.refreshBtn}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div style={styles.filters}>
        <select
          value={module}
          onChange={(e) => setModule(e.target.value)}
          style={styles.input}
        >
          {modules.map((item) => (
            <option key={item || "all-module"} value={item}>
              {item ? item : "All modules"}
            </option>
          ))}
        </select>

        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          style={styles.input}
        >
          {severities.map((item) => (
            <option key={item || "all-severity"} value={item}>
              {item ? item : "All severities"}
            </option>
          ))}
        </select>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      <div style={styles.summaryBar}>
        <div style={styles.summaryItem}>
          <b>{pagination.total || 0}</b>
          <span>Total Activity</span>
        </div>

        <div style={styles.summaryItem}>
          <b>{pagination.page || 1}</b>
          <span>Current Page</span>
        </div>

        <div style={styles.summaryItem}>
          <b>{pagination.total_pages || 1}</b>
          <span>Total Pages</span>
        </div>
      </div>

      <div style={styles.list}>
        {activities.length === 0 && !loading ? (
          <div style={styles.emptyBox}>No activity found</div>
        ) : (
          activities.map((item) => (
            <div key={item.id} style={styles.activityCard}>
              <div style={styles.activityTop}>
                <div style={styles.activityLeft}>
                  <div style={styles.message}>{item.message}</div>

                  <div style={styles.metaLine}>
                    <span style={styles.module}>{item.module}</span>
                    <span style={styles.dot}>•</span>
                    <span>{item.type}</span>
                    <span style={styles.dot}>•</span>
                    <span>{formatDate(item.created_at)}</span>
                  </div>
                </div>

                <span
                  style={{
                    ...styles.badge,
                    ...severityClass(item.severity),
                  }}
                >
                  {item.severity || "info"}
                </span>
              </div>

              <div style={styles.metaGrid}>
                <div style={styles.metaItem}>
                  <div style={styles.metaLabel}>Actor</div>
                  <div style={styles.metaValue}>{item.actor || "-"}</div>
                </div>

                <div style={styles.metaItem}>
                  <div style={styles.metaLabel}>Device</div>
                  <div style={styles.metaValue}>{item.device_name || "-"}</div>
                </div>

                <div style={styles.metaItem}>
                  <div style={styles.metaLabel}>IP</div>
                  <div style={styles.metaValue}>{item.ip || "-"}</div>
                </div>

                <div style={styles.metaItem}>
                  <div style={styles.metaLabel}>Location</div>
                  <div style={styles.metaValue}>{item.location || "-"}</div>
                </div>
              </div>

              {item.metadata &&
              Object.keys(item.metadata || {}).length > 0 ? (
                <pre style={styles.metadata}>
                  {JSON.stringify(item.metadata, null, 2)}
                </pre>
              ) : null}
            </div>
          ))
        )}
      </div>

      <div style={styles.pagination}>
        <button
          type="button"
          style={styles.pageBtn}
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => Math.max(p - 1, 1))}
        >
          Previous
        </button>

        <div style={styles.pageInfo}>
          Page {pagination.page || 1} / {pagination.total_pages || 1}
        </div>

        <button
          type="button"
          style={styles.pageBtn}
          disabled={
            page >= (pagination.total_pages || 1) || loading
          }
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: "var(--admin-card)",
    color: "var(--admin-text)",
    padding: 20,
    borderRadius: 18,
    border: "1px solid var(--admin-border)",
    boxShadow: "0 10px 30px rgba(0,0,0,.18)",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
    flexWrap: "wrap",
  },

  title: {
    margin: 0,
  },

  subtitle: {
    margin: "6px 0 0",
    color: "var(--admin-muted)",
    fontSize: 13,
  },

  refreshBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-primary)",
    color: "#020617",
    cursor: "pointer",
    fontWeight: 700,
  },

  filters: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
    gap: 10,
    marginBottom: 16,
  },

  input: {
    padding: 12,
    border: "1px solid var(--admin-border)",
    borderRadius: 12,
    background: "var(--admin-input)",
    color: "var(--admin-text)",
    fontSize: 14,
  },

  summaryBar: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))",
    gap: 10,
    marginBottom: 18,
  },

  summaryItem: {
    padding: 14,
    borderRadius: 14,
    background: "var(--admin-row)",
    border: "1px solid var(--admin-border)",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },

  list: {
    display: "grid",
    gap: 14,
  },

  activityCard: {
    border: "1px solid var(--admin-border)",
    borderRadius: 16,
    padding: 16,
    background: "var(--admin-row)",
  },

  activityTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },

  activityLeft: {
    flex: 1,
    minWidth: 0,
  },

  message: {
    fontWeight: 700,
    fontSize: 15,
    marginBottom: 8,
    wordBreak: "break-word",
  },

  metaLine: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    color: "var(--admin-muted)",
    fontSize: 13,
  },

  module: {
    textTransform: "capitalize",
    fontWeight: 700,
  },

  dot: {
    opacity: 0.5,
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    textTransform: "capitalize",
    flexShrink: 0,
  },

  infoBadge: {
    background: "#dbeafe",
    color: "#1e40af",
  },

  successBadge: {
    background: "#dcfce7",
    color: "#166534",
  },

  warningBadge: {
    background: "#fef3c7",
    color: "#92400e",
  },

  errorBadge: {
    background: "#fee2e2",
    color: "#991b1b",
  },

  metaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
    gap: 10,
    marginBottom: 12,
  },

  metaItem: {
    background: "var(--admin-card)",
    border: "1px solid var(--admin-border)",
    borderRadius: 12,
    padding: 10,
  },

  metaLabel: {
    fontSize: 12,
    color: "var(--admin-muted)",
    marginBottom: 4,
  },

  metaValue: {
    fontWeight: 600,
    wordBreak: "break-word",
  },

  metadata: {
    margin: 0,
    borderRadius: 12,
    padding: 12,
    background: "#020617",
    color: "#cbd5e1",
    overflowX: "auto",
    fontSize: 12,
    lineHeight: 1.5,
  },

  pagination: {
    marginTop: 18,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },

  pageBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-primary)",
    color: "#020617",
    fontWeight: 700,
    cursor: "pointer",
  },

  pageInfo: {
    fontSize: 14,
    color: "var(--admin-muted)",
    fontWeight: 600,
  },

  emptyBox: {
    padding: 20,
    borderRadius: 14,
    background: "var(--admin-row)",
    border: "1px solid var(--admin-border)",
    color: "var(--admin-muted)",
    textAlign: "center",
  },

  errorBox: {
    marginBottom: 14,
    padding: 12,
    borderRadius: 12,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
    fontSize: 13,
    fontWeight: 700,
  },
};
