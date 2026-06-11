"use client";

import "./PublicThemePicker.css";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const themes = [
  {
    id: "default",
    label: "Default",
    colors: ["#f8fafc", "#2563eb", "#ffffff"],
    vars: {
      "--public-font-family": 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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
      "--shadow-soft": "0 3px 10px rgba(15,23,42,.05)"
    }
  },
  {
    id: "ledger",
    label: "Ledger",
    colors: ["#fdf6e3", "#2f6f4e", "#fffaf0"],
    vars: {
      "--public-font-family": 'Merriweather Sans, Inter, system-ui, sans-serif',
      "--bg": "#fdf6e3",
      "--text": "#2f281f",
      "--muted": "#7c6f57",
      "--surface": "#fffaf0",
      "--surface-soft": "#f6edd8",
      "--border": "#e7d7b8",
      "--primary": "#2f6f4e",
      "--success": "#2f855a",
      "--danger": "#b91c1c",
      "--btn-download-border": "#2f6f4e",
      "--btn-primary": "#fffaf0",
      "--btn-text": "#2f6f4e",
      "--tab-active-text": "#fffaf0",
      "--shadow": "0 14px 30px rgba(92,64,36,.12)",
      "--shadow-soft": "0 5px 14px rgba(92,64,36,.09)"
    }
  },
  {
    id: "midnight",
    label: "Midnight",
    colors: ["#020617", "#60a5fa", "#111827"],
    vars: {
      "--public-font-family": 'Inter, "Segoe UI", system-ui, sans-serif',
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
      "--shadow-soft": "0 6px 16px rgba(0,0,0,.22)"
    }
  },
  {
    id: "emerald",
    label: "Emerald",
    colors: ["#ecfdf5", "#10b981", "#ffffff"],
    vars: {
      "--public-font-family": 'Manrope, Inter, system-ui, sans-serif',
      "--bg": "#ecfdf5",
      "--text": "#064e3b",
      "--muted": "#047857",
      "--surface": "#ffffff",
      "--surface-soft": "#f0fdf4",
      "--border": "#a7f3d0",
      "--primary": "#10b981",
      "--success": "#059669",
      "--danger": "#dc2626",
      "--btn-download-border": "#10b981",
      "--btn-primary": "#ffffff",
      "--btn-text": "#047857",
      "--tab-active-text": "#022c22",
      "--shadow": "0 10px 24px rgba(6,78,59,.10)",
      "--shadow-soft": "0 3px 10px rgba(6,78,59,.08)"
    }
  },
  {
    id: "amoled",
    label: "AMOLED",
    colors: ["#000000", "#ffffff", "#111111"],
    vars: {
      "--public-font-family": '"SF Mono", "Roboto Mono", Consolas, monospace',
      "--bg": "#000000",
      "--text": "#f8fafc",
      "--muted": "#94a3b8",
      "--surface": "#050505",
      "--surface-soft": "#0d0d0d",
      "--border": "#171717",
      "--primary": "#ffffff",
      "--success": "#86efac",
      "--danger": "#fca5a5",
      "--btn-download-border": "#ffffff",
      "--btn-primary": "#000000",
      "--btn-text": "#ffffff",
      "--tab-active-text": "#000000",
      "--shadow": "none",
      "--shadow-soft": "none"
    }
  },
  {
    id: "hacker",
    label: "Hacker",
    colors: ["#020b02", "#22c55e", "#14532d"],
    vars: {
      "--public-font-family": 'Ubuntu Mono, "Roboto Mono", Consolas, monospace',
      "--bg": "#020b02",
      "--text": "#4ade80",
      "--muted": "#22c55e",
      "--surface": "#031303",
      "--surface-soft": "#052105",
      "--border": "#14532d",
      "--primary": "#22c55e",
      "--success": "#4ade80",
      "--danger": "#fb7185",
      "--btn-download-border": "#22c55e",
      "--btn-primary": "#031303",
      "--btn-text": "#4ade80",
      "--tab-active-text": "#021302",
      "--shadow": "0 0 28px rgba(34,197,94,.12)",
      "--shadow-soft": "0 0 14px rgba(34,197,94,.10)"
    }
  }
];

const publicThemeKeys = Object.keys(themes[0].vars);
const reloadFlag = "public-theme-hard-reload";
const publicThemePaths = new Set(["/", "/kas", "/pengajuan"]);
const bottomNavPaths = new Set(["/", "/pengajuan"]);

function normalizeTheme(themeId) {
  return themeId === "ios" ? "ledger" : themeId;
}

function clearPublicTheme() {
  publicThemeKeys.forEach((key) => {
    document.documentElement.style.removeProperty(key);
  });

  delete document.documentElement.dataset.publicTheme;
}

function forceReloadOnce(pathname) {
  const target = `${pathname}${window.location.search}${window.location.hash}`;

  if (sessionStorage.getItem(reloadFlag) === target) {
    sessionStorage.removeItem(reloadFlag);
    return;
  }

  sessionStorage.setItem(reloadFlag, target);
  window.location.replace(target);
}

function applyTheme(themeId) {
  const normalizedTheme = normalizeTheme(themeId);
  const selected = themes.find((item) => item.id === normalizedTheme) || themes[0];

  Object.entries(selected.vars).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });

  document.documentElement.dataset.publicTheme = selected.id;
}

function PublicBottomNav({ pathname, onThemeClick }) {
  if (!bottomNavPaths.has(pathname)) return null;

  return (
    <nav className="public-bottom-nav" aria-label="Navigasi publik">
      <a className={`public-bottom-nav-item ${pathname === "/" ? "active" : ""}`} href="/">
        <span aria-hidden="true">🏠</span>
        <strong>Beranda</strong>
      </a>
      <a className="public-bottom-nav-item" href="/kas">
        <span aria-hidden="true">Rp</span>
        <strong>Kas Warga</strong>
      </a>
      <a className={`public-bottom-nav-item ${pathname === "/pengajuan" ? "active" : ""}`} href="/pengajuan">
        <span aria-hidden="true">✅</span>
        <strong>Pengajuan</strong>
      </a>
      <button type="button" className="public-bottom-nav-item" onClick={onThemeClick}>
        <span aria-hidden="true">🎨</span>
        <strong>Tema</strong>
      </button>
    </nav>
  );
}

export default function PublicThemePicker() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState("default");

  const isPublicThemePath = publicThemePaths.has(pathname);

  useEffect(() => {
    if (!isPublicThemePath) {
      clearPublicTheme();
      setOpen(false);
      forceReloadOnce(pathname);
      return undefined;
    }

    sessionStorage.removeItem(reloadFlag);

    const saved = normalizeTheme(localStorage.getItem("public-theme") || "default");

    if (localStorage.getItem("public-theme") === "ios") {
      localStorage.setItem("public-theme", saved);
    }

    setTheme(saved);
    applyTheme(saved);

    return clearPublicTheme;
  }, [isPublicThemePath, pathname]);

  function chooseTheme(nextTheme) {
    const normalizedTheme = normalizeTheme(nextTheme);

    setTheme(normalizedTheme);
    localStorage.setItem("public-theme", normalizedTheme);
    applyTheme(normalizedTheme);
  }

  if (!isPublicThemePath) return null;

  return (
    <>
      <style jsx global>{`
        body:has(.public-bottom-nav) .timeline-bottom-nav {
          display: none !important;
        }

        body:has(.public-bottom-nav) .public-theme-button {
          width: 1px !important;
          height: 1px !important;
          min-width: 1px !important;
          min-height: 1px !important;
          padding: 0 !important;
          border: 0 !important;
          clip: rect(0 0 0 0) !important;
          clip-path: inset(50%) !important;
          overflow: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }

        .public-bottom-nav {
          position: fixed;
          left: 50%;
          bottom: max(12px, env(safe-area-inset-bottom, 0px));
          z-index: 9000;
          width: min(480px, calc(100vw - 22px));
          min-height: 64px;
          padding: 8px;
          border: 1px solid color-mix(in srgb, var(--primary) 16%, var(--border));
          border-radius: 999px;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 4px;
          background: color-mix(in srgb, var(--surface) 86%, transparent);
          box-shadow: 0 22px 54px rgba(15, 23, 42, 0.16), var(--shadow-soft);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          transform: translateX(-50%);
        }

        .public-bottom-nav-item {
          min-width: 0;
          min-height: 48px;
          padding: 5px;
          border: 0;
          border-radius: 999px;
          background: transparent;
          color: var(--muted);
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          text-decoration: none;
          cursor: pointer;
          transition: 0.18s ease;
          font-family: var(--public-font-family, Inter, system-ui, sans-serif);
        }

        .public-bottom-nav-item span {
          min-width: 24px;
          height: 24px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--text);
          font-size: 18px;
          font-weight: 950;
          line-height: 1;
        }

        .public-bottom-nav-item strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 10.5px;
          font-weight: 950;
          line-height: 1.1;
        }

        .public-bottom-nav-item.active,
        .public-bottom-nav-item:hover,
        .public-bottom-nav-item:focus-visible {
          background: color-mix(in srgb, var(--primary) 11%, transparent);
          color: var(--text);
          outline: none;
        }

        .public-bottom-nav-item:active {
          transform: scale(0.96);
        }
      `}</style>

      <button
        type="button"
        className="public-theme-button"
        onClick={() => setOpen(true)}
        aria-label="Pilih tema"
        title="Tema Tampilan"
      >
        🎨
      </button>

      <PublicBottomNav pathname={pathname} onThemeClick={() => setOpen(true)} />

      {open && (
        <div className="public-theme-overlay" onClick={() => setOpen(false)}>
          <div className="public-theme-modal" onClick={(e) => e.stopPropagation()}>
            <div className="public-theme-header">
              <div>
                <div className="public-theme-kicker">Tampilan</div>
                <h2>Tema</h2>
              </div>

              <button
                type="button"
                className="public-theme-close"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>

            <p className="public-theme-desc">
              Atur tampilan halaman.
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
