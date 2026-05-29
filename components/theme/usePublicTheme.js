"use client";

import { useEffect, useState } from "react";

export const PUBLIC_THEME_STORAGE_KEY = "amarta_public_theme";
export const PUBLIC_THEME_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "ledger", label: "Ledger" },
  { value: "midnight", label: "Midnight" },
  { value: "emerald", label: "Emerald" },
  { value: "amoled", label: "AMOLED" },
  { value: "hacker", label: "Hacker" },
];

function isValidTheme(value) {
  return PUBLIC_THEME_OPTIONS.some((option) => option.value === value);
}

export function applyPublicTheme(theme) {
  if (typeof document === "undefined") return;

  const nextTheme = isValidTheme(theme) ? theme : "default";
  document.documentElement.dataset.theme = nextTheme;
  document.documentElement.style.colorScheme = ["midnight", "amoled", "hacker"].includes(nextTheme)
    ? "dark"
    : "light";
}

export function getStoredPublicTheme() {
  if (typeof window === "undefined") return "default";

  const savedTheme = window.localStorage.getItem(PUBLIC_THEME_STORAGE_KEY);
  return isValidTheme(savedTheme) ? savedTheme : "default";
}

export default function usePublicTheme() {
  const [theme, setTheme] = useState("default");

  useEffect(() => {
    const storedTheme = getStoredPublicTheme();
    setTheme(storedTheme);
    applyPublicTheme(storedTheme);
  }, []);

  function updateTheme(nextTheme) {
    const safeTheme = isValidTheme(nextTheme) ? nextTheme : "default";

    setTheme(safeTheme);
    window.localStorage.setItem(PUBLIC_THEME_STORAGE_KEY, safeTheme);
    applyPublicTheme(safeTheme);
  }

  return {
    theme,
    setTheme: updateTheme,
    options: PUBLIC_THEME_OPTIONS,
  };
}
