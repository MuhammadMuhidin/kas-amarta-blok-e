"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function getCookie(name) {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}

function getDeviceName(userAgent = "") {
  if (userAgent.includes("Android")) return "Chrome Android";
  if (userAgent.includes("iPhone")) return "Safari iPhone";
  if (userAgent.includes("Windows")) return "Chrome Windows";
  if (userAgent.includes("Mac")) return "Safari Mac";

  return "Unknown device";
}

function getTimeAgo(date) {
  if (!date) return "-";

  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);

  if (diff < 60) return "baru saja";
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;

  return `${Math.floor(diff / 86400)} hari lalu`;
}

export default function AdminSessionCard() {
  const router = useRouter();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState("");
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
        throw new Error(data.error || "Gagal memuat session");
      }

      setSessions(data.sessions || []);
    } catch (err) {
      setError(err.message || "Gagal memuat session");
    } finally {
      setLoading(false);
    }
  }

  async function revokeSession(id) {
    if (!id || revokingId) return;

    const accepted = window.confirm("Putuskan session ini?");

    if (!accepted) return;

    setRevokingId(id);
    setError("");

    try {
      const csrfToken = getCookie("csrf_token");

      const res = await fetch("/api/admin/sessions", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken || "",
        },
        body: JSON.stringify({ id }),
      });

      if (res.status === 401) {
        await redirectToLogin();
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal memutuskan session");
      }

      await loadSessions();
    } catch (err) {
      setError(err.message || "Gagal memutuskan session");
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
          <h2 style={styles.title}>Session Aktif</h2>
          <p style={styles.description}>
            Daftar perangkat yang sedang memiliki akses admin.
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
          Refresh
        </button>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      {loading ? (
        <div style={styles.emptyBox}>Memuat session...</div>
      ) : sessions.length === 0 ? (
        <div style={styles.emptyBox}>Tidak ada session aktif.</div>
      ) : (
        <div style={styles.sessionList}>
          {sessions.map((session) => (
            <div key={session.id} style={styles.sessionItem}>
              <div style={styles.sessionInfo}>
                <div style={styles.sessionDevice}>
                  {getDeviceName(session.user_agent)}
                </div>

                <div style={styles.sessionMeta}>
                  Last active: {getTimeAgo(session.last_active)}
                </div>

                {session.ip && (
                  <div style={styles.sessionMeta}>IP: {session.ip}</div>
                )}
              </div>

              <button
                type="button"
                onClick={() => revokeSession(session.id)}
                disabled={revokingId === session.id}
                style={{
                  ...styles.dangerButton,
                  opacity: revokingId === session.id ? 0.6 : 1,
                }}
              >
                {revokingId === session.id ? "Memutus..." : "Putuskan"}
              </button>
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
  },
  sessionDevice: {
    fontSize: 14,
    fontWeight: 800,
    color: "var(--admin-text)",
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
};
