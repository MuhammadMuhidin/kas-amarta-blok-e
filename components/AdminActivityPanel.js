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

function formatMetadata(metadata) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return "-";
  }

  return JSON.stringify(metadata, null, 2);
}

export default function AdminActivityPanel() {
  const [activities, setActivities] = useState([]);
  const [module, setModule] = useState("");
  const [severity, setSeverity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();

    params.set("limit", "100");

    if (module) {
      params.set("module", module);
    }

    if (severity) {
      params.set("severity", severity);
    }

    return params.toString();
  }, [module, severity]);

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

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>Activity Audit</h3>
          <p style={styles.subtitle}>
            Log aktivitas admin dari Supabase admin_activities.
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

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Time</th>
              <th style={styles.th}>Module</th>
              <th style={styles.th}>Type</th>
              <th style={styles.th}>Severity</th>
              <th style={styles.th}>Message</th>
              <th style={styles.th}>Actor</th>
              <th style={styles.th}>Device</th>
              <th style={styles.th}>IP</th>
              <th style={styles.th}>Location</th>
              <th style={styles.th}>Metadata</th>
            </tr>
          </thead>

          <tbody>
            {activities.length === 0 && !loading ? (
              <tr>
                <td style={styles.emptyTd} colSpan={10}>
                  No activity found
                </td>
              </tr>
            ) : (
              activities.map((item, index) => (
                <tr key={item.id} style={index % 2 ? styles.rowAlt : null}>
                  <td style={styles.td}>{formatDate(item.created_at)}</td>
                  <td style={styles.td}>{item.module}</td>
                  <td style={styles.td}>{item.type}</td>
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.badge,
                        ...(item.severity === "success"
                          ? styles.successBadge
                          : item.severity === "warning"
                            ? styles.warningBadge
                            : item.severity === "error"
                              ? styles.errorBadge
                              : styles.infoBadge),
                      }}
                    >
                      {item.severity || "info"}
                    </span>
                  </td>
                  <td style={styles.td}>{item.message}</td>
                  <td style={styles.td}>{item.actor || "-"}</td>
                  <td style={styles.td}>{item.device_name || "-"}</td>
                  <td style={styles.td}>{item.ip || "-"}</td>
                  <td style={styles.td}>{item.location || "-"}</td>
                  <td style={styles.metaTd}>
                    <pre style={styles.pre}>
                      {formatMetadata(item.metadata)}
                    </pre>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
    padding: "9px 12px",
    borderRadius: 10,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-primary)",
    color: "#020617",
    cursor: "pointer",
    fontWeight: 700,
  },

  filters: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 10,
    marginBottom: 14,
  },

  input: {
    padding: 12,
    border: "1px solid var(--admin-border)",
    borderRadius: 10,
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box",
    background: "var(--admin-input)",
    color: "var(--admin-text)",
    outline: "none",
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

  tableWrapper: {
    width: "100%",
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 1100,
    color: "var(--admin-text)",
    background: "var(--admin-card)",
  },

  th: {
    textAlign: "center",
    verticalAlign: "middle",
    padding: "14px 12px",
    whiteSpace: "nowrap",
    background: "var(--admin-row)",
    color: "var(--admin-text)",
    borderBottom: "2px solid var(--admin-border)",
  },

  td: {
    textAlign: "center",
    verticalAlign: "middle",
    padding: 12,
    borderBottom: "1px solid var(--admin-border)",
    whiteSpace: "nowrap",
    color: "var(--admin-text)",
  },

  metaTd: {
    textAlign: "left",
    verticalAlign: "top",
    padding: 12,
    borderBottom: "1px solid var(--admin-border)",
    minWidth: 260,
  },

  emptyTd: {
    textAlign: "center",
    padding: 18,
    color: "var(--admin-muted)",
    borderBottom: "1px solid var(--admin-border)",
  },

  rowAlt: {
    background: "var(--admin-row)",
  },

  badge: {
    display: "inline-block",
    padding: "4px 9px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    textTransform: "capitalize",
  },

  infoBadge: {
    background: "#dbeafe",
    color: "#1e40af",
    border: "1px solid #93c5fd",
  },

  successBadge: {
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #86efac",
  },

  warningBadge: {
    background: "#fef3c7",
    color: "#92400e",
    border: "1px solid #fcd34d",
  },

  errorBadge: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fca5a5",
  },

  pre: {
    margin: 0,
    fontSize: 12,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: "var(--admin-text)",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
};
