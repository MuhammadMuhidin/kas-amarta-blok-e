"use client";

import { useEffect, useState } from "react";
import {
  Viewer,
  Worker,
  SpecialZoomLevel,
} from "@react-pdf-viewer/core";

import "@react-pdf-viewer/core/lib/styles/index.css";

export default function Page() {
  const [showButton, setShowButton] = useState(true);

  const handleDownload = () => {
    window.location.href = "/api/report/pdf?download=1";
  };

  useEffect(() => {
    let timeout;

    const handleScroll = () => {
      // langsung hide saat scroll
      setShowButton(false);

      // reset timer setiap scroll
      clearTimeout(timeout);

      // muncul lagi kalau scroll berhenti
      timeout = setTimeout(() => {
        setShowButton(true);
      }, 200);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        background: "#e5e7eb",
        overflow: "hidden",
      }}
    >
      <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
        <Viewer
          fileUrl="/api/report/pdf"
          defaultScale={SpecialZoomLevel.PageFit}
        />
      </Worker>

      <button
        onClick={handleDownload}
        style={{
          position: "fixed",
          left: "50%",
          bottom: "5%",

          transform: `translateX(-50%) ${
            showButton
              ? "translateY(0px) scale(1)"
              : "translateY(24px) scale(0.92)"
          }`,

          opacity: showButton ? 1 : 0,
          filter: showButton ? "blur(0px)" : "blur(2px)",

          pointerEvents: showButton ? "auto" : "none",

          transition:
            "transform 350ms cubic-bezier(0.16, 1, 0.3, 1), opacity 220ms ease, filter 220ms ease",

          border: "none",
          borderRadius: "999px",
          padding: "14px 18px",
          background: "#2563eb",
          color: "#fff",
          fontSize: 15,
          fontWeight: 600,
          cursor: "pointer",
          boxShadow: "0 10px 28px rgba(0,0,0,0.22)",
          zIndex: 9999,
        }}
      >
        Download PDF
      </button>
    </div>
  );
}
