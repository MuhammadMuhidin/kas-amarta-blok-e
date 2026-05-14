"use client";

import {
  Viewer,
  Worker,
  SpecialZoomLevel,
} from "@react-pdf-viewer/core";

import "@react-pdf-viewer/core/lib/styles/index.css";

export default function Page() {
  return (
    <>
      <style jsx global>{`
        html,
        body,
        #__next {
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
          overflow: hidden;
        }

        .rpv-core__viewer {
          width: 100vw !important;
          height: 100vh !important;
        }

        .rpv-core__page-layer {
          margin: 0 auto !important;
        }
      `}</style>

      <div className="fixed inset-0 bg-gray-200">
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
    </>
  );
}
