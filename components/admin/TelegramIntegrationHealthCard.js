"use client";

import { readJson, sendJson } from "@/components/admin/adminClientApi";
import Toast from "@/components/Toast";
import { useEffect, useRef, useState } from "react";

const ENDPOINT = "/api/admin/settings/telegram";

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
  return (
    <span
      style={{
        ...styles.statusPill,
        borderColor: ready ? "#16a34a" : "#dc2626",
        color: ready ? "#16a34a" : "#dc2626",
      }}
    >
      {ready ? "✓" : "×"} {label}
    </span>
  );
}

export default function TelegramIntegrationHealthCard() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState(null);
  const requestRef = useRef(null);

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }

  async function loadStatus({ silent = false } = {}) {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    try {
      if (!silent) setLoading(true);
      const telegramStatus = await readJson(ENDPOINT, { signal: controller.signal });
      if (controller.signal.aborted || requestRef.current !== controller) return;
      setStatus(telegramStatus);
    } catch (error) {
      if (error?.name === "AbortError" || controller.signal.aborted) return;
      if (requestRef.current === controller) {
        setStatus({ webhook_error: error.message || "Failed to load Telegram status" });
      }
    } finally {
      if (!controller.signal.aborted && requestRef.current === controller && !silent) {
        setLoading(false);
      }
    }
  }

  async function runAction(action) {
    if (running) return;
    try {
      setRunning(true);
      await sendJson(ENDPOINT, "POST", { action });
      showToast(actionSuccessText(action));

      if (action === "register_webhook" || action === "remove_webhook") {
        await delay(700);
        await loadStatus({ silent: true });
      }
    } catch (error) {
      showToast(error.message || "Telegram action failed", "error");
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    loadStatus();
    return () => requestRef.current?.abort();
  }, []);

  const config = status?.config || {};
  const telegramNotificationsEnabled = status?.auth_config?.telegram_notifications_enabled === true;
  const telegramApprovalActionsEnabled = status?.auth_config?.telegram_approval_actions_enabled === true;
  const telegramTestsDisabled = !telegramNotificationsEnabled && !telegramApprovalActionsEnabled;
  const queuePushConfigured = Boolean(
    status?.queue?.http_push_url_configured
      && status?.queue?.http_api_token_configured,
  );

  return (
    <>
      <Toast show={Boolean(toast)} type={toast?.type} message={toast?.message} />
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <h4 style={styles.title}>Telegram Integration Health</h4>
            <div style={styles.description}>
              {loading ? "Reading Telegram status..." : statusText(status)}
            </div>
          </div>
        </div>

        <div style={styles.statusGrid}>
          <Pill label="Bot Token" ready={config.bot_token_configured} />
          <Pill label="Chat ID" ready={config.chat_id_configured} />
          <Pill label="Webhook Secret" ready={config.webhook_secret_configured} />
          <Pill
            label={`Authorized Users: ${config.authorized_user_count || 0}`}
            ready={Number(config.authorized_user_count || 0) > 0}
          />
          <Pill label="Queue Push" ready={queuePushConfigured} />
        </div>

        <div style={styles.actions}>
          <button
            type="button"
            className="admin-small-btn"
            disabled={loading || running || telegramTestsDisabled}
            title={telegramTestsDisabled
              ? "Telegram notifications and approval actions are disabled in Settings."
              : ""}
            onClick={() => runAction("test_direct")}
          >
            Test Direct
          </button>
          <button
            type="button"
            className="admin-small-btn"
            disabled={loading || running || telegramTestsDisabled || !queuePushConfigured}
            title={!queuePushConfigured
              ? "Cloudflare Queue push configuration is incomplete."
              : telegramTestsDisabled
                ? "Telegram notifications and approval actions are disabled in Settings."
                : ""}
            onClick={() => runAction("test_queue")}
          >
            Test Queue
          </button>
          <button
            type="button"
            className="admin-small-btn"
            disabled={loading || running}
            onClick={() => runAction("register_webhook")}
          >
            Register Webhook
          </button>
          <button
            type="button"
            className="admin-small-btn"
            disabled={loading || running || !status?.webhook?.url}
            onClick={() => runAction("remove_webhook")}
          >
            Remove Webhook
          </button>
        </div>
      </div>
    </>
  );
}

const styles = {
  card: {
    marginTop: 14,
    paddingTop: 14,
    borderTop: "1px solid var(--admin-border)",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  title: { margin: "0 0 5px", fontSize: 15 },
  description: {
    fontSize: 13,
    color: "var(--admin-muted)",
    fontWeight: 600,
    lineHeight: 1.5,
  },
  statusGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  statusPill: {
    display: "inline-flex",
    border: "1px solid",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 800,
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
};
