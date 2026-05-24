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
    colors: ["#fdf6e3", "#2f6f4e", "#fffaf0"],
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

  const savedTheme = localStorage.getItem("admin-theme") || "default";

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
