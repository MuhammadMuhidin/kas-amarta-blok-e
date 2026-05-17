"use client";

import { useEffect, useState } from "react";

function getCookie(name) {
  return document.cookie
    .split("; ")
    .find((row) =>
      row.startsWith(`${name}=`)
    )
    ?.split("=")[1];
}

export default function AdminSettings() {
  const [config, setConfig] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  async function loadConfig() {
    setLoading(true);

    try {
      const res = await fetch(
        "/api/admin/settings/auth"
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      setConfig(data.config);
    } finally {
      setLoading(false);
    }
  }

  async function updateSetting(
    key,
    value
  ) {
    setSaving(true);

    try {
      const csrf =
        getCookie("csrf_token");

      const res = await fetch(
        "/api/admin/settings/auth",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
            "x-csrf-token":
              csrf || "",
          },
          body: JSON.stringify({
            key,
            value,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      await loadConfig();
    } catch (err) {
      alert(
        err.message ||
          "Gagal update setting"
      );
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadConfig();
  }, []);

  if (loading) {
    return (
      <div style={styles.card}>
        Memuat settings...
      </div>
    );
  }

  return (
    <div style={styles.card}>
      <h2 style={styles.title}>
        Settings Auth
      </h2>

      <SettingRow
        title="WebAuth Passkey"
        description="Jika aktif, login wajib verifikasi passkey/fingerprint setelah password."
        checked={
          config.webAuthEnabled
        }
        disabled={saving}
        onChange={(value) =>
          updateSetting(
            "WEB_AUTH_ENABLED",
            value
          )
        }
      />

      <SettingRow
        title="PIN Login"
        description="Jika aktif, login wajib memasukkan PIN setelah password. PIN diminta setelah password. Jika WebAuth juga aktif, passkey tetap diminta setelah PIN."
        checked={config.pinEnabled}
        disabled={saving}
        onChange={(value) =>
          updateSetting(
            "PIN_ENABLED",
            value
          )
        }
      />
    </div>
  );
}

function SettingRow({
  title,
  description,
  checked,
  disabled,
  onChange,
}) {
  return (
    <div style={styles.row}>
      <div>
        <h3 style={styles.rowTitle}>
          {title}
        </h3>

        <p style={styles.desc}>
          {description}
        </p>
      </div>

      <label style={styles.switch}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) =>
            onChange(
              e.target.checked
            )
          }
          style={{
            display: "none",
          }}
        />

        <span
          style={{
            ...styles.slider,
            background: checked
              ? "#4f46e5"
              : "#cbd5e1",
          }}
        >
          <span
            style={{
              ...styles.knob,
              transform: checked
                ? "translateX(22px)"
                : "translateX(0)",
            }}
          />
        </span>
      </label>
    </div>
  );
}

const styles = {
  card: {
    background: "var(--admin-card)",
    color: "var(--admin-text)",
    borderRadius: 18,
    padding: 20,
    boxShadow:
      "0 10px 30px rgba(0,0,0,.18)",
    border: "1px solid var(--admin-border)",
  },

  title: {
    margin: "0 0 18px",
    fontSize: 20,
    color: "var(--admin-text)",
  },

  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    padding: "16px 0",
    borderTop:
      "1px solid var(--admin-border)",
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
    boxShadow:
      "0 2px 6px rgba(0,0,0,.25)",
  },
};
