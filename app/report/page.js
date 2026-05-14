"use client";

import {
  Viewer,
  Worker,
} from "@react-pdf-viewer/core";

import "@react-pdf-viewer/core/lib/styles/index.css";

export default function Page() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#fff",
      }}
    >
      <Worker
        workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js"
      >
        <div
          style={{
            width: "100%",
            height: "100%",
          }}
        >
          <Viewer fileUrl="/api/report/pdf" />
        </div>
      </Worker>
    </div>
  );
}
