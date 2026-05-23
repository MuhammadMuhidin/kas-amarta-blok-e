"use client";

import { useEffect } from "react";

const storageKey = "admin-theme";
const allowedThemes = new Set([
  "default",
  "ios",
  "midnight",
  "emerald",
  "amoled",
  "hacker",
]);

export default function AdminThemeBoot() {
  useEffect(() => {
    const savedTheme = localStorage.getItem(storageKey) || "default";
    const theme = allowedThemes.has(savedTheme) ? savedTheme : "default";

    document.documentElement.dataset.adminTheme = theme;
  }, []);

  return null;
}

export { storageKey, allowedThemes };
