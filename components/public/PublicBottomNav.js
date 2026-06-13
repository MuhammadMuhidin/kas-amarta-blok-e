"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "./PublicBottomNav.css";

const ENABLED_PATHS = new Set(["/", "/pengajuan"]);

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
  );
}
