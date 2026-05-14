"use client";

import {
  Viewer,
  Worker,
} from "@react-pdf-viewer/core";

import "@react-pdf-viewer/core/lib/styles/index.css";

export default function Page() {
  const pdfUrl = "/api/report/pdf";

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          padding: "10px",
          borderBottom: "1px solid #ddd",
          display: "flex",
          justifyContent: "flex-end",
          background: "#fff",
        }}
      >
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: "8px 14px",
            background: "#000",
            color: "#fff",
            borderRadius: "6px",
            textDecoration: "none",
            fontSize: "14px",
          }}
        >
          Download PDF
        </a>
      </div>

      {/* PDF Viewer */}
      <div style={{ flex: 1 }}>
        <Worker
          workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js"
        >
          <Viewer fileUrl={pdfUrl} />
        </Worker>
      </div>
    </div>
  );
}
