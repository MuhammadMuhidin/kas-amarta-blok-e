"use client";

import { useLayoutEffect } from "react";

const storageKey = "admin-theme";
const allowedThemes = new Set([
  "default",
  "ledger",
  "midnight",
  "emerald",
  "amoled",
  "hacker",
]);

function normalizeTheme(theme) {
  return theme === "ios" ? "ledger" : theme;
}

export default function AdminThemeBoot() {
  useLayoutEffect(() => {
    const savedTheme = normalizeTheme(
      localStorage.getItem(storageKey) || "default",
    );

    const theme = allowedThemes.has(savedTheme) ? savedTheme : "default";

    if (localStorage.getItem(storageKey) !== theme) {
      localStorage.setItem(storageKey, theme);
    }

    document.documentElement.dataset.adminTheme = theme;
  }, []);

  return null;
}

export { storageKey, allowedThemes };
