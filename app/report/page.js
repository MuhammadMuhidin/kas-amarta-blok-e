"use client";

export default function PreviewLaporan() {
  // Ganti URL ini dengan endpoint API Anda
  const apiEndpoint = "/api/report/pdf"; 

  return (
    <div style={{ width: '100%', height: '100vh', padding: '20px' }}>
      <h2>Pratinjau Laporan Kas</h2>
      
      {/* Menggunakan iframe agar PDF langsung muncul di dalam halaman */}
      <iframe
        src={apiEndpoint}
        width="100%"
        height="600px"
        style={{ border: 'none', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}
        title="PDF Viewer"
      >
        <p>Browser Anda tidak mendukung tampilan PDF. 
           <a href={apiEndpoint}>Klik di sini untuk mengunduh.</a>
        </p>
      </iframe>
    </div>
  );
}
