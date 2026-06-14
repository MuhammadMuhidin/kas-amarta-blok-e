"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

const PUBLIC_PATHS = new Set(["/", "/kas", "/pengajuan"]);

const PUBLIC_BACKGROUNDS = {
  default: "#f8fafc",
  ledger: "#fdf6e3",
  midnight: "#020617",
  emerald: "#ecfdf5",
  amoled: "#000000",
  hacker: "#020b02",
};

const ADMIN_BACKGROUNDS = {
  default: "#f1f5f9",
  ledger: "#fdf6e3",
  midnight: "#020617",
  emerald: "#ecfdf5",
  amoled: "#000000",
  hacker: "#020b02",
};

const DARK_THEMES = new Set(["midnight", "amoled", "hacker"]);

function normalizeTheme(value) {
  return value === "ios" ? "ledger" : value;
}

function getStoredTheme(key, backgrounds) {
  const saved = normalizeTheme(localStorage.getItem(key) || "default");
  return backgrounds[saved] ? saved : "default";
}

function resolveAppearance(pathname) {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const theme = getStoredTheme("admin-theme", ADMIN_BACKGROUNDS);
    return {
      background: ADMIN_BACKGROUNDS[theme],
      colorScheme: DARK_THEMES.has(theme) ? "dark" : "light",
      adminTheme: theme,
    };
  }

  if (PUBLIC_PATHS.has(pathname)) {
    const theme = getStoredTheme("public-theme", PUBLIC_BACKGROUNDS);
    return {
      background: PUBLIC_BACKGROUNDS[theme],
      colorScheme: DARK_THEMES.has(theme) ? "dark" : "light",
      publicTheme: theme,
    };
  }

  if (pathname === "/login") {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return {
      background: dark ? "#020617" : "#f8fafc",
      colorScheme: dark ? "dark" : "light",
    };
  }

  return { background: "#f8fafc", colorScheme: "light" };
}

function updateThemeColor(background) {
  let meta = document.querySelector('meta[name="theme-color"]');

  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }

  meta.setAttribute("content", background);
}

function applyDocumentAppearance(pathname, { syncThemeDataset = false } = {}) {
  const appearance = resolveAppearance(pathname);
  const html = document.documentElement;
  const body = document.body;

  html.style.setProperty("--route-bg", appearance.background);
  html.style.setProperty("background", appearance.background, "important");
  html.style.setProperty("background-color", appearance.background, "important");
  html.style.setProperty("color-scheme", appearance.colorScheme);

  body.style.setProperty("background", appearance.background, "important");
  body.style.setProperty("background-color", appearance.background, "important");

  if (syncThemeDataset) {
    if (appearance.adminTheme) {
      if (html.dataset.adminTheme !== appearance.adminTheme) {
        html.dataset.adminTheme = appearance.adminTheme;
      }
    } else {
      delete html.dataset.adminTheme;
    }

    if (appearance.publicTheme) {
      if (html.dataset.publicTheme !== appearance.publicTheme) {
        html.dataset.publicTheme = appearance.publicTheme;
      }
    } else {
      delete html.dataset.publicTheme;
    }
  }

  updateThemeColor(appearance.background);
}

export default function RouteDocumentTheme() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    const html = document.documentElement;

    applyDocumentAppearance(pathname, { syncThemeDataset: true });

    const observer = new MutationObserver((mutations) => {
      const themeChanged = mutations.some(
        (mutation) =>
          mutation.type === "attributes" &&
          (mutation.attributeName === "data-admin-theme" ||
            mutation.attributeName === "data-public-theme"),
      );

      if (themeChanged) {
        applyDocumentAppearance(pathname);
      }
    });

    observer.observe(html, {
      attributes: true,
      attributeFilter: ["data-admin-theme", "data-public-theme"],
    });

    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
