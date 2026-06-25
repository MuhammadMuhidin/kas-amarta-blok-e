"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import "./PublicBottomNav.css";

const ENABLED_PATHS = new Set(["/", "/kas", "/pengajuan"]);

export default function PublicBottomNav({ global = false } = {}) {
  const pathname = usePathname();
  const [popupOpen, setPopupOpen] = useState(false);
  const popupRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setPopupOpen(false);
      }
    }
    if (popupOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [popupOpen]);

  if (!global || !ENABLED_PATHS.has(pathname)) return null;

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openThemePicker() {
    document.querySelector(".public-theme-button")?.click();
    setPopupOpen(false);
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

      {/* Lainnya popup */}
      <div className="public-bottom-nav-lainnya" ref={popupRef}>
        <button
          type="button"
          className={`public-bottom-nav-item${popupOpen ? " is-active" : ""}`}
          onClick={() => setPopupOpen((v) => !v)}
          aria-expanded={popupOpen}
          aria-haspopup="true"
        >
          <span aria-hidden="true">⋯</span>
          <strong>Lainnya</strong>
        </button>

        {popupOpen && (
          <div className="public-bottom-nav-popup" role="menu">
            <Link
              className="public-bottom-nav-popup-item"
              href="/pengajuan"
              role="menuitem"
            >
              <span aria-hidden="true">✅</span>
              <strong>Pengajuan</strong>
            </Link>
            <button
              type="button"
              className="public-bottom-nav-popup-item"
              role="menuitem"
              onClick={openThemePicker}
            >
              <span aria-hidden="true">🎨</span>
              <strong>Tema</strong>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
