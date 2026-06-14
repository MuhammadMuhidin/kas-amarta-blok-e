"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const APPROVAL_REQUESTS_API = "/api/approval-requests";

function AvailabilityPanel({ state, onRetry }) {
  if (state === "empty") {
    return (
      <div className="request-availability-state is-empty" role="status">
        <span className="request-availability-icon" aria-hidden="true">i</span>
        <div>
          <span className="request-kicker">Pengajuan Baru</span>
          <h2>Fitur Pengajuan Sedang Dikembangkan</h2>
          <p>
            Saat ini belum ada jenis pengajuan yang tersedia. Fitur akan tampil
            setelah diaktifkan oleh admin.
          </p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="request-availability-state is-error" role="alert">
        <span className="request-availability-icon" aria-hidden="true">!</span>
        <div>
          <span className="request-kicker">Pengajuan Baru</span>
          <h2>Layanan Pengajuan Belum Dapat Dimuat</h2>
          <p>Terjadi kendala saat membaca jenis pengajuan. Silakan coba kembali.</p>
          <button type="button" className="request-secondary-btn" onClick={onRetry}>
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default function PengajuanMasterLoadingGuard() {
  const [state, setState] = useState("loading");
  const [target, setTarget] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const findTarget = () => {
      const nextTarget = document.querySelector(".request-master-card");
      if (nextTarget) setTarget(nextTarget);
      return Boolean(nextTarget);
    };

    if (findTarget()) return undefined;

    const observer = new MutationObserver(() => {
      if (findTarget()) observer.disconnect();
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const controller = new AbortController();

    setState("loading");
    root.setAttribute("data-pengajuan-masters-state", "loading");

    async function checkAvailability() {
      try {
        const response = await fetch(APPROVAL_REQUESTS_API, {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Gagal membaca master pengajuan");

        const nextState = Array.isArray(result.masters) && result.masters.length
          ? "ready"
          : "empty";

        setState(nextState);
        root.setAttribute("data-pengajuan-masters-state", nextState);
      } catch (error) {
        if (error.name === "AbortError") return;
        setState("error");
        root.setAttribute("data-pengajuan-masters-state", "error");
      }
    }

    checkAvailability();

    return () => {
      controller.abort();
      root.removeAttribute("data-pengajuan-masters-state");
    };
  }, [reloadKey]);

  if (!target || state === "loading" || state === "ready") return null;

  return createPortal(
    <AvailabilityPanel state={state} onRetry={() => setReloadKey((value) => value + 1)} />,
    target,
  );
}
