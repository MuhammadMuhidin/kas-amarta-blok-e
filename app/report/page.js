"use client";

import { useState, useEffect } from 'react';

export default function TampilPdf() {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPdf = async () => {
      try {
        // Panggil API Anda
        const response = await fetch('/api/report/pdf');
        
        // Ubah response menjadi Blob (binary data)
        const blob = await response.blob();
        
        // Buat URL sementara untuk blob tersebut
        const url = URL.createObjectURL(blob);
        
        setPdfUrl(url);
      } catch (error) {
        console.error("Gagal mengambil PDF:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPdf();

    // Cleanup function untuk mencegah memory leak
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, []);

  if (loading) return <p>Memuat dokumen PDF...</p>;

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <h1>Preview Dokumen</h1>
      {/* Tampilkan PDF menggunakan iframe */}
      {pdfUrl && (
        <iframe 
          src={pdfUrl} 
          width="100%" 
          height="80%" 
          style={{ border: '1px solid #ccc' }}
          title="PDF Preview"
        />
      )}
    </div>
  );
}
