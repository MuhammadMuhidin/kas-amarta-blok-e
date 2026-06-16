"use client";

import { useEffect } from "react";

const FORM_SELECTOR = ".request-form";
const BUTTON_SELECTOR = ".request-primary-btn[type='submit']";
const DEFAULT_LABEL = "Kirim Pengajuan";

function labelForElapsed(elapsed) {
  if (elapsed >= 8000) return "Hampir Selesai...";
  if (elapsed >= 4000) return "Masih Diproses...";
  return "Memproses...";
}

export default function PengajuanSubmitProgress() {
  useEffect(() => {
    let intervalId = null;
    let restoreTimerId = null;

    function clearActiveTimers() {
      if (intervalId) window.clearInterval(intervalId);
      if (restoreTimerId) window.clearTimeout(restoreTimerId);
      intervalId = null;
      restoreTimerId = null;
    }

    function setButtonLabel(button, label) {
      if (!button?.isConnected || button.textContent === label) return;
      button.textContent = label;
    }

    function finish(button, label) {
      if (intervalId) window.clearInterval(intervalId);
      intervalId = null;
      setButtonLabel(button, label);
      restoreTimerId = window.setTimeout(() => {
        setButtonLabel(button, DEFAULT_LABEL);
        restoreTimerId = null;
      }, 1400);
    }

    function handleSubmit(event) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !form.matches(FORM_SELECTOR)) return;

      const initialButton = form.querySelector(BUTTON_SELECTOR);
      if (!initialButton) return;

      clearActiveTimers();

      const startedAt = Date.now();
      const previousSuccessCard = document.querySelector(".request-success-card");

      const tick = () => {
        const button = form.querySelector(BUTTON_SELECTOR);
        if (!button) {
          clearActiveTimers();
          return;
        }

        const elapsed = Date.now() - startedAt;
        const currentSuccessCard = document.querySelector(".request-success-card");
        const hasNewSuccess = Boolean(currentSuccessCard && currentSuccessCard !== previousSuccessCard);

        if (hasNewSuccess) {
          finish(button, "Pengajuan Terkirim");
          return;
        }

        if (elapsed >= 350 && !button.disabled) {
          finish(button, "Coba Lagi");
          return;
        }

        setButtonLabel(button, labelForElapsed(elapsed));
      };

      window.setTimeout(tick, 0);
      intervalId = window.setInterval(tick, 120);
    }

    document.addEventListener("submit", handleSubmit, true);

    return () => {
      document.removeEventListener("submit", handleSubmit, true);
      clearActiveTimers();
    };
  }, []);

  return null;
}
