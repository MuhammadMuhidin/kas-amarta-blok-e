"use client";

import { useEffect, useState } from "react";
import {
  Viewer,
  Worker,
  SpecialZoomLevel,
} from "@react-pdf-viewer/core";

import "@react-pdf-viewer/core/lib/styles/index.css";

export default function Page() {
  const [progress, setProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = () => {
    if (downloading) return;

    setDownloading(true);
    let p = 0;

    const interval = setInterval(() => {
      p += Math.random() * 8; // smooth & natural

      if (p >= 100) {
        p = 100;
        clearInterval(interval);

        window.location.href = "/api/report/pdf?download=1";

        setTimeout(() => {
          setDownloading(false);
          setProgress(0);
        }, 1200);
      }

      setProgress(p);
    }, 120);
  };

  // ===== PROGRESS TEXT MAPPING =====
  const getLoadingText = (p) => {
    if (p < 20) return "Menghubungi pusat server aman";
    if (p < 45) return "Memverifikasi integritas data transaksi";
    if (p < 75) return "Menghimpun seluruh catatan sistem";
    return "Menyiapkan hasil analisis laporan";
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#e5e7eb",
        overflow: "hidden",
      }}
    >
      {/* LOADING OVERLAY */}
      {progress < 100 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          {/* TEXT */}
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "#111827",
              marginBottom: 14,
              textAlign: "center",
            }}
          >
            {getLoadingText(progress)}
          </div>

          {/* PROGRESS BAR */}
          <div
            style={{
              width: 260,
              height: 6,
              background: "rgba(0,0,0,0.08)",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: "#2563eb",
                transition: "width 120ms linear",
              }}
            />
          </div>

          {/* PERCENT */}
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              opacity: 0.6,
            }}
          >
            {Math.floor(progress)}%
          </div>
        </div>
      )}

      {/* PDF */}
      {progress >= 100 && (
        <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
          <Viewer
            fileUrl="/api/report/pdf"
            defaultScale={SpecialZoomLevel.PageFit}
          />
        </Worker>
      )}

      {/* DOWNLOAD BUTTON */}
      {progress >= 100 && (
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
            minWidth: "190px",
            background: "#2563eb",
            color: "#fff",
            fontSize: 15,
            fontWeight: 600,
            cursor: downloading ? "not-allowed" : "pointer",
            opacity: downloading ? 0.9 : 1,
            boxShadow:
              "0 10px 25px rgba(0,0,0,0.25), 0 6px 12px rgba(37,99,235,0.25)",
            overflow: "hidden",
          }}
        >
          {downloading
            ? `Downloading ${Math.floor(progress)}%`
            : "Download PDF"}
        </button>
      )}
    </div>
  );
}
