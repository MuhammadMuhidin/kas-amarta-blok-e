"use client";

import { readJson, sendJson } from "@/components/admin/adminClientApi";
import Toast from "@/components/Toast";
import { useEffect, useState } from "react";

const ENDPOINT = "/api/admin/settings/telegram";

const DISPLAY_TEXT_REPLACEMENTS = new Map([
  [
    "Uji WhatsApp melalui external API dan email secara terpisah. Event streaming serta pairing code WhatsApp tampil langsung di bawah ini.",
    "Test WhatsApp through the external API and email separately. Streaming events and the WhatsApp pairing code appear below.",
  ],
  ["Konfirmasi Nomor WhatsApp", "Confirm WhatsApp Number"],
  [
    "Nomor hanya digunakan sementara oleh external API untuk membuat pairing code ketika session keluar. Nomor tidak disimpan oleh aplikasi.",
    "Enter the number used to generate a pairing code when the session is disconnected.",
  ],
  ["Nomor WhatsApp", "WhatsApp Number"],
  [
    "Boleh diawali 08, +62, atau 62. Sistem akan menormalkan nomor sebelum dikirim ke external API.",
    "Accepted formats: 08, +62, or 62.",
  ],
  ["Batal", "Cancel"],
  ["Memulai...", "Starting..."],
  ["Mulai Test", "Start Test"],
  [
    "Buka WhatsApp → Perangkat tertaut → Tautkan perangkat → Tautkan dengan nomor telepon, lalu masukkan kode ini.",
    "Open WhatsApp → Linked devices → Link a device → Link with phone number, then enter this code.",
  ],
  ["Salin Kode", "Copy Code"],
  ["Email test berhasil dikirim.", "The test email was sent successfully."],
  ["Gagal mengirim email test", "Failed to send the test email"],
]);

function translateDisplayText(value) {
  const text = String(value || "");
  const trimmed = text.trim();
  const exact = DISPLAY_TEXT_REPLACEMENTS.get(trimmed);

  if (exact) return text.replace(trimmed, exact);
  if (trimmed.startsWith("Email test dilewati:")) {
    return text.replace("Email test dilewati:", "The email test was skipped:");
  }
  if (trimmed.startsWith("Email test gagal:")) {
    return text.replace("Email test gagal:", "The email test failed:");
  }

  return text;
}

function applyEnglishAlertDisplayCopy() {
  if (typeof document === "undefined" || !document.body) return;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    const translated = translateDisplayText(node.nodeValue);
    if (translated !== node.nodeValue) node.nodeValue = translated;
    node = walker.nextNode();
  }

  document.querySelectorAll('input[placeholder="Contoh: 628123456789"]').forEach((input) => {
    input.setAttribute("placeholder", "Example: 628123456789");
  });
}

function useEnglishAlertDisplayCopy() {
  useEffect(() => {
    applyEnglishAlertDisplayCopy();

    const observer = new MutationObserver(() => {
      applyEnglishAlertDisplayCopy();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder"],
    });

    return () => observer.disconnect();
  }, []);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function statusText(status) {
  if (!status) return "Status has not been loaded";
  const config = status.config || {};
  if (!config.bot_token_configured || !config.chat_id_configured) {
    return "Bot Token or Chat ID is incomplete";
  }
  if (!config.webhook_secret_configured) {
    return "Webhook Secret is not configured";
  }
  if (status.webhook_error) return status.webhook_error;
  if (!status.webhook?.url) return "The bot can send messages, but the webhook is not registered";
  return status.webhook.pending_update_count
    ? `Webhook active • ${status.webhook.pending_update_count} pending updates`
    : "Webhook active and ready to receive actions";
}

function actionSuccessText(action) {
  if (action === "register_webhook") return "Telegram webhook registered successfully";
  if (action === "remove_webhook") return "Telegram webhook removed successfully";
  if (action === "test_direct") return "Telegram test message sent successfully";
  if (action === "test_queue") return "Test event added to the queue successfully";
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

  useEnglishAlertDisplayCopy();

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
  const queuePushConfigured = Boolean(
    status?.queue?.http_push_url_configured &&
    status?.queue?.http_api_token_configured,
  );

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
        <Pill label="Queue Push" ready={queuePushConfigured} />
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
