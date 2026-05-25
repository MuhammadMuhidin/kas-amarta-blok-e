"use client";

import LoadingButtonContent from "@/components/admin/LoadingButtonContent";
import useInfiniteRows from "@/components/admin/useInfiniteRows";
import modalStyles from "@/components/admin/AdminModal.module.css";
import { useEffect, useState } from "react";

const pageSize = 10;

function formatDate(date) {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatPeriod(period) {
  if (!period || period === "-") return "-";

  const normalized = String(period).slice(0, 7);

  if (!/^\d{4}-\d{2}$/.test(normalized)) return period;

  return new Date(`${normalized}-01`).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

function formatCashflowNote(note) {
  if (!note) return "-";

  return String(note).replace(/\b(\d{4}-\d{2})(?:-\d{2})?\b/g, (_, period) =>
    formatPeriod(period),
  );
}

export default function CashflowTab({
  addCashflow,
  cashflow,
  setCashflow,
  loadingCashflow,
}) {
  const [typeFilter, setTypeFilter] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [summary, setSummary] = useState({
    income: 0,
    expense: 0,
  });

  const {
    items,
    total,
    loading,
    loadingMore,
    error,
    hasMore,
    loaderRef,
    refresh,
  } = useInfiniteRows({
    pageSize,
    buildUrl: ({ page, limit }) => {
      const params = new URLSearchParams();

      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("source", "direct");

      if (typeFilter) params.set("type", typeFilter);

      return `/api/sheets/cashflow?${params.toString()}`;
    },
    deps: [typeFilter],
    getItems: (data) => {
      if (data.summary) {
        setSummary(data.summary);
      }

      return data.cashflows || [];
    },
    getPagination: (data) => data.pagination || {},
  });

  useEffect(() => {
    refresh();
  }, [typeFilter]);

  async function handleAddCashflow(e) {
    await addCashflow(e);
    await refresh();
  }

  return (
    <>
      <div className="admin-card">
        <h3>Direct Cashflow</h3>

        <div style={styles.helperText}>
          Catat pemasukan atau pengeluaran langsung di luar pembayaran warga.
        </div>

        <form onSubmit={handleAddCashflow} className="admin-form">
          <select
            className="admin-input"
            value={cashflow.type}
            onChange={(e) =>
              setCashflow({
                ...cashflow,
                type: e.target.value,
              })
            }
          >
            <option value="">Transaction Type</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>

          <input
            className="admin-input"
            type="number"
            min="1"
            placeholder="Transaction amount"
            value={cashflow.amount}
            onChange={(e) =>
              setCashflow({
                ...cashflow,
                amount: e.target.value,
              })
            }
          />

          <input
            className="admin-input"
            placeholder="Description"
            value={cashflow.note}
            onChange={(e) =>
              setCashflow({
                ...cashflow,
                note: e.target.value,
              })
            }
          />

          <button className="admin-btn" disabled={loadingCashflow}>
            <LoadingButtonContent
              loading={loadingCashflow}
              loadingText="Recording..."
            >
              Record Transaction
            </LoadingButtonContent>
          </button>
        </form>

        <div style={styles.summaryGrid}>
          <div style={styles.card}>
            <div style={styles.label}>Direct Income</div>
            <div style={styles.incomeValue}>
              Rp{Number(summary.income || 0).toLocaleString("id-ID")}
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.label}>Direct Expense</div>
            <div style={styles.expenseValue}>
              Rp{Number(summary.expense || 0).toLocaleString("id-ID")}
            </div>
          </div>
        </div>

        <div style={styles.toolbar}>
          <select
            className="admin-input"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All Transaction</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </div>

        {error && <div className="admin-error-box">{error}</div>}

        <div style={styles.metaBar}>
          <span>{items.length} / {total} loaded</span>
        </div>

        {loading ? (
          <p>Loading cashflow...</p>
        ) : items.length === 0 ? (
          <div className="admin-empty-state">
            Direct cashflow belum tersedia.
          </div>
        ) : (
          <>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th className="admin-th">Date</th>
                    <th className="admin-th">Type</th>
                    <th className="admin-th">Amount</th>
                    <th className="admin-th" style={styles.descriptionHeader}>
                      Description
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item, index) => {
                    const isIncome = item.type === "income";

                    return (
                      <tr
                        key={item.id || index}
                        className={index % 2 ? "admin-row-alt" : ""}
                        onClick={() => setSelectedItem(item)}
                        style={{ cursor: "pointer" }}
                      >
                        <td className="admin-td">{formatDate(item.date)}</td>

                        <td className="admin-td">
                          <span
                            style={
                              isIncome
                                ? styles.typeIncome
                                : styles.typeExpense
                            }
                          >
                            {item.type}
                          </span>
                        </td>

                        <td
                          className="admin-td"
                          style={
                            isIncome
                              ? styles.amountIncome
                              : styles.amountExpense
                          }
                        >
                          Rp{Number(item.amount || 0).toLocaleString("id-ID")}
                        </td>

                        <td
                          className="admin-td"
                          style={styles.descriptionCell}
                        >
                          {formatCashflowNote(item.note)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div ref={loaderRef} style={styles.loaderSentinel}>
              {loadingMore
                ? "Loading more..."
                : hasMore
                  ? "Scroll to load more"
                  : "All transactions loaded"}
            </div>
          </>
        )}
      </div>

      {selectedItem && (
        <div
          className={modalStyles.overlay}
          onClick={() => setSelectedItem(null)}
        >
          <div
            className={modalStyles.box}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.modalTitle}>
              Direct Transaction Detail
            </div>

            <div style={styles.modalGrid}>
              <div style={styles.modalRow}>
                <span>Date</span>
                <strong>{formatDate(selectedItem.date)}</strong>
              </div>

              <div style={styles.modalRow}>
                <span>Reference</span>
                <strong>{selectedItem.ref_id}</strong>
              </div>

              <div style={styles.modalRow}>
                <span>Type</span>
                <strong
                  style={
                    selectedItem.type === "income"
                      ? styles.typeIncome
                      : styles.typeExpense
                  }
                >
                  {selectedItem.type}
                </strong>
              </div>

              <div style={styles.modalRow}>
                <span>Amount</span>
                <strong
                  style={
                    selectedItem.type === "income"
                      ? styles.amountIncome
                      : styles.amountExpense
                  }
                >
                  Rp{Number(selectedItem.amount || 0).toLocaleString("id-ID")}
                </strong>
              </div>

              <div style={styles.modalRow}>
                <span>Description</span>
                <strong>{formatCashflowNote(selectedItem.note)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  helperText: {
    marginBottom: 14,
    color: "var(--admin-muted)",
    fontSize: 13,
    lineHeight: 1.6,
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
    gap: 12,
    marginBottom: 16,
  },

  card: {
    padding: 16,
    borderRadius: 14,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-row)",
  },

  label: {
    fontSize: 12,
    fontWeight: 700,
    color: "var(--admin-muted)",
    marginBottom: 8,
  },

  incomeValue: {
    color: "var(--admin-income)",
    fontWeight: 800,
    fontSize: 22,
  },

  expenseValue: {
    color: "var(--admin-expense)",
    fontWeight: 800,
    fontSize: 22,
  },

  toolbar: {
    marginBottom: 12,
  },

  metaBar: {
    marginBottom: 10,
    color: "var(--admin-muted)",
    fontSize: 12,
    fontWeight: 700,
  },

  typeIncome: {
    color: "var(--admin-income)",
    fontWeight: 700,
    textTransform: "capitalize",
  },

  typeExpense: {
    color: "var(--admin-expense)",
    fontWeight: 700,
    textTransform: "capitalize",
  },

  amountIncome: {
    color: "var(--admin-income)",
    fontWeight: 800,
  },

  amountExpense: {
    color: "var(--admin-expense)",
    fontWeight: 800,
  },

  descriptionHeader: {
    textAlign: "left",
  },

  descriptionCell: {
    textAlign: "left",
  },

  loaderSentinel: {
    padding: "14px 0 4px",
    color: "var(--admin-muted)",
    fontSize: 12,
    fontWeight: 700,
    textAlign: "center",
  },

  modalTitle: {
    fontSize: 24,
    fontWeight: 800,
    marginBottom: 18,
    color: "var(--admin-text)",
  },

  modalGrid: {
    display: "grid",
    gap: 12,
  },

  modalRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    paddingTop: 12,
    borderTop: "1px solid var(--admin-border)",
    color: "var(--admin-text)",
  },
};