"use client";

import { useEffect, useState, useRef } from "react";
import { Viewer, Worker, SpecialZoomLevel } from "@react-pdf-viewer/core";

// Import styles
import "@react-pdf-viewer/core/lib/styles/index.css";

export default function Page() {
  const [stage, setStage] = useState("boot");
  const [progress, setProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);
  
  // Ref untuk menyimpan nilai stage terbaru agar bisa diakses di dalam interval tanpa trigger effect
  const stageRef = useRef("boot");

  const stageText = {
    boot: "Memuat data keuangan",
    prepare: "Menghitung statistik",
    load: "Memvalidasi pembayaran",
    ready: "Menyusun laporan",
  };

  const progressMap = {
    boot: 15,
    prepare: 40,
    load: 75,
    ready: 100,
  };

  // 1. Logika Timeline (Perpindahan Stage)
  useEffect(() => {
    const timeline = [
      { s: "boot", d: 1000 },
      { s: "prepare", d: 1000 },
      { s: "load", d: 1500 },
      { s: "ready", d: 500 },
    ];

    let timeouts = [];

    const runTimeline = () => {
      let cumulativeDelay = 0;
      timeline.forEach((item) => {
        const timeout = setTimeout(() => {
          setStage(item.s);
          stageRef.current = item.s;
        }, cumulativeDelay);
        timeouts.push(timeout);
        cumulativeDelay += item.d;
      });
    };

    runTimeline();
    return () => timeouts.forEach(clearTimeout);
  }, []);

  // 2. Logika Progress Bar (Animasi)
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        const target = progressMap[stageRef.current] ?? 0;
        if (prev >= target) return prev;

        // Kecepatan bertambah berdasarkan stage
        const increment = stageRef.current === "load" ? 1.5 : 0.8;
        const nextValue = prev + increment;
        
        return nextValue >= target ? target : nextValue;
      });
    }, 30);

    return () => clearInterval(interval);
  }, []);

  const handleDownload = () => {
    if (downloading) return;
    setDownloading(true);
    
    // Trigger download
    window.location.href = "/api/report/pdf?download=1";

    setTimeout(() => {
      setDownloading(false);
    }, 2000);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#f3f4f6",
        fontFamily: "sans-serif",
      }}
    >
      {/* OVERLAY LOADING */}
      {progress < 100 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#e5e7eb",
            zIndex: 100,
          }}
        >
          <div className="spinner" />
          
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "#1f2937" }}>
            {stageText[stage] || "Processing..." }
          </div>

          <div style={{
            width: 240,
            height: 8,
            background: "#d1d5db",
            borderRadius: 10,
            overflow: "hidden"
          }}>
            <div style={{
              width: `${progress}%`,
              height: "100%",
              background: "#2563eb",
              transition: "width 100ms ease-out"
            }} />
          </div>
          
          <div style={{ marginTop: 8, fontSize: 12, color: "#4b5563" }}>
            {Math.floor(progress)}%
          </div>
        </div>
      )}

      {/* PDF VIEWER CONTAINER */}
      <div style={{ height: "100vh", width: "100%" }}>
        {stage === "ready" && (
          <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
            <Viewer
              fileUrl="/api/report/pdf"
              defaultScale={SpecialZoomLevel.PageFit}
            />
          </Worker>
        )}
      </div>

      {/* FLOATING ACTION BUTTON */}
      {stage === "ready" && (
        <button
          onClick={handleDownload}
          disabled={downloading}
          style={{
            position: "fixed",
            left: "50%",
            bottom: "32px",
            transform: "translateX(-50%)",
            border: "none",
            borderRadius: "50px",
            padding: "12px 24px",
            background: downloading ? "#93c5fd" : "#2563eb",
            color: "#fff",
            fontSize: 15,
            fontWeight: 600,
            cursor: downloading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "0 4px 15px rgba(37, 99, 235, 0.3)",
            zIndex: 10,
          }}
        >
          {downloading && <div className="spinner-small" />}
          {downloading ? "Downloading..." : "Download PDF"}
        </button>
      )}

      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #d1d5db;
          border-top-color: #2563eb;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 16px;
        }
        .spinner-small {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
      `}</style>
    </div>
  );
}
