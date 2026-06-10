"use client";

import { formatPeriod } from "@/lib/public/publicFormatters";

export default function PaymentStatusTab({
  active,
  periods,
  selectedPeriod,
  setSelectedPeriod,
  paymentList,
  totalPagePay,
  perPagePay,
  paySlideIndex,
  setPaySlideIndex,
  setSelectedResident,
  paySliderRef,
}) {
  return (
    <div className={!active ? "hidden" : ""}>
      <label>Pilih Periode:</label>

      <select
        value={selectedPeriod}
        onChange={(event) => setSelectedPeriod(event.target.value)}
      >
        {periods.map((period) => (
          <option key={period} value={period}>
            {formatPeriod(period)}
          </option>
        ))}
      </select>

      <div
        ref={paySliderRef}
        className="pay-slider"
        onScroll={(event) => {
          const width = event.currentTarget.clientWidth;
          const index = Math.round(event.currentTarget.scrollLeft / width);
          setPaySlideIndex(index);
        }}
      >
        {Array.from({ length: totalPagePay }).map((_, pageIndex) => {
          const items = paymentList.slice(
            pageIndex * perPagePay,
            (pageIndex + 1) * perPagePay,
          );

          return (
            <div className="pay-slide-page" key={pageIndex}>
              <div className="pay-grid">
                {items.map((person, index) => {
                  const status = person.paymentStatus || {};

                  return (
                    <div
                      key={index}
                      className="pay-item"
                      onClick={() => setSelectedResident(person)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <span>{person.house}</span>

                        <span
                          style={{
                            fontWeight: 700,
                            color: status.color || "#6c757d",
                            textAlign: "right",
                          }}
                        >
                          {status.label || "-"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {totalPagePay > 1 && (
        <div className="pay-dots">
          {Array.from({ length: totalPagePay }).map((_, index) => (
            <span key={index} className={paySlideIndex === index ? "active" : ""} />
          ))}
        </div>
      )}
    </div>
  );
}
