"use client";

import { useEffect, useRef, useState } from "react";
import {
  Viewer,
  Worker,
  SpecialZoomLevel,
} from "@react-pdf-viewer/core";

import "@react-pdf-viewer/core/lib/styles/index.css";

export default function Page() {
  const [visible, setVisible] = useState(true);
  const containerRef = useRef(null);

  const handleDownload = () => {
    window.location.href = "/api/report/pdf?download=1";
  };

  useEffect(() => {
    let timeout;

    const el = containerRef.current;

    if (!el) return;

    const onScroll = () => {
      setVisible(false);

      clearTimeout(timeout);

      timeout = setTimeout(() => {
        setVisible(true);
      }, 250);
    };

    el.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      el.removeEventListener("scroll", onScroll);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        background: "#e5e7eb",

        // penting: ini yang bikin scroll terjadi di container
        overflow: "auto",
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
            visible ? "translateY(0px)" : "translateY(20px)"
          } scale(${visible ? 1 : 0.92})`,
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? "auto" : "none",
          transition:
            "transform 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease",
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
