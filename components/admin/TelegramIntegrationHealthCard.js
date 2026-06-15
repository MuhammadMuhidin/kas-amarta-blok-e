"use client";

import { readJson, sendJson } from "@/components/admin/adminClientApi";
import Toast from "@/components/Toast";
import { useEffect, useState } from "react";

const ENDPOINT = "/api/admin/settings/telegram";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function statusText(status) {
  if (!status) return "Status belum dimuat";
  const config = status.config || {};
  if (!config.bot_token_configured || !config.chat_id_configured) {
    return "Bot Token atau Chat ID belum lengkap";
  }
  if (!config.webhook_secret_configured) {
    return "Webhook secret belum dikonfigurasi";
  }
  if (status.webhook_error) return status.webhook_error;
  if (!status.webhook?.url) return "Bot siap mengirim, webhook belum terdaftar";
  return status.webhook.pending_update_count
    ? `Webhook aktif • ${status.webhook.pending_update_count} update menunggu`
    : "Webhook aktif dan siap menerima action";
}

function actionSuccessText(action) {
  if (action === "register_webhook") return "Webhook Telegram berhasil didaftarkan";
  if (action === "remove_webhook") return "Webhook Telegram berhasil dihapus";
  if (action === "test_direct") return "Pesan test Telegram berhasil dikirim";
  if (action === "test_queue") return "Event test berhasil dimasukkan ke Queue";
  return "Telegram action completed";
}

function Pill({ label, ready }) {
  return <span style={{
    ...styles.statusPill,
    borderColor: ready ? "#16a34a" : "#dc2626",
    color: ready ? "#16a34a" : "#dc2626",
  }}>{ready ? "✓" : "×"} {label}</span>;
}

export default function TelegramIntegrationHealthCard() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState(null);

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }

  async function loadStatus() {
    try {
      setLoading(true);
      setStatus(await readJson(ENDPOINT));
    } catch (error) {
      setStatus({ webhook_error: error.message || "Failed to load Telegram status" });
    } finally {
      setLoading(false);
    }
  }

  async function runAction(action) {
    if (running) return;
    try {
      setRunning(true);
      await sendJson(ENDPOINT, "POST", { action });
      showToast(actionSuccessText(action));

      if (action === "register_webhook" || action === "remove_webhook") {
        await delay(1200);
        await loadStatus();
      }
    } catch (error) {
      showToast(error.message || "Telegram action failed", "error");
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  const config = status?.config || {};
  const notificationsEnabled = status?.auth_config?.telegram_notifications_enabled !== false;

  return <>
    <Toast show={!!toast} type={toast?.type} message={toast?.message} />
    <div style={styles.card}>
      <div>
        <h4 style={styles.title}>Telegram Integration Health</h4>
        <div style={styles.description}>{loading ? "Reading Telegram status..." : statusText(status)}</div>
      </div>

      <div style={styles.statusGrid}>
        <Pill label="Bot Token" ready={config.bot_token_configured} />
        <Pill label="Chat ID" ready={config.chat_id_configured} />
        <Pill label="Webhook Secret" ready={config.webhook_secret_configured} />
        <Pill label={`Authorized Users: ${config.authorized_user_count || 0}`} ready={Number(config.authorized_user_count || 0) > 0} />
        <Pill label="Queue Push" ready={status?.queue?.http_push_configured} />
      </div>

      <div style={styles.actions}>
        <button type="button" className="admin-small-btn" disabled={running} onClick={() => runAction("test_direct")}>Test Direct</button>
        <button type="button" className="admin-small-btn" disabled={running || !notificationsEnabled} onClick={() => runAction("test_queue")}>Test Queue</button>
        <button type="button" className="admin-small-btn" disabled={running} onClick={() => runAction("register_webhook")}>Register Webhook</button>
        <button type="button" className="admin-small-btn" disabled={running || !status?.webhook?.url} onClick={() => runAction("remove_webhook")}>Remove Webhook</button>
      </div>
    </div>
  </>;
}

const styles = {
  card: { marginTop: 4, paddingTop: 14, borderTop: "1px solid var(--admin-border)" },
  title: { margin: "0 0 5px", fontSize: 15 },
  description: { fontSize: 13, color: "var(--admin-muted)", fontWeight: 600, lineHeight: 1.5 },
  statusGrid: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 },
  statusPill: { display: "inline-flex", border: "1px solid", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 800 },
  actions: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 },
};
