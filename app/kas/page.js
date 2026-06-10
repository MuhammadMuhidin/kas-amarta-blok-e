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

  .page-wrap .hero-header,
  .page-wrap .hero-header .hero-eyebrow,
  .page-wrap .hero-header .hero-desc {
    text-align: center !important;
  }

  .page-wrap .hero-header .hero-eyebrow,
  .page-wrap .hero-header .hero-desc {
    margin-left: auto !important;
    margin-right: auto !important;
  }

  .page-wrap .hero-manager-link {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: fit-content !important;
    min-height: 34px !important;
    margin: 14px auto 0 !important;
    padding: 7px 12px !important;
    border: 1px solid color-mix(in srgb, var(--primary) 22%, var(--border)) !important;
    border-radius: 999px !important;
    background: color-mix(in srgb, var(--surface) 88%, transparent) !important;
    color: var(--text) !important;
    box-shadow: var(--shadow-soft) !important;
    font-size: 12px !important;
    font-weight: 900 !important;
    line-height: 1 !important;
    text-decoration: none !important;
    -webkit-tap-highlight-color: transparent !important;
    -webkit-user-select: none !important;
    user-select: none !important;
  }

  .page-wrap .hero-manager-link:hover,
  .page-wrap .hero-manager-link:focus-visible {
    border-color: var(--primary) !important;
    background: color-mix(in srgb, var(--primary) 10%, var(--surface)) !important;
    outline: none !important;
  }

  .page-wrap .tab .tab-link {
    width: 100% !important;
    min-height: 44px !important;
    padding: 0 10px !important;
    border-radius: 12px !important;
    border: 1px solid var(--border) !important;
    background: var(--surface) !important;
    color: var(--text) !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    box-shadow: var(--shadow-soft) !important;
    font-size: var(--font-base) !important;
    font-weight: 700 !important;
    text-align: center !important;
    text-decoration: none !important;
    cursor: pointer !important;
    transition: 0.18s ease !important;
  }

  .page-wrap .tab .tab-link:hover,
  .page-wrap .tab .tab-link:focus-visible {
    transform: translateY(-1px) !important;
    border-color: var(--primary) !important;
    outline: none !important;
  }

  .page-wrap .pay-slider,
  .page-wrap .pay-slide-page,
  .page-wrap .pay-grid,
  .page-wrap .pay-item {
    touch-action: pan-x pan-y !important;
  }

  .page-wrap .pay-slider {
    overscroll-behavior-x: contain !important;
    overscroll-behavior-y: auto !important;
    -webkit-overflow-scrolling: touch !important;
  }

  .page-wrap .modal-box {
    width: 100% !important;
    max-width: 820px !important;
    max-height: 85vh !important;
    padding: 18px !important;
    overflow-x: auto !important;
    overflow-y: auto !important;
    background: var(--surface) !important;
    border: 1px solid var(--border) !important;
    box-shadow: var(--shadow) !important;
    color: var(--text) !important;
  }

  .page-wrap .modal-title,
  .page-wrap .modal-section,
  .page-wrap .detail-table,
  .page-wrap .detail-table th,
  .page-wrap .detail-table td {
    color: var(--text) !important;
  }

  .page-wrap .detail-table {
    width: 100% !important;
    min-width: 520px !important;
    margin-top: 10px !important;
    border-collapse: collapse !important;
    table-layout: auto !important;
    white-space: nowrap !important;
    background: transparent !important;
  }

  .page-wrap .detail-table th,
  .page-wrap .detail-table td {
    padding: 10px 12px !important;
    border: 1px solid var(--border) !important;
    text-align: left !important;
    font-size: var(--font-base) !important;
    background: transparent !important;
  }

  .page-wrap .detail-table th {
    background: var(--surface-soft) !important;
    font-weight: 800 !important;
  }

  .page-wrap .detail-table tr:nth-child(even) {
    background: transparent !important;
  }

  @media (max-width: 700px) {
    .page-wrap .hero-manager-link {
      min-height: 32px !important;
      margin-top: 12px !important;
      padding: 7px 10px !important;
      font-size: 11px !important;
    }

    .page-wrap .modal-box {
      width: calc(100vw - 32px) !important;
      max-width: calc(100vw - 32px) !important;
      margin: 0 auto !important;
      padding: 16px !important;
      overflow-x: auto !important;
      overflow-y: auto !important;
    }

    .page-wrap .detail-table {
      width: 100% !important;
      min-width: 0 !important;
      table-layout: fixed !important;
      margin-right: 0 !important;
      white-space: normal !important;
    }

    .page-wrap .detail-table th,
    .page-wrap .detail-table td {
      padding: 10px !important;
      white-space: normal !important;
      word-break: break-word !important;
    }

    .page-wrap .detail-table th:nth-child(1),
    .page-wrap .detail-table td:nth-child(1) {
      width: 0 !important;
      display: none !important;
    }

    .page-wrap .detail-table th:nth-child(2),
    .page-wrap .detail-table td:nth-child(2) {
      width: 65% !important;
    }

    .page-wrap .detail-table th:nth-child(3),
    .page-wrap .detail-table td:nth-child(3) {
      width: 35% !important;
      white-space: nowrap !important;
    }
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
