"use client";

import { useState } from "react";

import {
  Viewer,
  Worker,
} from "@react-pdf-viewer/core";

import "@react-pdf-viewer/core/lib/styles/index.css";

export default function Page() {
  const [loading, setLoading] =
    useState(true);

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
          background: #d1d5db;
        }
      `}</style>

      <div className="fixed inset-0">
        {loading && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent:
                "center",
              background: "#f3f4f6",
              zIndex: 9999,
              fontSize: "15px",
              fontWeight: 500,
              color: "#374151",
              textAlign: "center",
              padding: "24px",
            }}
          >
            Sedang mengumpulkan data
            laporan, mohon tunggu..
          </div>
        )}

        <Worker
          workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js"
        >
          <Viewer
            fileUrl="/api/report/pdf"
            onDocumentLoad={() =>
              setLoading(false)
            }
          />
        </Worker>
      </div>
    </>
  );
}
