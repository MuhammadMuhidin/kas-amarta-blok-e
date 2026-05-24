"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const themes = [
  {
    id: "default",
    label: "Default",
    colors: ["#f8fafc", "#2563eb", "#ffffff"],
    vars: {
      "--bg": "#f8fafc",
      "--text": "#0f172a",
      "--muted": "#64748b",
      "--surface": "#ffffff",
      "--surface-soft": "#f1f5f9",
      "--border": "#e2e8f0",
      "--primary": "#2563eb",
      "--success": "#16a34a",
      "--danger": "#dc2626",
      "--btn-download-border": "#000000",
      "--btn-primary": "#ffffff",
      "--btn-text": "#000000",
      "--tab-active-text": "#ffffff",
      "--shadow": "0 10px 24px rgba(15,23,42,.07)",
      "--shadow-soft": "0 3px 10px rgba(15,23,42,.05)",
    },
  },
  {
    id: "ios",
    label: "iOS",
    colors: ["#f2f2f7", "#007aff", "#ffffff"],
    vars: {
      "--bg": "#f2f2f7",
      "--text": "#111827",
      "--muted": "#6b7280",
      "--surface": "rgba(255,255,255,.86)",
      "--surface-soft": "rgba(255,255,255,.58)",
      "--border": "rgba(148,163,184,.35)",
      "--primary": "#007aff",
      "--success": "#34c759",
      "--danger": "#ff3b30",
      "--btn-download-border": "#007aff",
      "--btn-primary": "#ffffff",
      "--btn-text": "#007aff",
      "--tab-active-text": "#ffffff",
      "--shadow": "0 18px 38px rgba(0,0,0,.12)",
      "--shadow-soft": "0 8px 24px rgba(0,0,0,.08)",
    },
  },
  {
    id: "midnight",
    label: "Midnight",
    colors: ["#020617", "#60a5fa", "#111827"],
    vars: {
      "--bg": "#020617",
      "--text": "#e5e7eb",
      "--muted": "#94a3b8",
      "--surface": "#0f172a",
      "--surface-soft": "#111827",
      "--border": "#1e293b",
      "--primary": "#60a5fa",
      "--success": "#4ade80",
      "--danger": "#f87171",
      "--btn-download-border": "#ffffff",
      "--btn-primary": "#000000",
      "--btn-text": "#ffffff",
      "--tab-active-text": "#000000",
      "--shadow": "0 14px 32px rgba(0,0,0,.32)",
      "--shadow-soft": "0 6px 16px rgba(0,0,0,.22)",
    },
  },
];

function applyTheme(themeId) {
  const selected = themes.find((item) => item.id === themeId) || themes[0];

  Object.entries(selected.vars).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });

  document.documentElement.dataset.publicTheme = selected.id;
}

export default function PublicThemePicker() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState("default");

  const isPublicHome = pathname === "/";

  useEffect(() => {
    if (!isPublicHome) return;

    const saved = localStorage.getItem("public-theme") || "default";

    setTheme(saved);
    applyTheme(saved);
  }, [isPublicHome]);

  function chooseTheme(nextTheme) {
    setTheme(nextTheme);
    localStorage.setItem("public-theme", nextTheme);
    applyTheme(nextTheme);
  }

  if (!isPublicHome) return null;

  return (
    <>
      <button
        type="button"
        className="public-theme-button"
        onClick={() => setOpen(true)}
        aria-label="Pilih tema"
      >
        T
      </button>

      {open && (
        <div className="public-theme-overlay" onClick={() => setOpen(false)}>
          <div className="public-theme-modal" onClick={(e) => e.stopPropagation()}>
            <div className="public-theme-header">
              <div>
                <div className="public-theme-kicker">Appearance</div>
                <h2>Theme</h2>
              </div>

              <button
                type="button"
                className="public-theme-close"
                onClick={() => setOpen(false)}
              >
                x
              </button>
            </div>

            <p className="public-theme-desc">
              Tema halaman publik terpisah dari tema admin.
            </p>

            <div className="public-theme-grid">
              {themes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`public-theme-card ${theme === item.id ? "active" : ""}`}
                  onClick={() => chooseTheme(item.id)}
                >
                  <span className="public-theme-palette">
                    {item.colors.map((color) => (
                      <span
                        key={color}
                        className="public-theme-dot"
                        style={{ background: color }}
                      />
                    ))}
                  </span>

                  <span className="public-theme-label">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
