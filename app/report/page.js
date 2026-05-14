"use client";

import { useEffect, useState } from "react";
import {
  Viewer,
  Worker,
  SpecialZoomLevel,
} from "@react-pdf-viewer/core";

import "@react-pdf-viewer/core/lib/styles/index.css";

export default function Page() {
  // ===== PAGE LOADING =====
  const [stage, setStage] = useState("boot");
  const [loadProgress, setLoadProgress] = useState(0);

  // ===== DOWNLOAD LOADING =====
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const handleDownload = () => {
    if (downloading) return;

    setDownloading(true);
    setDownloadProgress(0);

    let p = 0;

    const interval = setInterval(() => {
      p += Math.random() * 14;

      if (p >= 100) {
        p = 100;
        clearInterval(interval);

        window.location.href = "/api/report/pdf?download=1";

        setTimeout(() => {
          setDownloading(false);
          setDownloadProgress(0);
        }, 1200);
      }

      setDownloadProgress(p);
    }, 120);
  };

  // ===== FAKE PAGE LOADING FLOW =====
  useEffect(() => {
    const steps = [
      { stage: "boot", delay: 500 },
      { stage: "prepare", delay: 900 },
      { stage: "load", delay: 1100 },
      { stage: "ready", delay: 700 },
    ];

    let i = 0;

    const run = () => {
      if (i >= steps.length) return;

      setStage(steps[i].stage);

      const start = loadProgress;

      let p = start;

      const interval = setInterval(() => {
        p += Math.random() * 10;

        if (p >= (i + 1) * 25) {
          p = (i + 1) * 25;
          clearInterval(interval);
        }

        setLoadProgress(Math.min(p, 100));
      }, 80);

      setTimeout(() => {
        clearInterval(interval);
        i++;
        run();
      }, steps[i].delay);
    };

    run();
  }, []);

  const stageText = {
    boot: "Memulai system",
    prepare: "Menghubungi pusat server",
    load: "Menyiapkan data untuk di-review",
    ready: "Menghitung seluruh data transaksi",
  };

  const pageReady = stage === "ready";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#e5e7eb",
        overflow: "hidden",
      }}
    >
      {/* ================= LOADING OVERLAY ================= */}
      {!pageReady && (
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
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              marginBottom: 12,
              color: "#111827",
              textAlign: "center",
            }}
          >
            {stageText[stage]}
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
                width: `${loadProgress}%`,
                height: "100%",
                background: "#2563eb",
                transition: "width 120ms linear",
              }}
            />
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              opacity: 0.6,
            }}
          >
            {Math.floor(loadProgress)}%
          </div>
        </div>
      )}

      {/* ================= PDF VIEWER ================= */}
      {pageReady && (
        <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
          <Viewer
            fileUrl="/api/report/pdf"
            defaultScale={SpecialZoomLevel.PageFit}
          />
        </Worker>
      )}

      {/* ================= DOWNLOAD BUTTON ================= */}
      {pageReady && (
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
            opacity: downloading ? 0.95 : 1,

            boxShadow:
              "0 10px 25px rgba(0,0,0,0.25), 0 6px 12px rgba(37,99,235,0.25)",

            overflow: "hidden",
          }}
        >
          {/* TEXT */}
          <div style={{ position: "relative", zIndex: 2 }}>
            {downloading
              ? `Downloading ${Math.floor(downloadProgress)}%`
              : "Download PDF"}
          </div>

          {/* PROGRESS FILL */}
          {downloading && (
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                height: "100%",
                width: `${downloadProgress}%`,
                background: "rgba(255,255,255,0.18)",
                transition: "width 120ms linear",
              }}
            />
          )}
        </button>
      )}
    </div>
  );
}
