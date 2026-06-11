"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

  .public-bottom-nav {
    position: fixed;
    left: 50%;
    bottom: max(12px, env(safe-area-inset-bottom, 0px));
    z-index: 9000;
    width: min(430px, calc(100vw - 28px));
    min-height: 64px;
    padding: 8px 10px;
    border: 1px solid color-mix(in srgb, var(--primary) 16%, var(--border));
    border-radius: 999px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
    background: color-mix(in srgb, var(--surface) 86%, transparent);
    box-shadow: 0 22px 54px rgba(15, 23, 42, 0.16), var(--shadow-soft);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    transform: translateX(-50%);
  }

  .public-bottom-nav-item {
    min-width: 0;
    min-height: 48px;
    padding: 5px 8px;
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
    font: inherit;
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
    font-size: 11px;
    font-weight: 950;
    line-height: 1.1;
  }

  .public-bottom-nav-item:hover,
  .public-bottom-nav-item:focus-visible {
    background: color-mix(in srgb, var(--primary) 11%, transparent);
    color: var(--text);
    outline: none;
  }

  .public-bottom-nav-item:active {
    transform: scale(0.96);
  }
`;

export default function PublicBottomNav() {
  const pathname = usePathname();

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openThemePicker() {
    document.querySelector(".public-theme-button")?.click();
  }

  const homeItem = pathname === "/" ? (
    <button type="button" className="public-bottom-nav-item timeline-bottom-nav-item" onClick={scrollToTop}>
      <span aria-hidden="true">🏠</span>
      <strong>Beranda</strong>
    </button>
  ) : (
    <Link className="public-bottom-nav-item timeline-bottom-nav-item" href="/">
      <span aria-hidden="true">🏠</span>
      <strong>Beranda</strong>
    </Link>
  );

  return (
    <>
      <style>{bottomNavCss}</style>
      <nav className="public-bottom-nav timeline-bottom-nav" aria-label="Navigasi utama">
        {homeItem}
        <Link className="public-bottom-nav-item timeline-bottom-nav-item" href="/kas">
          <span aria-hidden="true">Rp</span>
          <strong>Kas Warga</strong>
        </Link>
        <button type="button" className="public-bottom-nav-item timeline-bottom-nav-item" onClick={openThemePicker}>
          <span aria-hidden="true">🎨</span>
          <strong>Tema</strong>
        </button>
      </nav>
    </>
  );
}
