"use client";

import {
  Viewer,
  Worker,
} from "@react-pdf-viewer/core";

//import "@react-pdf-viewer/core/lib/styles/index.css";

export default function Page() {
  return (
      <Worker
        workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js"
      >
        <Viewer
          fileUrl="/api/report/pdf"
        />
      </Worker>
  );
}
