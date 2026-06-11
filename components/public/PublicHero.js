"use client";

import Link from "next/link";

export default function PublicHero({ description, showManagerLink = true, className = "" }) {
  return (
    <header className={`hero-header timeline-hero public-hero ${className}`.trim()}>
      <div className="hero-eyebrow">Amarta Residence • Blok E</div>
      <p className="hero-desc">{description}</p>
      {showManagerLink ? (
        <Link href="/login" className="hero-manager-link" aria-label="Masuk Area Pengurus">
          🔐 Area Pengurus
        </Link>
      ) : null}

      <style jsx global>{`
        .public-hero {
          text-align: center !important;
        }

        .public-hero .hero-eyebrow,
        .public-hero .hero-desc {
          margin-left: auto !important;
          margin-right: auto !important;
          text-align: center !important;
        }

        .public-hero .hero-manager-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: fit-content;
          min-height: 34px;
          margin: 14px auto 0;
          padding: 7px 12px;
          border: 1px solid color-mix(in srgb, var(--primary) 22%, var(--border));
          border-radius: 999px;
          background: color-mix(in srgb, var(--surface) 88%, transparent);
          color: var(--text);
          box-shadow: var(--shadow-soft);
          font-size: 12px;
          font-weight: 900;
          line-height: 1;
          text-decoration: none;
          -webkit-tap-highlight-color: transparent;
          -webkit-user-select: none;
          user-select: none;
        }

        .public-hero .hero-manager-link:hover,
        .public-hero .hero-manager-link:focus-visible {
          border-color: var(--primary);
          background: color-mix(in srgb, var(--primary) 10%, var(--surface));
          outline: none;
        }

        @media (max-width: 700px) {
          .public-hero .hero-manager-link {
            min-height: 32px;
            margin-top: 12px;
            padding: 7px 10px;
            font-size: 11px;
          }
        }
      `}</style>
    </header>
  );
}
