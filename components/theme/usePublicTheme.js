"use client";

import { useEffect, useState } from "react";

export const PUBLIC_THEME_STORAGE_KEY = "amarta_public_theme";
export const PUBLIC_THEME_OPTIONS = [
  { value: "system", label: "Sistem" },
  { value: "light", label: "Terang" },
  { value: "dark", label: "Gelap" },
];

function isValidTheme(value) {
  return PUBLIC_THEME_OPTIONS.some((option) => option.value === value);
}

function applyTheme(theme) {
  if (typeof document === "undefined") return;

  const nextTheme = isValidTheme(theme) ? theme : "system";
  document.documentElement.dataset.theme = nextTheme;
  document.documentElement.style.colorScheme = nextTheme === "system" ? "light dark" : nextTheme;
}

export function getStoredPublicTheme() {
  if (typeof window === "undefined") return "system";

  const savedTheme = window.localStorage.getItem(PUBLIC_THEME_STORAGE_KEY);
  return isValidTheme(savedTheme) ? savedTheme : "system";
}

export default function usePublicTheme() {
  const [theme, setTheme] = useState("system");

  useEffect(() => {
    const storedTheme = getStoredPublicTheme();
    setTheme(storedTheme);
    applyTheme(storedTheme);
  }, []);

  function updateTheme(nextTheme) {
    const safeTheme = isValidTheme(nextTheme) ? nextTheme : "system";

    setTheme(safeTheme);
    window.localStorage.setItem(PUBLIC_THEME_STORAGE_KEY, safeTheme);
    applyTheme(safeTheme);
  }

  return {
    theme,
    setTheme: updateTheme,
    options: PUBLIC_THEME_OPTIONS,
  };
}
