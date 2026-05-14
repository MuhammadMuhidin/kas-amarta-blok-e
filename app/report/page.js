"use client";

import {
  Viewer,
  Worker,
  SpecialZoomLevel,
} from "@react-pdf-viewer/core";

import "@react-pdf-viewer/core/lib/styles/index.css";

export default function Page() {
  const handleDownload = async () => {
    const res = await fetch(
      "/api/report/pdf"
    );

    const blob =
      await res.blob();

    const url =
      window.URL.createObjectURL(
        blob
      );

    const a =
      document.createElement("a");

    a.href = url;

    a.download =
      "laporan-keuangan.pdf";

    document.body.appendChild(
      a
    );

    a.click();

    a.remove();

    window.URL.revokeObjectURL(
      url
    );
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
      <Worker
        workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js"
      >
        <Viewer
          fileUrl="/api/report/pdf"
          defaultScale={
            SpecialZoomLevel.PageFit
          }
        />
      </Worker>

      <button
        onClick={
          handleDownload
        }
        style={{
          position: "fixed",
          right: 20,
          bottom: 20,
          border: "none",
          borderRadius: "999px",
          padding:
            "14px 18px",
          background:
            "#2563eb",
          color: "#fff",
          fontSize: 15,
          fontWeight: 600,
          cursor: "pointer",
          boxShadow:
            "0 8px 24px rgba(0,0,0,0.18)",
          zIndex: 9999,
        }}
      >
        Download PDF
      </button>
    </div>
  );
}
