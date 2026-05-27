"use client";

import { formatCashflowNote, formatDate, formatMoney } from "@/lib/public/publicFormatters";

export default function CashflowSection({
  active,
  searchTerm,
  setSearchTerm,
  setLoadedCashflow,
  animatedIncome,
  animatedExpense,
  animatedNet,
  filteredCashflow,
  loadedCashflow,
  chunk,
  onOpenReceipt,
}) {
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
      <div className="searchbox-wrap">
        <input
          className="searchbox-input"
          placeholder="cari catatan..."
          value={searchTerm}
          onChange={(event) => {
            setSearchTerm(event.target.value);
            setLoadedCashflow(20);
          }}
        />

        {searchTerm && (
          <button
            type="button"
            className="searchbox-clear"
            onClick={() => {
              setSearchTerm("");
              setLoadedCashflow(20);
            }}
            aria-label="Batalkan pencarian"
          >
            ×
          </button>
        )}
      </div>

      <div className="summary">
        <div className="summary-item">
          <span className="summary-label">Total Pemasukan</span>
          <span style={{ color: "#28a745" }} className="summary-value">
            {formatMoney(animatedIncome)}
          </span>
        </div>

        <div className="summary-item">
          <span className="summary-label">Total Pengeluaran</span>
          <span style={{ color: "#dc3545" }} className="summary-value">
            {formatMoney(animatedExpense)}
          </span>
        </div>

        <div className="summary-item">
          <span className="summary-label">Sisa Saldo</span>
          <span style={{ color: "#007bff" }} className="summary-value">
            {formatMoney(animatedNet)}
          </span>
        </div>
      </div>

      <div
        className="table-container cashflow-body"
        onScroll={(event) => {
          const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;

          if (scrollTop + clientHeight >= scrollHeight - 1) {
            setLoadedCashflow((prev) => prev + chunk);
          }
        }}
      >
        <table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Tipe</th>
              <th>Nominal</th>
              <th>Catatan</th>
            </tr>
          </thead>

          <tbody>
            {filteredCashflow.slice(0, loadedCashflow).map((cashflow, index) => (
              <tr key={index}>
                <td>{formatDate(cashflow.date)}</td>

                <td>
                  <span className={`badge ${cashflow.type}`}>
                    {{ income: "Pemasukan", expense: "Pengeluaran" }[cashflow.type] || cashflow.type}
                  </span>
                </td>

                <td>{formatMoney(cashflow.amount)}</td>
                <td>{renderCashflowNote(cashflow.note, cashflow.receipt_url)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
