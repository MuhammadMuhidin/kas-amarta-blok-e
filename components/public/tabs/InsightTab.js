"use client";

import { useEffect } from "react";
import { formatCashflowNote, formatDate, formatMoney, formatPeriod } from "@/lib/public/publicFormatters";

const insightDetailModalCss = `
  .insight-detail-modal-overlay {
    align-items: center;
    justify-content: center;
    overflow-y: auto;
    padding: 18px 12px;
  }

  .insight-detail-modal-box {
    max-height: calc(100dvh - 36px);
    overflow-y: auto;
    overflow-x: auto;
    position: relative;
    transform-origin: center;
  }

  .insight-detail-modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .insight-detail-modal-title-group {
    min-width: 0;
  }

  .insight-detail-modal-subtitle {
    margin: 6px 0 0;
    color: var(--muted);
    font-size: var(--font-base);
    font-weight: 700;
    line-height: 1.5;
  }

  .insight-detail-modal-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--surface-soft);
    color: var(--text);
    cursor: pointer;
    font-size: 24px;
    font-weight: 900;
    line-height: 1;
  }

  .insight-detail-modal-section {
    margin-bottom: 0;
  }

  .insight-detail-table {
    margin: 10px auto 0;
    table-layout: auto;
  }

  @media (max-width: 640px) {
    .insight-detail-modal-overlay {
      align-items: center;
      justify-content: center;
      padding: 12px 8px;
    }

    .insight-detail-modal-box {
      width: min(100%, calc(100vw - 16px));
      max-height: calc(100dvh - 24px);
      border-radius: 18px;
      padding: 16px;
    }

    .insight-detail-modal-header {
      align-items: stretch;
      flex-direction: row;
      gap: 12px;
    }
  }
`;

export default function InsightTab({
  active,
  insight,
  paidInLastPeriodCount,
  insightResult,
  totalPageInsight,
  perPageInsight,
  insightSlideIndex,
  setInsightSlideIndex,
  showInsightModal,
  setShowInsightModal,
  modalType,
  setModalType,
  expenseDelta,
  expenseDeltaAmount,
  balanceDelta,
  balanceDeltaAmount,
  animatedLastMonthExpense,
  animatedLastMonthRemaining,
  animatedCurrentIncomePlusLastRemaining,
  animatedCurrentMonthExpense,
  animatedCurrentBalance,
  onDownloadPDF,
  onOpenReceipt,
}) {
  useEffect(() => {
    if (!showInsightModal || typeof document === "undefined") return undefined;

    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [showInsightModal]);

  function renderCashflowNote(note, receiptUrl) {
    const formattedNote = formatCashflowNote(note);

    if (!receiptUrl) return formattedNote;

    return (
      <span>
        {formattedNote}{" "}
        <button
          type="button"
          onClick={() => onOpenReceipt(receiptUrl, note)}
          style={{
            border: 0,
            background: "transparent",
            padding: 0,
            color: "inherit",
            fontWeight: 700,
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          Nota
        </button>
      </span>
    );
  }

  return (
    <div className={!active ? "hidden" : ""}>
      <style>{insightDetailModalCss}</style>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <h2 style={{ margin: 0 }}>Rekap keuangan kas</h2>

        <button
          onClick={onDownloadPDF}
          style={{
            padding: "8px 14px",
            background: "var(--btn-primary)",
            color: "var(--btn-text)",
            border: "1px solid var(--btn-download-border)",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "var(--font-small)",
            fontWeight: "600",
          }}
        >
          Download Laporan PDF
        </button>
      </div>

      <div className="insight-summary">
        <div className="insight-row">
          <span className="insight-label">Pengeluaran bulan {insight?.lastMonth?.month}</span>

          <div className="insight-action">
            <strong style={{ color: "#dc3545" }}>{formatMoney(animatedLastMonthExpense)}</strong>

            <button
              className="insight-link"
              onClick={() => {
                setModalType("last");
                setShowInsightModal(true);
              }}
            >
              lihat detail
            </button>
          </div>
        </div>

        <div className="insight-row-final highlight-blue">
          <span>Sisa saldo kumulatif per {insight?.lastMonth?.month}</span>
          <strong>{formatMoney(animatedLastMonthRemaining)}</strong>
        </div>

        <hr className="insight-divider" />

        <div className="insight-row">
          <span>
            Kas bulan {insight?.currentMonth?.month} dari {paidInLastPeriodCount} rumah + sisa bulan lalu
          </span>
          <strong>{formatMoney(animatedCurrentIncomePlusLastRemaining)}</strong>
        </div>

        <div className="insight-row">
          <span>Pengeluaran bulan ini</span>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <div className="insight-value-stack">
              <strong style={{ color: "#dc3545" }}>{formatMoney(animatedCurrentMonthExpense)}</strong>

              <span className={`insight-delta ${expenseDelta > 0 ? "bad" : expenseDelta < 0 ? "good" : "neutral"}`}>
                {expenseDelta > 0 ? "↑naik " : expenseDelta < 0 ? "↓turun" : "•tetap"}{" "}
                {Math.abs(expenseDelta) > 100
                  ? formatMoney(expenseDeltaAmount)
                  : `${Math.abs(expenseDelta).toFixed(0)}%`}
              </span>
            </div>

            <button
              className="insight-link"
              onClick={() => {
                setModalType("current");
                setShowInsightModal(true);
              }}
            >
              lihat detail
            </button>
          </div>
        </div>

        <div className="insight-row final-balance">
          <span>Total saldo saat ini</span>

          <div className="insight-value-stack">
            <strong>{formatMoney(animatedCurrentBalance)}</strong>

            <span className={`insight-delta ${balanceDelta > 0 ? "good" : balanceDelta < 0 ? "bad" : "neutral"}`}>
              {balanceDelta > 0 ? "↑naik" : balanceDelta < 0 ? "↓turun" : "•tetap"}{" "}
              {Math.abs(balanceDelta) > 100
                ? `${formatMoney(balanceDeltaAmount)} dari bulan lalu`
                : `${Math.abs(balanceDelta).toFixed(0)}% dari bulan lalu`}
            </span>
          </div>
        </div>
      </div>

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

      {showInsightModal && (
        <div className="modal-overlay insight-detail-modal-overlay" onClick={() => setShowInsightModal(false)}>
          <div className="modal-box insight-detail-modal-box" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header insight-detail-modal-header">
              <div className="insight-detail-modal-title-group">
                <div className="modal-title">
                  Detail Pengeluaran Bulan {modalType === "last" ? insight?.lastMonth?.month : insight?.currentMonth?.month}
                </div>
                <div className="insight-detail-modal-subtitle">
                  Total Pengeluaran: {formatMoney(modalType === "last" ? insight?.lastMonth?.expenseTotal || 0 : insight?.currentMonth?.expenseTotal || 0)}
                </div>
              </div>
              <button
                type="button"
                className="insight-detail-modal-close"
                onClick={() => setShowInsightModal(false)}
                aria-label="Tutup detail pengeluaran"
              >
                ×
              </button>
            </div>

            <div className="modal-section insight-detail-modal-section">
              <table className="detail-table insight-detail-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Keterangan</th>
                    <th>Nominal</th>
                  </tr>
                </thead>

                <tbody>
                  {(modalType === "last" ? insight?.lastMonth?.expenses || [] : insight?.currentMonth?.expenses || []).map((expense, index) => (
                    <tr key={index}>
                      <td>{formatDate(expense.date)}</td>
                      <td>{renderCashflowNote(expense.note, expense.receipt_url)}</td>
                      <td>{formatMoney(expense.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
