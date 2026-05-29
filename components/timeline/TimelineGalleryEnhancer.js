"use client";

import { useEffect, useState } from "react";

function getGalleryDots() {
  return Array.from(document.querySelectorAll(".timeline-gallery-dots button"));
}

function getActiveDotIndex(dots) {
  return dots.findIndex((dot) => dot.classList.contains("active"));
}

function clickGalleryStep(step) {
  const dots = getGalleryDots();

  if (dots.length < 2) return;

  const activeIndex = getActiveDotIndex(dots);
  const currentIndex = activeIndex >= 0 ? activeIndex : 0;
  const nextIndex = (currentIndex + step + dots.length) % dots.length;

  dots[nextIndex]?.click();
}

function closeGallery() {
  document.querySelector(".timeline-gallery-close")?.click();
}

function normalizeTimelineDateLabels() {
  document.querySelectorAll(".timeline-post-author span").forEach((item) => {
    const text = item.textContent || "";

    item.textContent = text
      .replace(/^Baru saja(\s•)/, "Hari ini$1")
      .replace(/^\d+ menit lalu(\s•)/, "Hari ini$1")
      .replace(/^\d+ jam lalu(\s•)/, "Hari ini$1")
      .replace(/^7 hari lalu(\s•)/, "Seminggu lalu$1")
      .replace(/^30 hari lalu(\s•)/, "Sebulan lalu$1")
      .replace(/^365 hari lalu(\s•)/, "Setahun lalu$1");
  });
}

export default function TimelineGalleryEnhancer() {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [hasMultipleImages, setHasMultipleImages] = useState(false);

  useEffect(() => {
    function refreshState() {
      const dots = getGalleryDots();
      setGalleryOpen(Boolean(document.querySelector(".timeline-gallery-overlay")));
      setHasMultipleImages(dots.length > 1);
      normalizeTimelineDateLabels();
    }

    refreshState();

    const observer = new MutationObserver(refreshState);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function handleKeydown(event) {
      if (!document.querySelector(".timeline-gallery-overlay")) return;

      if (event.key === "Escape") {
        event.preventDefault();
        closeGallery();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        clickGalleryStep(1);
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        clickGalleryStep(-1);
      }
    }

    window.addEventListener("keydown", handleKeydown);

    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  if (!galleryOpen || !hasMultipleImages) return null;

  return (
    <>
      <button
        type="button"
        className="timeline-gallery-bridge-arrow prev"
        onClick={() => clickGalleryStep(-1)}
        aria-label="Foto sebelumnya"
      >
        ‹
      </button>
      <button
        type="button"
        className="timeline-gallery-bridge-arrow next"
        onClick={() => clickGalleryStep(1)}
        aria-label="Foto berikutnya"
      >
        ›
      </button>
    </>
  );
}
