import PublicHero from "@/components/public/PublicHero";
import "@/app/public-theme-state.css";
import "@/app/timeline.css";
import "@/app/timeline-overrides.css";
import "@/app/home-timeline.css";
import "@/components/public/PublicThemePicker.css";
import "@/components/public/PublicBottomNav.css";
import "./pengajuan.css";
import "./master-loading.css";
import PengajuanMasterLoadingGuard from "./PengajuanMasterLoadingGuard";

export default function PengajuanLayout({ children }) {
  return (
    <>
      <PengajuanMasterLoadingGuard />
      <div className="page-wrap public-home-hero-wrap">
        <PublicHero description="Ajukan kebutuhan warga dan pantau proses persetujuannya secara transparan." />
      </div>
      {children}
    </>
  );
}
