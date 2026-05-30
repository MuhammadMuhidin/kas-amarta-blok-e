"use client";

import PublicPageClient from "@/components/public/PublicPageClient";
import "@/app/page.css";
import "@/app/public-theme.css";

const kasPageRefinementCss = `
  body:has(.page-wrap) .public-theme-button {
    width: 1px !important;
    height: 1px !important;
    min-width: 1px !important;
    min-height: 1px !important;
    padding: 0 !important;
    border: 0 !important;
    clip: rect(0 0 0 0) !important;
    clip-path: inset(50%) !important;
    overflow: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
  }

  .hero-header,
  .hero-header .hero-eyebrow,
  .hero-header .hero-desc {
    text-align: center !important;
  }

  .hero-header .hero-eyebrow,
  .hero-header .hero-desc {
    margin-left: auto !important;
    margin-right: auto !important;
  }
`;

export default function PublicKasPage() {
  return (
    <>
      <style>{kasPageRefinementCss}</style>
      <PublicPageClient />
    </>
  );
}
