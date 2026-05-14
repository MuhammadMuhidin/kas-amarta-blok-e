"use client";

import {
  Viewer,
  Worker,
  SpecialZoomLevel,
} from "@react-pdf-viewer/core";

import "@react-pdf-viewer/core/lib/styles/index.css";

export default function Page() {
  const handleDownload = () => {
    window.location.href = "/api/report/pdf?download=1";
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
        style={{
          position: "fixed",
          left: "50%",
          bottom: "24px",
          transform: "translateX(-50%)",
          border: "none",
          borderRadius: "999px",
          padding: "14px 20px",
          background: "#2563eb",
          color: "#fff",
          fontSize: 15,
          fontWeight: 600,
          cursor: "pointer",
          zIndex: 9999,
          boxShadow:
            "0 10px 25px rgba(0,0,0,0.25), 0 6px 12px rgba(37,99,235,0.25)",
        }}
      >
        Download PDF
      </button>
    </div>
  );
}
