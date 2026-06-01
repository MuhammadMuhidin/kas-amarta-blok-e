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
