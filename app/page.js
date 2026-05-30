import TimelineClient from "@/components/timeline/TimelineClient";
import "@/app/page.css";
import "@/app/public-theme.css";
import "@/app/timeline.css";
import "@/app/timeline-overrides.css";

const timelineInstagramRefinementCss = `
  .timeline-story-item.unread .timeline-story-ring {
    background: var(--primary) !important;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 13%, transparent) !important;
  }

  .timeline-story-ring {
    overflow: hidden !important;
  }

  .timeline-story-ring img,
  .timeline-story-ring > span {
    box-sizing: border-box !important;
    max-width: 100% !important;
    max-height: 100% !important;
    aspect-ratio: 1 / 1 !important;
  }

  .timeline-story-ring img {
    display: block !important;
    object-fit: cover !important;
  }

  .timeline-bottom-nav-item:first-child span {
    font-size: 0 !important;
  }

  .timeline-bottom-nav-item:first-child span::before {
    content: "🏠";
    font-size: 18px;
    line-height: 1;
  }
`;

export default function ResidentTimelinePage() {
  return (
    <>
      <style>{timelineInstagramRefinementCss}</style>
      <TimelineClient />
    </>
  );
}
