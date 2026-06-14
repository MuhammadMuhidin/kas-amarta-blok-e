"use client";

export default function AdminDataSkeleton({ rows = 5, cards = 4, showSummary = true }) {
  return (
    <div className="admin-data-skeleton" aria-hidden="true">
      {showSummary && (
        <div className="admin-data-skeleton-summary">
          {Array.from({ length: cards }).map((_, index) => (
            <div className="admin-data-skeleton-block admin-data-skeleton-summary-card" key={index} />
          ))}
        </div>
      )}
      <div className="admin-data-skeleton-list">
        {Array.from({ length: rows }).map((_, index) => (
          <div className="admin-data-skeleton-block admin-data-skeleton-row" key={index} />
        ))}
      </div>
      <style jsx global>{`
        @keyframes adminDataSkeletonShimmer {
          0% { background-position: 140% 0; }
          100% { background-position: -140% 0; }
        }
        .admin-data-skeleton { display: grid; gap: 14px; width: 100%; }
        .admin-data-skeleton-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
        .admin-data-skeleton-list { display: grid; gap: 12px; }
        .admin-data-skeleton-block {
          border: 1px solid var(--admin-border);
          background-color: var(--admin-row);
          background-image: linear-gradient(90deg, transparent, rgba(148,163,184,.22), transparent);
          background-size: 220% 100%;
          animation: adminDataSkeletonShimmer 1.2s ease-in-out infinite;
        }
        .admin-data-skeleton-summary-card { min-height: 76px; border-radius: 14px; }
        .admin-data-skeleton-row { min-height: 112px; border-radius: 16px; }
        @media (max-width: 640px) {
          .admin-data-skeleton-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      `}</style>
    </div>
  );
}
