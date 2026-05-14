"use client";

import { useEffect, useState } from "react";
import {
  Viewer,
  Worker,
  SpecialZoomLevel,
} from "@react-pdf-viewer/core";

import "@react-pdf-viewer/core/lib/styles/index.css";

export default function Page() {
  const [stage, setStage] = useState("preparing"); // preparing | loading | ready
  const [progress, setProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = () => {
    if (downloading) return;

    setDownloading(true);
    window.location.href = "/api/report/pdf?download=1";

    setTimeout(() => setDownloading(false), 2000);
  };

  useEffect(() => {
    // STEP 1: Preparing
    const t1 = setTimeout(() => {
      setStage("loading");
    }, 600);

    // fake progress engine
    let interval;

    const t2 = setTimeout(() => {
      interval = setInterval(() => {
        setProgress((prev) => {
          const next = prev + Math.random() * 12;

          if (next >= 100) {
            clearInterval(interval);
            setStage("ready");

            setTimeout(() => {
              setProgress(100);
            }, 100);

            return 100;
          }

          return next;
        });
      }, 120);
    }, 600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearInterval(interval);
    };
  }, []);

  const stageText = {
    preparing: "Sedang mempersiapkan data untuk di-review",
    loading: "Memuat dokumen PDF",
    ready: "Siap digunakan",
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
          {/* Spinner */}
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

          {/* Text stage */}
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "#111827",
              marginBottom: 14,
              textAlign: "center",
            }}
          >
            {stageText[stage]}
          </div>

          {/* Progress bar */}
          <div
            style={{
              width: 220,
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
              color: "#374151",
              opacity: 0.7,
            }}
          >
            {Math.floor(progress)}%
          </div>

          {/* PDF skeleton */}
          <div
            style={{
              marginTop: 28,
              width: 320,
              height: 420,
              borderRadius: 10,
              background:
                "linear-gradient(90deg, rgba(0,0,0,0.06) 25%, rgba(0,0,0,0.03) 37%, rgba(0,0,0,0.06) 63%)",
              backgroundSize: "400% 100%",
              animation: "shimmer 1.4s ease infinite",
            }}
          />

          <style jsx>{`
            @keyframes spin {
              to {
                transform: rotate(360deg);
              }
            }

            @keyframes shimmer {
              0% {
                background-position: 100% 0;
              }
              100% {
                background-position: -100% 0;
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
            opacity: downloading ? 0.85 : 1,
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
        </button>
      )}
    </div>
  );
}
