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
    let activeForm = null;
    let activeButton = null;

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

    function lockButton(button) {
      if (!button?.isConnected) return;
      button.setAttribute("aria-busy", "true");
      button.style.pointerEvents = "none";
      button.style.cursor = "not-allowed";
    }

    function unlockSubmit(form, button) {
      if (form?.isConnected) delete form.dataset.submitLocked;
      if (!button?.isConnected) return;
      button.removeAttribute("aria-busy");
      button.style.pointerEvents = "";
      button.style.cursor = "";
    }

    function finish(form, button, label, { keepLocked = false } = {}) {
      if (intervalId) window.clearInterval(intervalId);
      intervalId = null;
      setButtonLabel(button, label);

      if (keepLocked) {
        button.disabled = true;
        lockButton(button);
      } else {
        unlockSubmit(form, button);
      }

      restoreTimerId = window.setTimeout(() => {
        if (keepLocked && button?.isConnected) button.disabled = false;
        unlockSubmit(form, button);
        setButtonLabel(button, DEFAULT_LABEL);
        restoreTimerId = null;
        activeForm = null;
        activeButton = null;
      }, 1400);
    }

    function handleSubmit(event) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !form.matches(FORM_SELECTOR)) return;

      const initialButton = form.querySelector(BUTTON_SELECTOR);
      if (!initialButton) return;

      if (form.dataset.submitLocked === "true") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        return;
      }

      clearActiveTimers();
      form.dataset.submitLocked = "true";
      activeForm = form;
      activeButton = initialButton;

      const startedAt = Date.now();
      const previousSuccessCard = document.querySelector(".request-success-card");

      const tick = () => {
        const button = form.querySelector(BUTTON_SELECTOR);
        if (!button) {
          unlockSubmit(form, activeButton);
          clearActiveTimers();
          return;
        }

        activeButton = button;
        const elapsed = Date.now() - startedAt;
        const currentSuccessCard = document.querySelector(".request-success-card");
        const hasNewSuccess = Boolean(currentSuccessCard && currentSuccessCard !== previousSuccessCard);

        if (hasNewSuccess) {
          finish(form, button, "Pengajuan Terkirim", { keepLocked: true });
          return;
        }

        if (elapsed >= 350 && !button.disabled) {
          finish(form, button, "Coba Lagi");
          return;
        }

        lockButton(button);
        setButtonLabel(button, labelForElapsed(elapsed));
      };

      window.setTimeout(tick, 0);
      intervalId = window.setInterval(tick, 120);
    }

    document.addEventListener("submit", handleSubmit, true);

    return () => {
      document.removeEventListener("submit", handleSubmit, true);
      unlockSubmit(activeForm, activeButton);
      clearActiveTimers();
    };
  }, []);

  return null;
}
