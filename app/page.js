import PublicHero from "@/components/public/PublicHero";
import TimelineClient from "@/components/timeline/TimelineClient";
import TimelineReactionCountPopover from "@/components/timeline/TimelineReactionCountPopover";
import "@/app/page.css";
import "@/app/public-theme.css";
import "@/app/public-theme-state.css";
import "@/app/timeline.css";
import "@/app/timeline-overrides.css";
import "@/app/home-timeline.css";
import "@/components/public/PublicThemePicker.css";
import "@/components/public/PublicBottomNav.css";

export default function ResidentTimelinePage() {
  return (
    <>
      <div className="page-wrap public-home-hero-wrap">
        <PublicHero description="Ruang informasi kegiatan warga, dan dokumentasi lingkungan." />
      </div>
      <TimelineClient />
      <TimelineReactionCountPopover />
    </>
  );
}
