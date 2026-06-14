"use client";

import { formatPeriod } from "@/lib/public/publicFormatters";

export default function ArrearsTab({
  active,
  insightResult,
  totalPageInsight,
  perPageInsight,
  insightSlideIndex,
  setInsightSlideIndex,
}) {
  return (
    <div className={!active ? "hidden" : ""}>
      <h2>Laporan Tunggakan Saat ini</h2>

      {insightResult.length > 0 ? (
        <>
          <div
            className="insight-slider"
            onScroll={(event) => {
              const width = event.currentTarget.clientWidth;
              const index = Math.round(event.currentTarget.scrollLeft / width);
              setInsightSlideIndex(index);
            }}
          >
            {Array.from({ length: totalPageInsight }).map((_, pageIndex) => {
              const items = insightResult.slice(
                pageIndex * perPageInsight,
                (pageIndex + 1) * perPageInsight,
              );

              return (
                <div className="insight-slide-page" key={pageIndex}>
                  {items.map((result, index) => (
                    <div key={index} className="insight-card">
                      <b>
                        {pageIndex * perPageInsight + index + 1}. {result.house}
                      </b>

                      <div>• Nunggak: {result.jumlah} periode</div>
                      <div>• Periode: {result.unpaid.map(formatPeriod).join(", ")}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {totalPageInsight > 1 && (
            <div className="insight-dots">
              {Array.from({ length: totalPageInsight }).map((_, index) => (
                <span key={index} className={insightSlideIndex === index ? "active" : ""} />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="insight-card">Tidak ada tunggakan.</div>
      )}
    </div>
  );
}
