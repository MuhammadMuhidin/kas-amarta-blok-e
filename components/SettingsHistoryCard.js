"use client";

import modalStyles from "@/components/admin/AdminModal.module.css";
import { useEffect, useState } from "react";

function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;

  return `${Math.floor(diff / 86400)}d ago`;
}

function formatDate(date) {
  if (!date) return "-";

  return new Date(date).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function prettify(key) {
  return String(key || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function getValue(item, field) {
  const metadata = item?.metadata || {};

  if (metadata[field] !== undefined && metadata[field] !== null) {
    return String(metadata[field]);
  }

  return "-";
}

function getNextValue(item) {
  const metadata = item?.metadata || {};

  if (metadata.new_value !== undefined && metadata.new_value !== null) {
    return String(metadata.new_value);
  }

  if (metadata.value !== undefined && metadata.value !== null) {
    return String(metadata.value);
  }

  return "-";
}

export default function SettingsHistoryCard() {
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/settings/history", {
          cache: "no-store",
        });

        const data = await res.json();

        if (res.ok) {
          setChanges((data.changes || []).slice(0, 3));
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <>
      <div style={styles.card}>
        <h2 style={styles.title}>Recent Configuration Changes</h2>

        <p style={styles.desc}>
          Showing last 3 configuration updates.
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
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelected(item)}
                  style={styles.item}
                >
                  <div style={styles.mainInfo}>
                    <div style={styles.topLine}>
                      <span style={styles.badge}>
                        {item.module === "settings-auth" ? "AUTH" : "CONFIG"}
                      </span>

                      <span style={styles.key}>
                        {prettify(metadata.key)}
                      </span>
                    </div>

                    <div style={styles.valueLine}>
                      <span style={styles.before}>
                        {getValue(item, "old_value")}
                      </span>

                      <span style={styles.arrow}>→</span>

                      <span style={styles.after}>
                        {getNextValue(item)}
                      </span>
                    </div>
                  </div>

                  <div style={styles.time}>
                    {timeAgo(item.created_at)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <div
          className={modalStyles.overlay}
          onClick={() => setSelected(null)}
        >
          <div
            className={modalStyles.box}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 430, padding: 22 }}
          >
            <div style={styles.modalBadge}>
              {selected.module === "settings-auth" ? "AUTH" : "CONFIG"}
            </div>

            <h3 style={styles.modalTitle}>
              {prettify(selected.metadata?.key)}
            </h3>

            <div style={styles.modalGrid}>
              <DetailRow label="Module" value={selected.module} />
              <DetailRow label="Type" value={selected.type} />
              <DetailRow label="Severity" value={selected.severity} />
              <DetailRow label="Message" value={selected.message} />
              <DetailRow label="Actor" value={selected.actor} />
              <DetailRow label="Device" value={selected.device_name} />
              <DetailRow label="Date" value={formatDate(selected.created_at)} />

              <div style={styles.changeBox}>
                <div style={styles.changeLabel}>Value Change</div>

                <div style={styles.modalValueRow}>
                  <span style={styles.modalBefore}>
                    {getValue(selected, "old_value")}
                  </span>

                  <span style={styles.arrow}>→</span>

                  <span style={styles.modalAfter}>
                    {getNextValue(selected)}
                  </span>
                </div>
              </div>
            </div>

            <div style={styles.modalActions}>
              <button
                type="button"
                onClick={() => setSelected(null)}
                style={styles.closeButton}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={styles.detailRow}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
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
    margin: "6px 0 12px",
    fontSize: 13,
    color: "var(--admin-muted)",
  },
  list: {
    display: "grid",
    gap: 8,
  },
  item: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-row)",
    color: "var(--admin-text)",
    cursor: "pointer",
    textAlign: "left",
  },
  mainInfo: {
    minWidth: 0,
    display: "grid",
    gap: 6,
  },
  topLine: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  badge: {
    padding: "3px 7px",
    borderRadius: 999,
    background: "var(--admin-primary-soft)",
    color: "var(--admin-primary)",
    fontSize: 10,
    fontWeight: 900,
    flexShrink: 0,
  },
  key: {
    fontSize: 13,
    fontWeight: 800,
    color: "var(--admin-text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  valueLine: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  before: {
    color: "var(--admin-danger)",
    fontSize: 12,
    fontWeight: 700,
  },
  arrow: {
    color: "var(--admin-muted)",
    fontWeight: 800,
  },
  after: {
    color: "var(--admin-primary)",
    fontSize: 12,
    fontWeight: 800,
  },
  time: {
    fontSize: 12,
    color: "var(--admin-muted)",
    fontWeight: 800,
    flexShrink: 0,
  },
  empty: {
    padding: 12,
    borderRadius: 12,
    background: "var(--admin-row)",
    color: "var(--admin-muted)",
    fontSize: 13,
  },
  modalBadge: {
    display: "inline-flex",
    marginBottom: 12,
    padding: "6px 10px",
    borderRadius: 999,
    background: "var(--admin-primary-soft)",
    color: "var(--admin-primary)",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: ".08em",
  },
  modalTitle: {
    margin: "0 0 16px",
    fontSize: 21,
    color: "var(--admin-text)",
  },
  modalGrid: {
    display: "grid",
    gap: 10,
  },
  detailRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 10,
    borderTop: "1px solid var(--admin-border)",
    color: "var(--admin-text)",
    fontSize: 13,
  },
  changeBox: {
    marginTop: 4,
    padding: 12,
    borderRadius: 12,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-row)",
  },
  changeLabel: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: 900,
    color: "var(--admin-muted)",
  },
  modalValueRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  modalBefore: {
    padding: "4px 8px",
    borderRadius: 8,
    background: "var(--admin-danger-soft)",
    color: "var(--admin-danger)",
    fontSize: 12,
    fontWeight: 800,
  },
  modalAfter: {
    padding: "4px 8px",
    borderRadius: 8,
    background: "var(--admin-primary-soft)",
    color: "var(--admin-primary)",
    fontSize: 12,
    fontWeight: 900,
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: 18,
  },
  closeButton: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-row)",
    color: "var(--admin-text)",
    fontWeight: 800,
    cursor: "pointer",
  },
};
