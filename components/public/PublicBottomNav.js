"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ENABLED_PATHS = new Set(["/", "/pengajuan"]);

const bottomNavCss = `
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

  body:has(.public-bottom-nav) .timeline-page > .timeline-bottom-nav {
    display: none !important;
  }

  .public-bottom-nav {
    position: fixed;
    left: 50%;
    bottom: max(12px, env(safe-area-inset-bottom, 0px));
    z-index: 9000;
    width: min(430px, calc(100vw - 24px));
    height: 70px;
    padding: 6px;
    border: 1px solid color-mix(in srgb, var(--primary) 16%, var(--border));
    border-radius: 999px;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 4px;
    background: color-mix(in srgb, var(--surface) 88%, transparent);
    box-shadow: 0 22px 54px rgba(15, 23, 42, 0.16), var(--shadow-soft);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    transform: translateX(-50%);
    box-sizing: border-box;
    overflow: hidden;
  }

  .public-bottom-nav-item {
    min-width: 0;
    width: 100%;
    height: 100%;
    padding: 5px 4px;
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
    font-family: Inter, Arial, sans-serif;
    -webkit-tap-highlight-color: transparent;
  }

  .public-bottom-nav-item span {
    min-width: 22px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--text);
    font-size: 18px;
    font-weight: 950;
    line-height: 1;
  }

  .public-bottom-nav-item strong {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
    font-weight: 850;
    line-height: 1.1;
  }

  .public-bottom-nav-item:hover,
  .public-bottom-nav-item:focus-visible {
    background: color-mix(in srgb, var(--primary) 11%, transparent);
    color: var(--text);
    outline: none;
  }

  .public-bottom-nav-item.is-active {
    background: color-mix(in srgb, var(--primary) 13%, var(--surface));
    color: var(--text);
    font-weight: 900;
  }

  .public-bottom-nav-item:active {
    transform: scale(0.96);
  }

  @media (max-width: 380px) {
    .public-bottom-nav {
      width: calc(100vw - 18px);
      height: 66px;
      padding: 5px;
      gap: 3px;
    }

    .public-bottom-nav-item {
      padding-inline: 2px;
    }

    .public-bottom-nav-item span {
      font-size: 17px;
    }

    .public-bottom-nav-item strong {
      font-size: 10px;
    }
  }
`;

export default function PublicBottomNav({ global = false } = {}) {
  const pathname = usePathname();

  if (!global || !ENABLED_PATHS.has(pathname)) return null;

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openThemePicker() {
    document.querySelector(".public-theme-button")?.click();
  }

  function itemClass(path) {
    return `public-bottom-nav-item${pathname === path ? " is-active" : ""}`;
  }

  const homeItem = pathname === "/" ? (
    <button type="button" className={itemClass("/")} onClick={scrollToTop}>
      <span aria-hidden="true">🏠</span>
      <strong>Beranda</strong>
    </button>
  ) : (
    <Link className={itemClass("/")} href="/">
      <span aria-hidden="true">🏠</span>
      <strong>Beranda</strong>
    </Link>
  );

  return (
    <>
      <style>{bottomNavCss}</style>
      <nav className="public-bottom-nav" aria-label="Navigasi utama">
        {homeItem}
        <Link className={itemClass("/kas")} href="/kas">
          <span aria-hidden="true">Rp</span>
          <strong>Kas Warga</strong>
        </Link>
        <Link className={itemClass("/pengajuan")} href="/pengajuan">
          <span aria-hidden="true">✅</span>
          <strong>Pengajuan</strong>
        </Link>
        <button type="button" className="public-bottom-nav-item" onClick={openThemePicker}>
          <span aria-hidden="true">🎨</span>
          <strong>Tema</strong>
        </button>
      </nav>
    </>
  );
}
