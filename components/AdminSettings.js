"use client";

import { useEffect, useState } from "react";

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

export default function AdminSettings() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [appConfig, setAppConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);

  const [popup, setPopup] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  async function loadAppConfig() {
    try {
      setLoadingConfig(true);

      const res = await fetch("/api/admin/settings/app", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal memuat konfigurasi kas");
      }

      setAppConfig(data.config);
    } catch (err) {
      alert(err.message || "Gagal memuat konfigurasi kas");
    } finally {
      setLoadingConfig(false);
    }
  }

  async function updateConfig(key, value) {
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
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal update config");
      }

      await loadAppConfig();

      showPopup(
        setPopup,
        "Konfigurasi berhasil diperbarui",
        "success",
      );
    } catch (err) {
      showPopup(
        setPopup,
        err.message || "Gagal update config",
        "error",
      );
    } finally {
      setSavingConfig(false);
    }
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
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      await loadConfig();

      showPopup(
        setPopup,
        "Settings auth berhasil diperbarui",
        "success",
      );
    } catch (err) {
      showPopup(
        setPopup,
        err.message || "Gagal update setting",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadConfig();
    loadAppConfig();
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
    return <div style={styles.card}>Memuat settings...</div>;
  }

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
        <div style={styles.loadingBox}>Memuat konfigurasi...</div>
      ) : (
        <div style={styles.section}>
          <ConfigItem
            label="Nominal Kas Bulanan"
            description="Default iuran kas bulanan saat pembayaran dan laporan tunggakan."
            type="number"
            value={appConfig?.monthly_fee}
            disabled={savingConfig}
            isMobile={isMobile}
            onSave={(value) => updateConfig("monthly_fee", value)}
          />

          <ConfigItem
            label="Iuran Sampah"
            description="Default iuran sampah yang dibayar bersama iuran kas warga."
            type="number"
            value={appConfig?.trash_fee}
            disabled={savingConfig}
            isMobile={isMobile}
            onSave={(value) => updateConfig("trash_fee", value)}
          />

          <ConfigItem
            label="Mulai Monitoring"
            description="Periode awal validasi monitoring sistem. Data sebelum periode ini akan diabaikan dari integrity check."
            type="month"
            value={appConfig?.start_monitoring_date}
            disabled={savingConfig}
            isMobile={isMobile}
            onSave={(value) =>
              updateConfig("start_monitoring_date", value)
            }
          />
        </div>
      )}

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
            background: checked ? "#4f46e5" : "#cbd5e1",
          }}
        >
          <span
            style={{
              ...styles.knob,
              transform: checked ? "translateX(22px)" : "translateX(0)",
            }}
          />
        </span>
      </label>
    </div>
  );
}

function ConfigItem({
  label,
  description,
  type,
  value,
  onSave,
  disabled,
  isMobile,
}) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const unchanged = String(local) === String(value);

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
          Simpan
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
    right: 20,
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
    width: 48,
    height: 26,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    padding: 2,
    transition: ".2s",
  },

  knob: {
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
    background: "var(--admin-surface)",
    color: "var(--admin-text)",
    fontWeight: 600,
    outline: "none",
  },

  saveButton: {
    height: 38,
    padding: "0 14px",
    border: "none",
    borderRadius: 10,
    background: "#2563eb",
    color: "#fff",
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
};
