"use client";

import LoadingButtonContent from "@/components/admin/LoadingButtonContent";
import useInfiniteRows from "@/components/admin/useInfiniteRows";
import modalStyles from "@/components/admin/AdminModal.module.css";
import { useMemo, useState } from "react";

const pageSize = 10;

export default function CashflowTab({
  addCashflow,
  cashflow,
  setCashflow,
  loadingCashflow,
}) {
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);

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
      if (search.trim()) params.set("search", search.trim());

      return `/api/sheets/cashflow?${params.toString()}`;
    },
    deps: [typeFilter, search],
    getItems: (data) => data.cashflows || [],
    getPagination: (data) => data.pagination || {},
  });

  const summary = useMemo(() => {
    const income = items
      .filter((item) => item.type === "income")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const expense = items
      .filter((item) => item.type === "expense")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return {
      income,
      expense,
      net: income - expense,
    };
  }, [items]);

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
            <div style={styles.label}>Income</div>
            <div style={styles.incomeValue}>
              Rp{summary.income.toLocaleString("id-ID")}
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.label}>Expense</div>
            <div style={styles.expenseValue}>
              Rp{summary.expense.toLocaleString("id-ID")}
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.label}>Net</div>
            <div
              style={
                summary.net >= 0
                  ? styles.netPositive
                  : styles.netNegative
              }
            >
              Rp{summary.net.toLocaleString("id-ID")}
            </div>
          </div>
        </div>

        <div style={styles.toolbar}>
          <input
            className="admin-input"
            placeholder="Search transaction..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="admin-input"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All Transaction</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>

          <button
            type="button"
            className="admin-small-btn"
            disabled={loading || loadingMore}
            onClick={refresh}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
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
                    <th className="admin-th">Description</th>
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
                        <td className="admin-td">{item.date}</td>

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

                        <td className="admin-td">{item.note}</td>
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
                <strong>{selectedItem.date}</strong>
              </div>

              <div style={styles.modalRow}>
                <span>Reference</span>
                <strong>{selectedItem.ref_id}</strong>
              </div>

              <div style={styles.modalRow}>
                <span>Type</span>
                <strong>{selectedItem.type}</strong>
              </div>

              <div style={styles.modalRow}>
                <span>Amount</span>
                <strong>
                  Rp{Number(selectedItem.amount || 0).toLocaleString("id-ID")}
                </strong>
              </div>

              <div style={styles.modalRow}>
                <span>Description</span>
                <strong>{selectedItem.note}</strong>
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
    color: "#2563eb",
    fontWeight: 800,
    fontSize: 22,
  },

  expenseValue: {
    color: "#dc2626",
    fontWeight: 800,
    fontSize: 22,
  },

  netPositive: {
    color: "#16a34a",
    fontWeight: 800,
    fontSize: 22,
  },

  netNegative: {
    color: "#dc2626",
    fontWeight: 800,
    fontSize: 22,
  },

  toolbar: {
    display: "grid",
    gridTemplateColumns: "1fr 180px auto",
    gap: 10,
    marginBottom: 12,
  },

  metaBar: {
    marginBottom: 10,
    color: "var(--admin-muted)",
    fontSize: 12,
    fontWeight: 700,
  },

  typeIncome: {
    color: "#2563eb",
    fontWeight: 700,
    textTransform: "capitalize",
  },

  typeExpense: {
    color: "#dc2626",
    fontWeight: 700,
    textTransform: "capitalize",
  },

  amountIncome: {
    color: "#2563eb",
    fontWeight: 800,
  },

  amountExpense: {
    color: "#dc2626",
    fontWeight: 800,
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
  },
};