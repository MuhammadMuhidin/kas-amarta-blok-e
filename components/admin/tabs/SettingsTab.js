"use client";

import AdminSessionCard from "@/components/AdminSessionCard";
import AdminDataSkeleton from "@/components/admin/AdminDataSkeleton";
import LoadingButtonContent from "@/components/admin/LoadingButtonContent";
import MatrixAccessCard from "@/components/admin/MatrixAccessCard";
import modalStyles from "@/components/admin/AdminModal.module.css";
import IntegrationConfigurationCard from "@/components/admin/settings/IntegrationConfigurationCard";
import {
  ConfigItem,
  SelectRow,
  SettingRow,
  styles,
} from "@/components/admin/settings/SettingsControls";
import { useEffect, useState } from "react";

const themes = [
  ["default", "Default", ["#f1f5f9", "#60a5fa", "#ffffff"]],
  ["ledger", "Ledger", ["#fdf6e3", "#2f6f4e", "#fffaf0"]],
  ["midnight", "Midnight", ["#020617", "#3b82f6", "#111827"]],
  ["emerald", "Emerald", ["#ecfdf5", "#10b981", "#d1fae5"]],
  ["amoled", "AMOLED", ["#000000", "#ffffff", "#111111"]],
  ["hacker", "Hacker", ["#020b02", "#22c55e", "#14532d"]],
].map(([id, label, colors]) => ({ id, label, colors }));

const durationOptions = [
  ["1 Hour", "3600"],
  ["6 Hours", "21600"],
  ["12 Hours", "43200"],
  ["1 Day", "86400"],
  ["3 Days", "259200"],
  ["7 Days", "604800"],
  ["30 Days", "2592000"],
].map(([label, value]) => ({ label, value }));

const cookie = (name) => document.cookie
  .split("; ")
  .find((row) => row.startsWith(`${name}=`))
  ?.split("=")[1] || "";

const notify = (setPopup, text, type = "success") => {
  setPopup({ text, type });
  setTimeout(() => setPopup(null), 2500);
};

function savedTheme() {
  if (typeof window === "undefined") return "default";
  const value = localStorage.getItem("admin-theme") || "default";
  if (value !== "ios") return value;
  localStorage.setItem("admin-theme", "ledger");
  return "ledger";
}

export default function AdminSettings() {
  const [config, setConfig] = useState(null);
  const [appConfig, setAppConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingMatrix, setSavingMatrix] = useState(false);
  const [savingIntegration, setSavingIntegration] = useState(false);
  const [popup, setPopup] = useState(null);
  const [theme, setTheme] = useState("default");
  const [isMobile, setIsMobile] = useState(false);
  const [pinModal, setPinModal] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const [resetKey, setResetKey] = useState(0);

  async function loadConfig() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/settings/auth");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setConfig(data.config);
    } finally {
      setLoading(false);
    }
  }

  async function loadAppConfig() {
    setLoadingConfig(true);
    try {
      const response = await fetch("/api/admin/settings/app", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setAppConfig(data.config);
    } catch (error) {
      notify(setPopup, error.message || "Failed to load cash configuration", "error");
    } finally {
      setLoadingConfig(false);
    }
  }

  function requestPin(action) {
    setPinValue("");
    setPendingAction(() => action);
    setPinModal(true);
  }

  async function updateSetting(key, value) {
    requestPin(async (pin) => {
      setSaving(true);
      try {
        const response = await fetch("/api/admin/settings/auth", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": cookie("csrf_token"),
          },
          body: JSON.stringify({ key, value, pin }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        await loadConfig();
        notify(setPopup, "Auth settings updated successfully");
      } catch (error) {
        setResetKey((value) => value + 1);
        notify(setPopup, error.message || "Failed to update auth setting", "error");
      } finally {
        setSaving(false);
      }
    });
  }

  async function updateAppSetting(key, value) {
    requestPin(async (pin) => {
      setSavingConfig(true);
      try {
        const response = await fetch("/api/admin/settings/app", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": cookie("csrf_token"),
          },
          body: JSON.stringify({ key, value, pin }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        await loadAppConfig();
        notify(setPopup, "Configuration updated successfully");
      } catch (error) {
        setResetKey((value) => value + 1);
        notify(setPopup, error.message || "Failed to update configuration", "error");
      } finally {
        setSavingConfig(false);
      }
    });
  }

  function applyTheme(id) {
    setTheme(id);
    localStorage.setItem("admin-theme", id);
    document.documentElement.dataset.adminTheme = id;
    notify(setPopup, `Theme changed to ${themes.find((item) => item.id === id)?.label || "Default"}`);
  }

  useEffect(() => {
    loadConfig();
    loadAppConfig();
    setTheme(savedTheme());
  }, []);

  useEffect(() => {
    const resize = () => setIsMobile(window.innerWidth <= 640);
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  if (loading && !config) {
    return (
      <div style={styles.card}>
        <AdminDataSkeleton cards={4} rows={7} />
      </div>
    );
  }

  const busy = saving || savingConfig || savingMatrix || savingIntegration;

  async function confirmPin() {
    if (!pendingAction || busy) return;
    await pendingAction(pinValue);
    setPinModal(false);
    setPendingAction(null);
  }

  return (
    <div style={styles.card}>
      {popup && (
        <div
          style={{
            ...styles.popup,
            background: popup.type === "success" ? "#166534" : "#991b1b",
          }}
        >
          {popup.text}
        </div>
      )}

      <h2 style={styles.title}>Cash Configuration</h2>
      {loadingConfig && !appConfig ? (
        <AdminDataSkeleton showSummary={false} rows={3} />
      ) : (
        <div style={styles.section}>
          <ConfigItem
            label="Monthly Cash Fee"
            description="Default monthly cash fee used for payments and arrears reports."
            type="number"
            value={appConfig?.monthly_fee}
            resetKey={resetKey}
            disabled={savingConfig}
            saving={savingConfig}
            isMobile={isMobile}
            onSave={(value) => updateAppSetting("monthly_fee", value)}
          />
          <ConfigItem
            label="Trash Fee"
            description="Default trash fee paid together with resident cash payments."
            type="number"
            value={appConfig?.trash_fee}
            resetKey={resetKey}
            disabled={savingConfig}
            saving={savingConfig}
            isMobile={isMobile}
            onSave={(value) => updateAppSetting("trash_fee", value)}
          />
          <ConfigItem
            label="Monitoring Start"
            description="Initial period for system monitoring validation. Data before this period is ignored."
            type="month"
            value={appConfig?.start_monitoring_date}
            resetKey={resetKey}
            disabled={savingConfig}
            saving={savingConfig}
            isMobile={isMobile}
            onSave={(value) => updateAppSetting("start_monitoring_date", value)}
          />
        </div>
      )}

      <IntegrationConfigurationCard
        requestPin={requestPin}
        showPopup={(text, type) => notify(setPopup, text, type)}
        onBusyChange={setSavingIntegration}
        isMobile={isMobile}
      />

      <h2 style={styles.title}>Appearance Theme</h2>
      <div style={styles.themeSection}>
        <div style={styles.themeIntro}>Customize admin dashboard colors and visual style.</div>
        <div style={styles.themeGrid}>
          {themes.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => applyTheme(item.id)}
              style={{
                ...styles.themeCard,
                ...(theme === item.id ? styles.themeCardActive : {}),
              }}
            >
              <div style={styles.paletteRow}>
                {item.colors.map((color) => (
                  <span key={color} style={{ ...styles.paletteDot, background: color }} />
                ))}
              </div>
              <div style={styles.themeLabel}>{item.label}</div>
            </button>
          ))}
        </div>
      </div>

      <h2 style={styles.title}>Settings Auth</h2>
      <SettingRow
        title="WebAuth Passkey"
        description="Require passkey/fingerprint verification after the password."
        checked={config.webAuthEnabled}
        disabled={saving}
        onChange={(value) => updateSetting("WEB_AUTH_ENABLED", value)}
      />
      <SettingRow
        title="PIN Login"
        description="Require a PIN after the password."
        checked={config.pinEnabled}
        disabled={saving}
        onChange={(value) => updateSetting("PIN_ENABLED", value)}
      />
      <SettingRow
        title="WhatsApp Services"
        description="Enable all existing WhatsApp delivery mechanisms."
        checked={config.whatsappServicesEnabled !== false}
        disabled={saving}
        onChange={(value) => updateSetting("WA_SERVICES_ENABLED", value)}
      />
      <SettingRow
        title="Telegram Notification Alerts"
        description="Send operational alerts for resident requests, approval decisions, and payment proof uploads."
        checked={config.telegramNotificationsEnabled === true}
        disabled={saving}
        onChange={(value) => updateSetting("TELEGRAM_NOTIFICATIONS_ENABLED", value)}
      />
      <SettingRow
        title="Telegram Approval Actions"
        description="Allow authorized Telegram users to approve or reject requests and payment proofs."
        checked={config.telegramActionsEnabled === true}
        disabled={saving || !config.telegramNotificationsEnabled}
        onChange={(value) => updateSetting("TELEGRAM_ACTIONS_ENABLED", value)}
      />
      <SelectRow
        title="Session Duration"
        description="Admin login session duration before automatic logout."
        value={String(config.sessionDuration || 86400)}
        options={durationOptions}
        disabled={saving}
        isMobile={isMobile}
        onChange={(value) => updateSetting("SESSION_DURATION", value)}
      />

      <MatrixAccessCard
        requestPin={requestPin}
        disabled={busy}
        onSavingChange={setSavingMatrix}
        showPopup={(text, type) => notify(setPopup, text, type)}
      />
      <AdminSessionCard />

      {pinModal && (
        <div className={modalStyles.overlay}>
          <div className={modalStyles.box} style={{ maxWidth: 360, padding: 22 }}>
            <div style={styles.pinTitle}>Re-auth PIN</div>
            <div style={styles.pinDesc}>Confirm administrator PIN to apply changes.</div>
            <input
              type="password"
              placeholder="Enter PIN"
              value={pinValue}
              onChange={(event) => setPinValue(event.target.value)}
              style={styles.pinInput}
              disabled={busy}
              autoFocus
            />
            <div style={styles.pinActions}>
              <button
                type="button"
                style={styles.pinCancel}
                disabled={busy}
                onClick={() => {
                  setPinModal(false);
                  setPendingAction(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                style={{ ...styles.pinConfirm, opacity: busy ? 0.7 : 1 }}
                disabled={busy}
                onClick={confirmPin}
              >
                <LoadingButtonContent loading={busy} loadingText="Applying...">
                  Apply Change
                </LoadingButtonContent>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
