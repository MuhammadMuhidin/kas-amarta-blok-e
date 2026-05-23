"use client";

import { useEffect, useState } from "react";

function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;

  return `${Math.floor(diff / 86400)}d ago`;
}

function prettify(key) {
  return String(key || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function SettingsHistoryCard() {
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/settings/history", {
          cache: "no-store",
        });

        const data = await res.json();

        if (res.ok) {
          setChanges(data.changes || []);
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <div style={styles.card}>
      <h2 style={styles.title}>Recent Configuration Changes</h2>

      <p style={styles.desc}>
        Showing last 5 configuration updates.
      </p>

      {loading ? (
        <div style={styles.empty}>Loading history...</div>
      ) : changes.length === 0 ? (
        <div style={styles.empty}>No recent changes.</div>
      ) : (
        <div style={styles.list}>
          {changes.map((item) => {
            const metadata = item.metadata || {};

            return (
              <div key={item.id} style={styles.item}>
                <div style={styles.top}>
                  <div style={styles.badge}>
                    {item.module === "settings-auth"
                      ? "AUTH"
                      : "CONFIG"}
                  </div>

                  <div style={styles.time}>
                    {timeAgo(item.created_at)}
                  </div>
                </div>

                <div style={styles.key}>
                  {prettify(metadata.key)}
                </div>

                <div style={styles.row}>
                  {metadata.old_value !== undefined && (
                    <span style={styles.before}>
                      {String(metadata.old_value)}
                    </span>
                  )}

                  <span style={styles.arrow}>→</span>

                  <span style={styles.after}>
                    {String(metadata.new_value || metadata.value)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    marginTop: 24,
    paddingTop: 18,
    borderTop: "1px solid var(--admin-border)",
  },
  title: {
    margin: 0,
    fontSize: 20,
    color: "var(--admin-text)",
  },
  desc: {
    margin: "6px 0 14px",
    fontSize: 13,
    color: "var(--admin-muted)",
  },
  list: {
    display: "grid",
    gap: 10,
  },
  item: {
    padding: 14,
    borderRadius: 14,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-row)",
  },
  top: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  badge: {
    padding: "4px 8px",
    borderRadius: 999,
    background: "var(--admin-primary-soft)",
    color: "var(--admin-primary)",
    fontSize: 11,
    fontWeight: 900,
  },
  time: {
    fontSize: 12,
    color: "var(--admin-muted)",
    fontWeight: 700,
  },
  key: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: 800,
    color: "var(--admin-text)",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  before: {
    padding: "4px 8px",
    borderRadius: 8,
    background: "var(--admin-danger-soft)",
    color: "var(--admin-danger)",
    fontSize: 12,
    fontWeight: 700,
  },
  arrow: {
    color: "var(--admin-muted)",
  },
  after: {
    padding: "4px 8px",
    borderRadius: 8,
    background: "var(--admin-primary-soft)",
    color: "var(--admin-primary)",
    fontSize: 12,
    fontWeight: 800,
  },
  empty: {
    padding: 12,
    borderRadius: 12,
    background: "var(--admin-row)",
    color: "var(--admin-muted)",
    fontSize: 13,
  },
};