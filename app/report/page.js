"use client";

import { useState } from "react";
import {
  Viewer,
  Worker,
  SpecialZoomLevel,
} from "@react-pdf-viewer/core";

import "@react-pdf-viewer/core/lib/styles/index.css";

export default function Page() {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleDownload = () => {
    if (downloading) return;

    setDownloading(true);
    setProgress(0);

    // fake progress engine
    let p = 0;

    const interval = setInterval(() => {
      p += Math.random() * 12; // natural slow-fast feel

      if (p >= 100) {
        p = 100;
        clearInterval(interval);

        window.location.href = "/api/report/pdf?download=1";

        // reset UI after short delay
        setTimeout(() => {
          setDownloading(false);
          setProgress(0);
        }, 1200);
      }

      setProgress(p);
    }, 120);
  };

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

      {/* BUTTON */}
      <button
        onClick={handleDownload}
        disabled={downloading}
        style={{
          position: "fixed",
          left: "50%",
          bottom: "24px",
          transform: "translateX(-50%)",

          border: "none",
          borderRadius: "999px",
          padding: "14px 18px",
          minWidth: "190px",

          background: "#2563eb",
          color: "#fff",
          fontSize: 15,
          fontWeight: 600,

          cursor: downloading ? "not-allowed" : "pointer",
          opacity: downloading ? 0.95 : 1,

          boxShadow:
            "0 10px 25px rgba(0,0,0,0.25), 0 6px 12px rgba(37,99,235,0.25)",

          position: "fixed",
          zIndex: 9999,

          overflow: "hidden",
        }}
      >
        {/* TEXT */}
        <div style={{ position: "relative", zIndex: 2 }}>
          {downloading
            ? `Downloading ${Math.floor(progress)}%`
            : "Download PDF"}
        </div>

        {/* PROGRESS BAR BACKGROUND */}
        {downloading && (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              height: "100%",
              width: `${progress}%`,
              background: "rgba(255,255,255,0.18)",
              transition: "width 120ms linear",
            }}
          />
        )}
      </button>
    </div>
  );
}
