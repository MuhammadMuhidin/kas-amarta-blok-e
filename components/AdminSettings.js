"use client";

import AdminSessionCard from "@/components/AdminSessionCard";
import modalStyles from "@/components/admin/AdminModal.module.css";
import LoadingButtonContent from "@/components/admin/LoadingButtonContent";
import { useEffect, useState } from "react";

const themes = [
  {
    id: "default",
    label: "Default",
    colors: ["#f1f5f9", "#60a5fa", "#ffffff"],
  },
  {
    id: "ledger",
    label: "Ledger",
    colors: ["#f2f2f7", "#007aff", "#ffffff"],
  },
  {
    id: "midnight",
    label: "Midnight",
    colors: ["#020617", "#3b82f6", "#111827"],
  },
  {
    id: "emerald",
    label: "Emerald",
    colors: ["#ecfdf5", "#10b981", "#d1fae5"],
  },
  {
    id: "amoled",
    label: "AMOLED",
    colors: ["#000000", "#ffffff", "#111111"],
  },
  {
    id: "hacker",
    label: "Hacker",
    colors: ["#020b02", "#22c55e", "#14532d"],
  },
];

const sessionDurationOptions = [
  { label: "1 Hour", value: "3600" },
  { label: "6 Hours", value: "21600" },
  { label: "12 Hours", value: "43200" },
  { label: "1 Day", value: "86400" },
  { label: "3 Days", value: "259200" },
  { label: "7 Days", value: "604800" },
  { label: "30 Days", value: "2592000" },
];

function getCookie(name) {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}

function showPopup(setPopup, text, type = "success") {
  setPopup({
    text,
    type,
  });

  setTimeout(() => {
    setPopup(null);
  }, 2500);
}

function getSavedTheme() {
  if (typeof window === "undefined") return "default";

  const savedTheme =
    localStorage.getItem("admin-theme") || "default";

  if (savedTheme === "ios") {
    localStorage.setItem("admin-theme", "ledger");
    return "ledger";
  }

  return savedTheme;
}

export default function AdminSettings() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [appConfig, setAppConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);

  const [popup, setPopup] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [theme, setTheme] = useState("default");

  const [pinModal, setPinModal] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pendingAction, setPendingAction] = useState(null);

  const [configResetKey, setConfigResetKey] = useState(0);

  async function loadAppConfig() {
    try {
      setLoadingConfig(true);

      const res = await fetch("/api/admin/settings/app", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load cash configuration");
      }

      setAppConfig(data.config);
    } catch (err) {
      alert(err.message || "Failed to load cash configuration");
    } finally {
      setLoadingConfig(false);
    }
  }

  async function updateConfig(key, value) {
    requestPin(async (pin) => {
      try {
        setSavingConfig(true);

        const csrfToken = getCookie("csrf_token");

        const res = await fetch("/api/admin/settings/app", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
          },
          body: JSON.stringify({
            key,
            value,
            pin,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to update configuration");
        }

        await loadAppConfig();

        showPopup(
          setPopup,
          "Configuration updated successfully",
          "success",
        );
      } catch (err) {
        setConfigResetKey((prev) => prev + 1);

        showPopup(
          setPopup,
          err.message || "Failed to update configuration",
          "error",
        );
      } finally {
        setSavingConfig(false);
      }
    });
  }

  async function loadConfig() {
    setLoading(true);

    try {
      const res = await fetch("/api/admin/settings/auth");

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      setConfig(data.config);
    } finally {
      setLoading(false);
    }
  }

  async function updateSetting(key, value) {
    requestPin(async (pin) => {
      setSaving(true);

      try {
        const csrf = getCookie("csrf_token");

        const res = await fetch("/api/admin/settings/auth", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrf || "",
          },
          body: JSON.stringify({
            key,
            value,
            pin,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error);
        }

        await loadConfig();

        showPopup(
          setPopup,
          "Auth settings updated successfully",
          "success",
        );
      } catch (err) {
        setConfigResetKey((prev) => prev + 1);

        showPopup(
          setPopup,
          err.message || "Failed to update auth setting",
          "error",
        );
      } finally {
        setSaving(false);
      }
    });
  }

  function applyTheme(nextTheme) {
    setTheme(nextTheme);
    localStorage.setItem("admin-theme", nextTheme);
    document.documentElement.dataset.adminTheme = nextTheme;

    showPopup(
      setPopup,
      `Theme changed to ${themes.find((item) => item.id === nextTheme)?.label || "Default"}`,
      "success",
    );
  }

  useEffect(() => {
    loadConfig();
    loadAppConfig();
    setTheme(getSavedTheme());
  }, []);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 640);
    }

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (loading) {
    return <div style={styles.card}>Loading settings...</div>;
  }

  function requestPin(action) {
    setPinValue("");
    setPendingAction(() => action);
    setPinModal(true);
  }

  async function confirmPin() {
    if (!pendingAction || saving || savingConfig) return;

    await pendingAction(pinValue);

    setPinModal(false);
    setPendingAction(null);
  }

  const applyingChange = saving || savingConfig;

  return (
    <div style={styles.card}>
      {popup && (
        <div
          style={{
            ...styles.popup,
            background:
              popup.type === "success"
                ? "#166534"
                : "#991b1b",
          }}
        >
          {popup.text}
        </div>
      )}

      <h2 style={styles.title}>Konfigurasi Kas</h2>

      {loadingConfig ? (
        <div style={styles.loadingBox}>Loading configuration...</div>
      ) : (
        <div style={styles.section}>
          <ConfigItem
            label="Nominal Kas Bulanan"
            description="Default iuran kas bulanan saat pembayaran dan laporan tunggakan."
            type="number"
            value={appConfig?.monthly_fee}
            resetKey={configResetKey}
            disabled={savingConfig}
            saving={savingConfig}
            isMobile={isMobile}
            onSave={(value) => updateConfig("monthly_fee", value)}
          />

          <ConfigItem
            label="Iuran Sampah"
            description="Default iuran sampah yang dibayar bersama iuran kas warga."
            type="number"
            value={appConfig?.trash_fee}
            resetKey={configResetKey}
            disabled={savingConfig}
            saving={savingConfig}
            isMobile={isMobile}
            onSave={(value) => updateConfig("trash_fee", value)}
          />

          <ConfigItem
            label="Mulai Monitoring"
            description="Periode awal validasi monitoring sistem. Data sebelum periode ini akan diabaikan dari integrity check."
            type="month"
            value={appConfig?.start_monitoring_date}
            resetKey={configResetKey}
            disabled={savingConfig}
            saving={savingConfig}
            isMobile={isMobile}
            onSave={(value) =>
              updateConfig("start_monitoring_date", value)
            }
          />
        </div>
      )}

      <h2 style={styles.title}>Appearance Theme</h2>

      <div style={styles.themeSection}>
        <div style={styles.themeIntro}>
          Customize admin dashboard colors and visual style.
        </div>

        <div style={styles.themeGrid}>
          {themes.map((item) => {
            const active = theme === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => applyTheme(item.id)}
                style={{
                  ...styles.themeCard,
                  ...(active ? styles.themeCardActive : {}),
                }}
              >
                <div style={styles.paletteRow}>
                  {item.colors.map((color) => (
                    <span
                      key={color}
                      style={{
                        ...styles.paletteDot,
                        background: color,
                      }}
                    />
                  ))}
                </div>

                <div style={styles.themeLabel}>{item.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      <h2 style={styles.title}>Settings Auth</h2>

      <SettingRow
        title="WebAuth Passkey"
        description="Jika aktif, login wajib verifikasi passkey/fingerprint setelah password."
        checked={config.webAuthEnabled}
        disabled={saving}
        onChange={(value) => updateSetting("WEB_AUTH_ENABLED", value)}
      />

      <SettingRow
        title="PIN Login"
        description="Jika aktif, login wajib memasukkan PIN setelah password. PIN diminta setelah password. Jika WebAuth juga aktif, passkey tetap diminta setelah PIN."
        checked={config.pinEnabled}
        disabled={saving}
        onChange={(value) => updateSetting("PIN_ENABLED", value)}
      />

      <SelectSettingRow
        title="Session Duration"
        description="Lama sesi login admin sebelum otomatis logout. Perubahan berlaku mulai login berikutnya."
        value={String(config.sessionDuration || 86400)}
        options={sessionDurationOptions}
        disabled={saving}
        isMobile={isMobile}
        onChange={(value) => updateSetting("SESSION_DURATION", value)}
      />

      <AdminSessionCard />

      {pinModal && (
        <div className={modalStyles.overlay}>
          <div
            className={modalStyles.box}
            style={{ maxWidth: 360, padding: 22 }}
          >
            <div style={styles.pinTitle}>
              Re-auth PIN
            </div>

            <div style={styles.pinDesc}>
              Confirm administrator PIN to apply changes.
            </div>

            <input
              type="password"
              placeholder="Enter PIN"
              value={pinValue}
              onChange={(e) =>
                setPinValue(e.target.value)
              }
              style={styles.pinInput}
              disabled={applyingChange}
              autoFocus
            />

            <div style={styles.pinActions}>
              <button
                type="button"
                style={styles.pinCancel}
                disabled={applyingChange}
                onClick={() => {
                  setPinModal(false);
                  setPendingAction(null);
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                style={{
                  ...styles.pinConfirm,
                  opacity: applyingChange ? 0.7 : 1,
                  cursor: applyingChange ? "not-allowed" : "pointer",
                }}
                disabled={applyingChange}
                onClick={confirmPin}
              >
                <LoadingButtonContent loading={applyingChange} loadingText="Applying...">
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

function SettingRow({ title, description, checked, disabled, onChange }) {
  return (
    <div style={styles.row}>
      <div>
        <h3 style={styles.rowTitle}>{title}</h3>

        <p style={styles.desc}>{description}</p>
      </div>

      <label style={styles.switch}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          style={{
            display: "none",
          }}
        />

        <span
          style={{
            ...styles.slider,
            background: checked ? "var(--admin-primary)" : "#cbd5e1",
            opacity: disabled ? 0.65 : 1,
          }}
        >
          <span
            style={{
              ...styles.switchText,
              ...(checked ? styles.switchTextOn : styles.switchTextOff),
              color: checked ? "var(--admin-on-primary)" : "#475569",
            }}
          >
            {checked ? "ON" : "OFF"}
          </span>

          <span
            style={{
              ...styles.knob,
              transform: checked ? "translateX(34px)" : "translateX(0)",
            }}
          />
        </span>
      </label>
    </div>
  );
}

function SelectSettingRow({
  title,
  description,
  value,
  options,
  disabled,
  isMobile,
  onChange,
}) {
  return (
    <div
      style={{
        ...styles.row,
        ...(isMobile ? styles.rowMobile : {}),
      }}
    >
      <div>
        <h3 style={styles.rowTitle}>{title}</h3>

        <p style={styles.desc}>{description}</p>
      </div>

      <select
        className="admin-input"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{
          ...styles.selectInput,
          ...(isMobile ? styles.inputMobile : {}),
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ConfigItem({
  label,
  description,
  type,
  value,
  resetKey,
  onSave,
  disabled,
  saving,
  isMobile,
}) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value, resetKey]);

  const unchanged = String(local) === String(value);
  const loading = saving && !unchanged;

  return (
    <div
      style={{
        ...styles.row,
        ...(isMobile ? styles.rowMobile : {}),
      }}
    >
      <div>
        <h3 style={styles.rowTitle}>{label}</h3>

        <p style={styles.desc}>{description}</p>
      </div>

      <div
        style={{
          ...styles.configAction,
          ...(isMobile ? styles.configActionMobile : {}),
        }}
      >
        <input
          type={type}
          value={local || ""}
          disabled={disabled}
          onChange={(e) => setLocal(e.target.value)}
          style={{
            ...styles.input,
            ...(isMobile ? styles.inputMobile : {}),
          }}
        />

        <button
          type="button"
          disabled={disabled || unchanged}
          onClick={() => onSave(local)}
          style={{
            ...styles.saveButton,
            ...(isMobile ? styles.saveButtonMobile : {}),
            opacity: disabled || unchanged ? 0.55 : 1,
            cursor: disabled || unchanged ? "not-allowed" : "pointer",
          }}
        >
          <LoadingButtonContent loading={loading} loadingText="Saving...">
            Save
          </LoadingButtonContent>
        </button>
      </div>
    </div>
  );
}

const styles = {
  card: {
    position: "relative",
    background: "var(--admin-card)",
    color: "var(--admin-text)",
    borderRadius: 18,
    padding: 20,
    boxShadow: "0 10px 30px rgba(0,0,0,.18)",
    border: "1px solid var(--admin-border)",
  },

  popup: {
    position: "fixed",
    top: 20,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 9999,
    color: "#fff",
    padding: "12px 16px",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    boxShadow: "0 10px 25px rgba(0,0,0,.25)",
  },

  title: {
    margin: "0 0 18px",
    fontSize: 20,
    color: "var(--admin-text)",
  },

  section: {
    marginBottom: 24,
  },

  themeSection: {
    marginBottom: 24,
    borderTop: "1px solid var(--admin-border)",
    paddingTop: 16,
  },

  themeIntro: {
    marginBottom: 14,
    color: "var(--admin-muted)",
    fontSize: 13,
    lineHeight: 1.5,
  },

  themeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))",
    gap: 10,
  },

  themeCard: {
    border: "1px solid var(--admin-border)",
    borderRadius: 14,
    padding: 12,
    background: "var(--admin-row)",
    color: "var(--admin-text)",
    cursor: "pointer",
    textAlign: "left",
  },

  themeCardActive: {
    borderColor: "var(--admin-primary)",
    boxShadow: "0 0 0 2px var(--admin-primary)",
  },

  paletteRow: {
    display: "flex",
    gap: 8,
    marginBottom: 12,
  },

  paletteDot: {
    width: 18,
    height: 18,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.2)",
  },

  themeLabel: {
    fontSize: 14,
    fontWeight: 800,
  },

  loadingBox: {
    padding: "16px 0",
    marginBottom: 24,
    color: "var(--admin-muted)",
    borderTop: "1px solid var(--admin-border)",
  },

  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    padding: "16px 0",
    borderTop: "1px solid var(--admin-border)",
  },

  rowMobile: {
    flexDirection: "column",
    alignItems: "stretch",
  },

  rowTitle: {
    margin: 0,
    fontSize: 15,
    color: "var(--admin-text)",
  },

  desc: {
    margin: "6px 0 0",
    fontSize: 13,
    color: "var(--admin-muted)",
    lineHeight: 1.5,
  },

  switch: {
    cursor: "pointer",
    flexShrink: 0,
  },

  slider: {
    position: "relative",
    width: 62,
    height: 28,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    padding: 3,
    transition: ".2s",
    boxSizing: "border-box",
    overflow: "hidden",
  },

  switchText: {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 1,
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: ".04em",
    lineHeight: 1,
    pointerEvents: "none",
  },

  switchTextOn: {
    left: 9,
  },

  switchTextOff: {
    right: 8,
  },

  knob: {
    position: "relative",
    zIndex: 2,
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "#fff",
    transition: ".2s",
    boxShadow: "0 2px 6px rgba(0,0,0,.25)",
  },

  configAction: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },

  configActionMobile: {
    width: "100%",
    flexDirection: "column",
    alignItems: "stretch",
  },

  input: {
    width: 160,
    height: 38,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-input)",
    color: "var(--admin-text)",
    fontWeight: 600,
    outline: "none",
  },

  selectInput: {
    width: 180,
    height: 38,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-input)",
    color: "var(--admin-text)",
    fontWeight: 700,
    outline: "none",
  },

  saveButton: {
    height: 38,
    padding: "0 14px",
    border: "none",
    borderRadius: 10,
    background: "var(--admin-primary)",
    color: "var(--admin-on-primary)",
    fontWeight: 700,
  },

  inputMobile: {
    width: "100%",
    boxSizing: "border-box",
  },

  saveButtonMobile: {
    width: "100%",
    boxSizing: "border-box",
  },

  pinTitle: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 8,
    color: "var(--admin-text)",
  },

  pinDesc: {
    fontSize: 14,
    color: "var(--admin-muted)",
    marginBottom: 16,
    lineHeight: 1.5,
  },

  pinInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-input)",
    color: "var(--admin-text)",
    fontSize: 15,
    outline: "none",
    marginBottom: 16,
  },

  pinActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
  },

  pinCancel: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-row)",
    color: "var(--admin-text)",
    cursor: "pointer",
  },

  pinConfirm: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "none",
    background: "var(--admin-primary)",
    color: "var(--admin-on-primary)",
    fontWeight: 700,
    cursor: "pointer",
  },
};
