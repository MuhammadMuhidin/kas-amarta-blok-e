import PublicHero from "@/components/public/PublicHero";
import "@/app/timeline.css";
import "@/app/timeline-overrides.css";
import "@/app/home-timeline.css";

export default function KasLayout({ children }) {
  return (
    <>
      <div className="page-wrap public-home-hero-wrap">
        <PublicHero description="Pusat transparansi pembayaran dan pengelolaan kas warga." showManagerLink={false} />
      </div>
      {children}
    </>
  );
}
