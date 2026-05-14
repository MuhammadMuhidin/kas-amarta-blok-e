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
    const timeline = [
      { stage: "boot", delay: 1000 },
      { stage: "prepare", delay: 1000 },
      { stage: "load", delay: 1000 },
      { stage: "ready", delay: 1000 },
    ];

    const progressMap = {
      boot: 15,
      prepare: 40,
      load: 75,
      ready: 100,
    };

    let interval;

    const nextStep = (i = 0) => {
      if (i >= timeline.length) return;

      setStage(timeline[i].stage);

      setTimeout(() => nextStep(i + 1), timeline[i].delay);
    };

    nextStep();

    interval = setInterval(() => {
      setProgress((p) => {
        const target = progressMap[stage] ?? 0;

        // kalau sudah melewati target, tetap lanjut ke target berikutnya
        if (p > target) return p;

        const speed = stage === "load" ? 3 : 2;
        const next = p + speed;

        return next > target ? target : next;
      });
    }, 60);

    return () => clearInterval(interval);
  }, [stage]);

  const stageText = {
    boot: "Memulai system",
    prepare: "Menyiapkan data untuk di-review",
    load: "Memuat data server",
    ready: "Mulai hitung data transaksi",
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
      {/* LOADING */}
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

          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              marginBottom: 12,
              color: "#111827",
            }}
          >
            {stageText[stage]}
          </div>

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
                transition: "width 80ms linear",
              }}
            />
          </div>

          <div style={{ marginTop: 8, fontSize: 12 }}>
            {Math.floor(progress)}%
          </div>
        </div>
      )}

      {/* PDF */}
      {stage === "ready" && (
        <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
          <Viewer
            fileUrl="/api/report/pdf"
            defaultScale={SpecialZoomLevel.PageFit}
          />
        </Worker>
      )}

      {/* BUTTON */}
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
            display: "flex",
            alignItems: "center",
            gap: 8,
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

      {/* GLOBAL SPIN */}
      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
