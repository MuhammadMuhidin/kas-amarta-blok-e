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

  const handleDownload = () => {
    if (downloading) return;

    setDownloading(true);

    window.location.href = "/api/report/pdf?download=1";

    // fallback reset (karena tidak bisa await navigation)
    setTimeout(() => {
      setDownloading(false);
    }, 2000);
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
          padding: "14px 20px",

          background: downloading ? "#1d4ed8" : "#2563eb",
          color: "#fff",
          fontSize: 15,
          fontWeight: 600,

          cursor: downloading ? "not-allowed" : "pointer",
          //opacity: downloading ? 0.8 : 1,
          zIndex: 9999,

          display: "flex",
          alignItems: "center",
          gap: "10px",

          boxShadow:
            "0 10px 25px rgba(0,0,0,0.25), 0 6px 12px rgba(37,99,235,0.25)",
        }}
      >
        {downloading && (
          <span
            style={{
              width: 14,
              height: 14,
              border: "2px solid rgba(255,255,255,0.4)",
              borderTop: "2px solid #fff",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
        )}

        {downloading ? "Downloading..." : "Download PDF"}

        <style jsx>{`
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </button>
    </div>
  );
}
