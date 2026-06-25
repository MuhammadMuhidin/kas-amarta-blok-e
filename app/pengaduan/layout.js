import PublicHero from "@/components/public/PublicHero";
import "@/app/page.css";
import "@/app/public-theme.css";
import "@/app/public-theme-state.css";
import "@/app/timeline.css";
import "@/app/timeline-overrides.css";
import "@/app/home-timeline.css";
import "@/components/public/PublicThemePicker.css";
import "@/components/public/PublicBottomNav.css";
import "./pengaduan.css";

export default function PengaduanLayout({ children }) {
  return (
    <>
      <div className="page-wrap public-home-hero-wrap">
        <PublicHero description="Sampaikan kritik, saran, atau pengaduan kepada pengurus lingkungan." showManagerLink={false} />
      </div>
      {children}
    </>
  );
}
