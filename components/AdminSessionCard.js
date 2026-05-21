"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LoadingButtonContent from "@/components/admin/LoadingButtonContent";

function getCookie(name) {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}

function getDeviceName(session) {
  return session.device_name || "Unknown device";
}

function getTimeAgo(date) {
  if (!date) return "-";

  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;

  return `${Math.floor(diff / 86400)} days ago`;
}

export default function AdminSessionCard() {
  const router = useRouter();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState("");
  const [pendingSession, setPendingSession] = useState(null);
  const [error, setError] = useState("");

  async function redirectToLogin() {
    await fetch("/api/logout", {
      method: "POST",
      cache: "no-store",
    });

    router.replace("/login");
  }

  async function loadSessions() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/sessions", {
        cache: "no-store",
      });

      if (res.status === 401) {
        await redirectToLogin();
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load sessions");
      }

      setSessions(data.sessions || []);
    } catch (err) {
      setError(err.message || "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }

  async function revokeSession(session) {
    if (!session?.id || revokingId) return;

    setRevokingId(session.id);
    setError("");

    try {
      const csrfToken = getCookie("csrf_token");

      const res = await fetch("/api/admin/sessions", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken || "",
        },
        body: JSON.stringify({
          id: session.id,
        }),
      });

      if (res.status === 401) {
        await redirectToLogin();
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to revoke session");
      }

      setPendingSession(null);
      await loadSessions();
    } catch (err) {
      setError(err.message || "Failed to revoke session");
    } finally {
      setRevokingId("");
    }
  }

  useEffect(() => {
    loadSessions();
  }, []);

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Active Sessions</h2>
          <p style={styles.description}>
            List of devices currently holding administrator access.
          </p>
        </div>

        <button
          type="button"
          onClick={loadSessions}
          disabled={loading}
          style={{
            ...styles.refreshButton,
            opacity: loading ? 0.6 : 1,
          }}
        >
          <LoadingButtonContent loading={loading} loadingText="Refreshing...">
            Refresh
          </LoadingButtonContent>
        </button>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      {loading ? (
        <div style={styles.emptyBox}>Loading sessions...</div>
      ) : sessions.length === 0 ? (
        <div style={styles.emptyBox}>No active sessions.</div>
      ) : (
        <div style={styles.sessionList}>
          {sessions.map((session) => (
            <div key={session.id} style={styles.sessionItem}>
              <div style={styles.sessionInfo}>
                <div style={styles.sessionTop}>
                  <div style={styles.sessionDevice}>
                    {getDeviceName(session)}
                  </div>

                  {session.current && (
                    <div style={styles.currentBadge}>
                      Current Session
                    </div>
                  )}
                </div>

                {session.location && (
                  <div style={styles.locationText}>
                    {session.location}
                  </div>
                )}

                <div style={styles.sessionMeta}>
                  Last active: {getTimeAgo(session.last_active)}
                </div>
              </div>

              {!session.current && (
                <button
                  type="button"
                  onClick={() => setPendingSession(session)}
                  disabled={revokingId === session.id}
                  style={{
                    ...styles.dangerButton,
                    opacity: revokingId === session.id ? 0.6 : 1,
                  }}
                >
                  <LoadingButtonContent
                    loading={revokingId === session.id}
                    loadingText="Revoking..."
                  >
                    Revoke
                  </LoadingButtonContent>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {pendingSession && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalBadge}>Session Access</div>

            <h3 style={styles.modalTitle}>Revoke this session?</h3>

            <p style={styles.modalDesc}>
              This device will lose administrator access and must sign in again.
            </p>

            <div style={styles.modalSessionBox}>
              <div style={styles.sessionDevice}>
                {getDeviceName(pendingSession)}
              </div>

              {pendingSession.location && (
                <div style={styles.locationText}>
                  {pendingSession.location}
                </div>
              )}

              <div style={styles.sessionMeta}>
                Last active: {getTimeAgo(pendingSession.last_active)}
              </div>
            </div>

            <div style={styles.modalActions}>
              <button
                type="button"
                onClick={() => setPendingSession(null)}
                disabled={!!revokingId}
                style={styles.cancelButton}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => revokeSession(pendingSession)}
                disabled={!!revokingId}
                style={{
                  ...styles.confirmDangerButton,
                  opacity: revokingId ? 0.65 : 1,
                }}
              >
                <LoadingButtonContent
                  loading={!!revokingId}
                  loadingText="Revoking..."
                >
                  Revoke Session
                </LoadingButtonContent>
              </button>
            </div>
          </div>
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
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  title: {
    margin: 0,
    fontSize: 20,
    color: "var(--admin-text)",
  },
  description: {
    margin: "6px 0 0",
    fontSize: 13,
    color: "var(--admin-muted)",
    lineHeight: 1.5,
  },
  refreshButton: {
    border: "1px solid var(--admin-border)",
    borderRadius: 10,
    padding: "8px 10px",
    background: "var(--admin-row)",
    color: "var(--admin-text)",
    fontWeight: 700,
    cursor: "pointer",
  },
  sessionList: {
    display: "grid",
    gap: 10,
  },
  sessionItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-row)",
  },
  sessionInfo: {
    minWidth: 0,
    flex: 1,
  },
  sessionTop: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  sessionDevice: {
    fontSize: 14,
    fontWeight: 800,
    color: "var(--admin-text)",
  },
  currentBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 8px",
    borderRadius: 999,
    background: "rgba(37,99,235,.12)",
    color: "#2563eb",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: ".03em",
  },
  locationText: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: 700,
    color: "var(--admin-text)",
    opacity: 0.82,
  },
  sessionMeta: {
    marginTop: 4,
    fontSize: 12,
    color: "var(--admin-muted)",
    wordBreak: "break-word",
  },
  dangerButton: {
    border: "none",
    borderRadius: 10,
    padding: "9px 12px",
    background: "#dc2626",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    flexShrink: 0,
  },
  emptyBox: {
    padding: 12,
    borderRadius: 12,
    background: "var(--admin-row)",
    color: "var(--admin-muted)",
    fontSize: 13,
  },
  errorBox: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    background: "#fef2f2",
    color: "#991b1b",
    fontSize: 13,
    fontWeight: 700,
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    background: "rgba(2,6,23,.62)",
    backdropFilter: "blur(5px)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 390,
    padding: 22,
    boxSizing: "border-box",
    borderRadius: 20,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-card)",
    color: "var(--admin-text)",
    boxShadow: "0 24px 70px rgba(0,0,0,.36)",
  },
  modalBadge: {
    display: "inline-flex",
    marginBottom: 12,
    padding: "6px 10px",
    borderRadius: 999,
    background: "#fee2e2",
    color: "#991b1b",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: ".08em",
    textTransform: "uppercase",
  },
  modalTitle: {
    margin: "0 0 8px",
    fontSize: 20,
    color: "var(--admin-text)",
  },
  modalDesc: {
    margin: "0 0 16px",
    color: "var(--admin-muted)",
    fontSize: 14,
    lineHeight: 1.5,
  },
  modalSessionBox: {
    marginBottom: 18,
    padding: 14,
    borderRadius: 14,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-row)",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
  },
  cancelButton: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-row)",
    color: "var(--admin-text)",
    fontWeight: 800,
    cursor: "pointer",
  },
  confirmDangerButton: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "none",
    background: "#dc2626",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
};
