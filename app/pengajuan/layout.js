import "@/app/public-theme-state.css";
import "@/components/public/PublicThemePicker.css";
import "@/components/public/PublicBottomNav.css";
import "./pengajuan.css";
import "./master-loading.css";
import PengajuanMasterLoadingGuard from "./PengajuanMasterLoadingGuard";

export default function PengajuanLayout({ children }) {
  return (
    <>
      <PengajuanMasterLoadingGuard />
      {children}
    </>
  );
}
