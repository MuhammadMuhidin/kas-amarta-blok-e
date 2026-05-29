import TimelineClient from "@/components/timeline/TimelineClient";
import TimelineGalleryEnhancer from "@/components/timeline/TimelineGalleryEnhancer";
import "@/app/page.css";
import "@/app/public-theme.css";
import "@/app/timeline.css";
import "@/app/timeline-overrides.css";

export default function ResidentTimelinePage() {
  return (
    <>
      <TimelineClient />
      <TimelineGalleryEnhancer />
    </>
  );
}
