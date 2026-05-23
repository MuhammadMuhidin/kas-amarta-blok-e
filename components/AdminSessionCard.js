"use client";

import modalStyles from "@/components/admin/AdminModal.module.css";
import LoadingButtonContent from "@/components/admin/LoadingButtonContent";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const DEFAULT_SESSION_DURATION = 86400;

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

function getRemainingTime(createdAt, durationSeconds) {
  if (!createdAt || !durationSeconds) return "-";

  const expiresAt =
    new Date(createdAt).getTime() + Number(durationSeconds) * 1000;

  const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));

  if (diff <= 0) return "Expired";

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h remaining`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }

  return `${minutes}m remaining`;
}

export default function AdminSessionCard() {
  const router = useRouter();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState("");
  const [pendingSession, setPendingSession] = useState(null);
  const [error, setError] = useState("");
  const [sessionDuration, setSessionDuration] = useState(DEFAULT_SESSION_DURATION);

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
      const [sessionRes, authRes] = await Promise.all([
        fetch("/api/admin/sessions", {
          cache: "no-store",
        }),
        fetch("/api/admin/settings/auth", {
          cache: "no-store",
        }),
      ]);

      if (sessionRes.status === 401 || authRes.status === 401) {
        await redirectToLogin();
        return;
      }

      const sessionData = await sessionRes.json();
      const authData = await authRes.json();

      if (!sessionRes.ok) {
        throw new Error(sessionData.error || "Failed to load sessions");
      }

      if (authRes.ok) {
        setSessionDuration(
          Number(authData.config?.sessionDuration || DEFAULT_SESSION_DURATION),
        );
      }

      setSessions(sessionData.sessions || []);
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

                <div style={styles.remainingMeta}>
                  Session expires in {getRemainingTime(session.created_at, sessionDuration)}
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
    background: "var(--admin-primary-soft)",
    color: "var(--admin-primary)",
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
  remainingMeta: {
    marginTop: 4,
    fontSize: 12,
    color: "var(--admin-primary)",
    fontWeight: 700,
  },
  dangerButton: {
    border: "none",
    borderRadius: 10,
    padding: "9px 12px",
    background: "var(--admin-danger)",
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
    background: "var(--admin-danger-soft)",
    color: "var(--admin-danger)",
    fontSize: 13,
    fontWeight: 700,
  },
};