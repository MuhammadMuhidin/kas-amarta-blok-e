"use client";

import { useEffect } from "react";

const TIMEOUT_MS = 10000;

export default function PengajuanMasterLoadingGuard() {
  useEffect(() => {
    const root = document.documentElement;
    let timeoutId;

    const hasMasterOptions = () => Boolean(document.querySelector(".request-master-card select option"));

    const finish = () => {
      window.clearTimeout(timeoutId);
      root.removeAttribute("data-pengajuan-masters-timeout");
      observer.disconnect();
    };

    const observer = new MutationObserver(() => {
      if (hasMasterOptions()) finish();
    });

    root.setAttribute("data-pengajuan-masters-timeout", "false");

    if (hasMasterOptions()) {
      finish();
      return undefined;
    }

    observer.observe(document.body, { childList: true, subtree: true });
    timeoutId = window.setTimeout(() => {
      root.setAttribute("data-pengajuan-masters-timeout", "true");
      observer.disconnect();
    }, TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
      observer.disconnect();
      root.removeAttribute("data-pengajuan-masters-timeout");
    };
  }, []);

  return null;
}
