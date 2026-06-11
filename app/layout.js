import PublicThemePicker from "@/components/public/PublicThemePicker";

const publicThemeBootScript = `
(function () {
  try {
    var publicPaths = { "/": true, "/kas": true, "/pengajuan": true };
    var pathname = window.location.pathname;

    if (!publicPaths[pathname]) return;

    var saved = localStorage.getItem("public-theme") || "default";
    var normalized = saved === "ios" ? "ledger" : saved;
    var themes = {
      default: {
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
      },
      ledger: {
        "--public-font-family": "Merriweather Sans, Inter, system-ui, sans-serif",
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
      },
      midnight: {
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
      },
      emerald: {
        "--public-font-family": "Manrope, Inter, system-ui, sans-serif",
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
      },
      amoled: {
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
      },
      hacker: {
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
    };

    var selected = themes[normalized] || themes.default;

    Object.keys(selected).forEach(function (key) {
      document.documentElement.style.setProperty(key, selected[key]);
    });

    document.documentElement.dataset.publicTheme = themes[normalized] ? normalized : "default";
  } catch (error) {
    document.documentElement.dataset.publicTheme = "default";
  }
})();
`;

export default function RootLayout({ children }) {
  return (
    <html suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: publicThemeBootScript }} />
      </head>
      <body style={{ margin: 0 }}>
        <PublicThemePicker />
        {children}
      </body>
    </html>
  );
}
