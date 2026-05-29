import Link from "next/link";
import "@/app/page.css";

export default function ResidentTimelinePage() {
  return (
    <main className="page-wrap">
      <header className="hero-header timeline-hero">
        <div className="hero-eyebrow">Amarta Residence • Blok E</div>
        <p className="hero-desc">
          Dashboard kegiatan warga
          <br />
          dan dokumentasi lingkungan
        </p>
      </header>

      <section className="timeline-placeholder">
        <div className="timeline-placeholder-icon">📸</div>
        <h1>Kegiatan Warga</h1>
        <p>
          Halaman ini disiapkan untuk timeline dokumentasi kegiatan warga, seperti kerja bakti,
          rapat, perbaikan fasum, dan acara bersama.
        </p>
        <Link className="timeline-kas-link" href="/kas">
          Lihat Kas Warga
        </Link>
      </section>
    </main>
  );
}
