"use client";
import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// Penting: Hubungkan ke worker PDF.js agar proses render cepat
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

export default function MyPdfViewer() {
  const [numPages, setNumPages] = useState(null);

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
  }

  return (
    <div className="flex flex-col items-center bg-gray-100 p-4 min-h-screen">
      <div className="border shadow-lg bg-white p-2">
        <Document
          file="/api/report/pdf" // Langsung arahkan ke API Anda
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<p>Menyiapkan dokumen...</p>}
        >
          {/* Render semua halaman sekaligus agar terlihat seperti PDF viewer asli */}
          {Array.from(new Array(numPages), (el, index) => (
            <Page 
              key={`page_${index + 1}`} 
              pageNumber={index + 1} 
              renderTextLayer={false} // Matikan jika tidak butuh copy text (lebih ringan)
              renderAnnotationLayer={false} 
              className="mb-4"
              width={window.innerWidth > 600 ? 600 : window.innerWidth - 40}
            />
          ))}
        </Document>
      </div>
    </div>
  );
                }
