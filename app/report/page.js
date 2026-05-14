"use client";

import { useEffect, useState } from "react";
import {
  Document,
  Page,
  pdfjs,
} from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc =
  "//unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs";

export default function MyPdfViewer() {
  const [numPages, setNumPages] =
    useState(null);

  const [pageWidth, setPageWidth] =
    useState(600);

  useEffect(() => {
    function handleResize() {
      setPageWidth(
        window.innerWidth > 600
          ? 600
          : window.innerWidth - 40
      );
    }

    handleResize();

    window.addEventListener(
      "resize",
      handleResize
    );

    return () =>
      window.removeEventListener(
        "resize",
        handleResize
      );
  }, []);

  function onDocumentLoadSuccess({
    numPages,
  }) {
    setNumPages(numPages);
  }

  return (
    <div className="flex flex-col items-center bg-gray-100 p-4 min-h-screen">
      <div className="border shadow-lg bg-white p-2">
        <Document
          file="/api/report/pdf"
          onLoadSuccess={
            onDocumentLoadSuccess
          }
          loading={
            <p>
              Menyiapkan dokumen...
            </p>
          }
        >
          {Array.from(
            new Array(numPages || 0),
            (_, index) => (
              <Page
                key={`page_${
                  index + 1
                }`}
                pageNumber={
                  index + 1
                }
                renderTextLayer={
                  false
                }
                renderAnnotationLayer={
                  false
                }
                className="mb-4"
                width={pageWidth}
              />
            )
          )}
        </Document>
      </div>
    </div>
  );
}
