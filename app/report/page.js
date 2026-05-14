"use client";

import { useEffect, useState } from "react";
import {
  Viewer,
  Worker,
  SpecialZoomLevel,
} from "@react-pdf-viewer/core";

import "@react-pdf-viewer/core/lib/styles/index.css";

export default function Page() {
  const [stage, setStage] = useState("boot");
  const [progress, setProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = () => {
    if (downloading) return;

    setDownloading(true);

    window.location.href = "/api/report/pdf?download=1";

    setTimeout(() => {
      setDownloading(false);
    }, 2000);
  };

  useEffect(() => {
    let interval;

    const timeline = [
      { stage: "boot", delay: 400, label: "Menghubungi server" },
      { stage: "prepare", delay: 900, label: "Sedang menyiapkan data untuk di-review" },
      { stage: "load", delay: 1200, label: "Verifikasi keamanan" },
      { stage: "ready", delay: 1600, label: "Menghitung data transaksi" },
    ];

    let i = 0;

    const nextStep = () => {
      if (i < timeline.length) {
        setStage(timeline[i].stage);
        i++;
        setTimeout(nextStep, timeline[i - 1].delay);
      } else {
        clearInterval(interval);
      }
    };

    nextStep();

    // fake progress engine
    interval = setInterval(() => {
      setProgress((p) => {
        const next = p + Math.random() * 10;

        if (next >= 100) {
          clearInterval(interval);
          return 100;
        }

        return next;
      });
    }, 120);

    return () => clearInterval(interval);
  }, []);

  const stageText = {
    boot: "Menghubungi server",
    prepare: "Sedang menyiapkan data untuk di-review",
    load: "Verifikasi keamanan",
    ready: "Menghitung data transaksi",
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
      {stage !== "ready" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#e5e7eb",
            zIndex: 9999,
          }}
        >
          {/* spinner */}
          <div
            style={{
              width: 34,
              height: 34,
              border: "3px solid rgba(0,0,0,0.12)",
              borderTop: "3px solid #2563eb",
              borderRadius: "50%",
              animation: "spin 0.9s linear infinite",
              marginBottom: 14,
            }}
          />

          {/* stage text */}
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

          {/* progress bar */}
          <div
            style={{
              width: 240,
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
                transition: "width 120ms ease",
              }}
            />
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              opacity: 0.7,
            }}
          >
            {Math.floor(progress)}%
          </div>

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
        </div>
      )}

      {/* PDF VIEWER */}
      {stage === "ready" && (
        <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
          <Viewer
            fileUrl="/api/report/pdf"
            defaultScale={SpecialZoomLevel.PageFit}
          />
        </Worker>
      )}

      {/* DOWNLOAD BUTTON */}
      {stage === "ready" && (
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
            boxShadow:
              "0 10px 25px rgba(0,0,0,0.25), 0 6px 12px rgba(37,99,235,0.25)",
          }}
        >
          {downloading ? "Downloading..." : "Download PDF"}
        </button>
      )}
    </div>
  );
}
