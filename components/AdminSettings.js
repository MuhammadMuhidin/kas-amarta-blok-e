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
    id: "ios",
    label: "iOS",
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
  }

  useEffect(() => {
    loadConfig();
    loadAppConfig();

    const savedTheme = localStorage.getItem("admin-theme") || "default";

    setTheme(savedTheme);
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
      <div style={styles.themeSection}>
        <div style={styles.themeHeader}>
          <div>
            <div style={styles.themeTitle}>Appearance Theme</div>
            <div style={styles.themeDesc}>
              Customize admin dashboard visual style.
            </div>
          </div>
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
    </div>
  );
}

const styles = {
  card: {
    display: "grid",
    gap: 20,
  },

  themeSection: {
    background: "var(--admin-card)",
    border: "1px solid var(--admin-border)",
    borderRadius: 18,
    padding: 18,
  },

  themeHeader: {
    marginBottom: 16,
  },

  themeTitle: {
    fontSize: 18,
    fontWeight: 800,
    marginBottom: 6,
  },

  themeDesc: {
    fontSize: 13,
    color: "var(--admin-muted)",
    lineHeight: 1.6,
  },

  themeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))",
    gap: 12,
  },

  themeCard: {
    border: "1px solid var(--admin-border)",
    borderRadius: 16,
    padding: 14,
    background: "var(--admin-row)",
    color: "var(--admin-text)",
    cursor: "pointer",
    textAlign: "left",
    transition: "0.15s ease",
  },

  themeCardActive: {
    border: "1px solid var(--admin-primary)",
    boxShadow: "0 0 0 2px var(--admin-primary)",
  },

  paletteRow: {
    display: "flex",
    gap: 8,
    marginBottom: 14,
  },

  paletteDot: {
    width: 18,
    height: 18,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.15)",
  },

  themeLabel: {
    fontSize: 14,
    fontWeight: 700,
  },
};