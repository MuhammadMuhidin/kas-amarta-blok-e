"use client";

import { useEffect, useState } from "react";

export default function AdminMobileDrawer() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      document.documentElement.dataset.adminDrawer = "open";
    } else {
      delete document.documentElement.dataset.adminDrawer;
    }

    return () => {
      delete document.documentElement.dataset.adminDrawer;
    };
  }, [open]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;

    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [open]);

  useEffect(() => {
    function handleClick(event) {
      const target = event.target;

      if (
        target?.closest?.(".admin-tab") ||
        target?.closest?.(".admin-home-btn")
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <>
      <button
        type="button"
        className="admin-mobile-menu-btn"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        <span>{open ? "×" : "☰"}</span>
        <strong>Menu</strong>
      </button>

      {open && (
        <button
          type="button"
          className="admin-mobile-drawer-backdrop"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
