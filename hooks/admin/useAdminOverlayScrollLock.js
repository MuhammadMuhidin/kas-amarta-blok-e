"use client";

import { useEffect } from "react";

const SCROLL_LOCK_SELECTORS = [
  ".modal-overlay",
  ".admin-sidebar-open",
  ".admin-sidebar.is-open",
  ".admin-sidebar.open",
  ".admin-menu-open",
  ".admin-drawer-open",
  ".admin-drawer.is-open",
  ".admin-drawer.open",
  "[data-admin-sidebar-open='true']",
  "[data-scroll-lock='true']",
  "[aria-modal='true']",
];

function hasScrollLockTarget() {
  return SCROLL_LOCK_SELECTORS.some((selector) => document.querySelector(selector));
}

function lockBodyScroll() {
  const scrollY = window.scrollY;
  const { body, documentElement } = document;
  const previousBodyStyle = {
    overflow: body.style.overflow,
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
  };
  const previousHtmlOverflow = documentElement.style.overflow;

  body.style.overflow = "hidden";
  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  documentElement.style.overflow = "hidden";

  return () => {
    body.style.overflow = previousBodyStyle.overflow;
    body.style.position = previousBodyStyle.position;
    body.style.top = previousBodyStyle.top;
    body.style.left = previousBodyStyle.left;
    body.style.right = previousBodyStyle.right;
    body.style.width = previousBodyStyle.width;
    documentElement.style.overflow = previousHtmlOverflow;
    window.scrollTo(0, scrollY);
  };
}

export default function useAdminOverlayScrollLock() {
  useEffect(() => {
    let unlock = null;

    function syncScrollLock() {
      const shouldLock = hasScrollLockTarget();

      if (shouldLock && !unlock) {
        unlock = lockBodyScroll();
        return;
      }

      if (!shouldLock && unlock) {
        unlock();
        unlock = null;
      }
    }

    const observer = new MutationObserver(syncScrollLock);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "aria-modal", "data-admin-sidebar-open", "data-scroll-lock"],
    });

    syncScrollLock();

    return () => {
      observer.disconnect();
      if (unlock) unlock();
    };
  }, []);
}
