"use client";

import { useEffect, useState } from "react";

import dynamic from "next/dynamic";

const PDFViewer = dynamic(
  async () => {
    const reactPdf =
      await import("react-pdf");

    const {
      Document,
      Page,
      pdfjs,
    } = reactPdf;

    pdfjs.GlobalWorkerOptions.workerSrc =
      "//unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs";

    return function Viewer() {
      const [pdfFile, setPdfFile] =
        useState(null);

      const [numPages, setNumPages] =
        useState(null);

      const [pageWidth, setPageWidth] =
        useState(600);

      useEffect(() => {
        async function loadPdf() {
          try {
            const res =
              await fetch(
                "/api/report/pdf"
              );

            const blob =
              await res.blob();

            setPdfFile(blob);
          } catch (err) {
            console.log(err);
          }
        }

        loadPdf();

        function resize() {
          setPageWidth(
            window.innerWidth > 600
              ? 600
              : window.innerWidth - 40
          );
        }

        resize();

        window.addEventListener(
          "resize",
          resize
        );

        return () =>
          window.removeEventListener(
            "resize",
            resize
          );
      }, []);

      if (!pdfFile) {
        return (
          <p className="p-4">
            Loading PDF...
          </p>
        );
      }

      return (
        <div className="flex justify-center min-h-screen bg-gray-100 p-4">
          <div className="bg-white border shadow-lg p-2">
            <Document
              file={pdfFile}
              onLoadSuccess={({
                numPages,
              }) =>
                setNumPages(
                  numPages
                )
              }
              onLoadError={(err) =>
                console.log(err)
              }
            >
              {Array.from(
                new Array(
                  numPages || 0
                ),
                (_, index) => (
                  <Page
                    key={index}
                    pageNumber={
                      index + 1
                    }
                    width={pageWidth}
                    renderTextLayer={
                      false
                    }
                    renderAnnotationLayer={
                      false
                    }
                    className="mb-4"
                  />
                )
              )}
            </Document>
          </div>
        </div>
      );
    };
  },
  {
    ssr: false,
  }
);

export default function Page() {
  return <PDFViewer />;
                      }
