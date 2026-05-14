"use client";

import {
  Viewer,
  Worker,
  SpecialZoomLevel,
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
        background: "#fff",
      }}
    >
      <Worker
        workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js"
      >
        <Viewer
          fileUrl="/api/report/pdf"
          defaultScale={
            SpecialZoomLevel.PageWidth
          }
        />
      </Worker>
    </div>
  );
}
