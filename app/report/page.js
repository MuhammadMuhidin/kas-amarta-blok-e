"use client";

// Di dalam komponen Next.js (Client Component)
import { useEffect, useState } from 'react';

export default function PdfViewer() {
  const [url, setUrl] = useState("");

  useEffect(() => {
    async function loadPdf() {
      const response = await fetch('/api/report/pdf'); // Ganti dengan path API Anda
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }
    loadPdf();

    // Cleanup memori
    return () => URL.revokeObjectURL(url);
  }, []);

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      {url ? (
        <iframe src={url} width="100%" height="100%" />
      ) : (
        <p>Loading PDF...</p>
      )}
    </div>
  );
}
