"use client";

import LoadingButtonContent from "@/components/admin/LoadingButtonContent";
import Toast from "@/components/Toast";
import modalStyles from "@/components/admin/AdminModal.module.css";
import useInfiniteRows from "@/components/admin/useInfiniteRows";
import { useEffect, useRef, useState } from "react";

const pageSize = 10;
const money = (value) => `Rp${Number(value || 0).toLocaleString("id-ID")}`;

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

function getCookie(name) {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}

function TypeLabel({ type }) {
  return <span style={type === "income" ? styles.typeIncome : styles.typeExpense}>{type}</span>;
}

function SummaryCard({ label, value, type }) {
  return (
    <div style={styles.card}>
      <div style={styles.label}>{label}</div>
      <div style={type === "income" ? styles.incomeValue : styles.expenseValue}>
        {money(value)}
      </div>
    </div>
  );
}

function DetailRow({ label, value, strongStyle }) {
  return (
    <div style={styles.modalRow}>
      <span>{label}</span>
      <strong style={strongStyle}>{value || "-"}</strong>
    </div>
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
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [summary, setSummary] = useState({ income: 0, expense: 0 });
  const [receiptFile, setReceiptFile] = useState(null);
  const [savingCashflow, setSavingCashflow] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);
  const isExpense = cashflow.type === "expense";

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
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        source: "direct",
      });

      if (typeFilter) params.set("type", typeFilter);

      return `/api/sheets/cashflow?${params.toString()}`;
    },
    deps: [typeFilter],
    getItems: (data) => {
      if (data.summary) setSummary(data.summary);
      return data.cashflows || [];
    },
    getPagination: (data) => data.pagination || {},
  });

  useEffect(() => {
    refresh();
  }, [typeFilter]);

  function resetReceiptFile() {
    setReceiptFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }

  async function handleAddCashflow(e) {
    e.preventDefault();
    setFormError("");

    if (!cashflow.type.trim() || !String(cashflow.amount || "").trim() || !cashflow.note.trim()) {
      setFormError("Complete the type, nominal and transaction notes");
      return;
    }

    if (isExpense && !receiptFile) {
      setFormError("Expenses must include receipts/notes/proof of purchase");
      return;
    }

    if (!isExpense) {
      await addCashflow(e);
      await refresh();
      setShowRecordForm(false);
      return;
    }

    setSavingCashflow(true);

    try {
      const formData = new FormData();
      formData.append("type", cashflow.type);
      formData.append("amount", cashflow.amount);
      formData.append("note", cashflow.note);
      formData.append("receipt", receiptFile);

      const res = await fetch("/api/sheets/cashflow", {
        method: "POST",
        headers: {
          "x-csrf-token": getCookie("csrf_token"),
        },
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to record transaction");
      }

      setCashflow({ type: "", amount: "", note: "" });
      resetReceiptFile();
      await refresh();
      setShowRecordForm(false);
      showToast("Transaction successfully recorded", "success");
    } catch (err) {
      const message = err.message || "Failed to record transaction";
      setFormError(message);
      showToast(message, "error");
    } finally {
      setSavingCashflow(false);
    }
  }

  return (
    <>
      <Toast show={!!toast} type={toast?.type} message={toast?.message} />

      <div className="admin-card">
        <div style={styles.header}>
          <div>
            <h3 style={styles.title}>Direct Cashflow</h3>
            <div style={styles.helperText}>
              Record direct income or expenses outside of resident payments.
            </div>
          </div>

          <button
            type="button"
            style={styles.collapseButton}
            aria-label={showRecordForm ? "Collapse cashflow form" : "Expand cashflow form"}
            aria-expanded={showRecordForm}
            onClick={() => setShowRecordForm((prev) => !prev)}
          >
            {showRecordForm ? "▴" : "▾"}
          </button>
        </div>

        {showRecordForm && (
          <form onSubmit={handleAddCashflow} className="admin-form">
            <select
              className="admin-input"
              value={cashflow.type}
              onChange={(e) => {
                const nextType = e.target.value;
                setCashflow({ ...cashflow, type: nextType });

                if (nextType !== "expense") resetReceiptFile();
              }}
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
              onChange={(e) => setCashflow({ ...cashflow, amount: e.target.value })}
            />

            <input
              className="admin-input"
              placeholder="Description"
              value={cashflow.note}
              onChange={(e) => setCashflow({ ...cashflow, note: e.target.value })}
            />

            {isExpense && (
              <label style={styles.fileLabel}>
                <span>Receipt / note / proof of purchase</span>
                <input
                  ref={fileInputRef}
                  className="admin-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                />
                <small style={styles.helperText}>Required for expenses. JPG, PNG, WEBP, or PDF format. Maximum 5MB.</small>
              </label>
            )}

            {formError && <div className="admin-error-box">{formError}</div>}

            <button className="admin-btn" disabled={loadingCashflow || savingCashflow}>
              <LoadingButtonContent loading={loadingCashflow || savingCashflow} loadingText="Recording...">
                Record Transaction
              </LoadingButtonContent>
            </button>
          </form>
        )}

        <div style={styles.summaryGrid}>
          <SummaryCard label="Direct Income" value={summary.income} type="income" />
          <SummaryCard label="Direct Expense" value={summary.expense} type="expense" />
        </div>

        <div style={styles.toolbar}>
          <select
            className="admin-input"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All Transactions</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </div>

        {error && <div className="admin-error-box">{error}</div>}
        <div style={styles.metaBar}>{items.length} / {total} loaded</div>

        {loading ? (
          <p>Loading cashflow...</p>
        ) : items.length === 0 ? (
          <div className="admin-empty-state">Direct cashflow is not yet available.</div>
        ) : (
          <>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th className="admin-th">Date</th>
                    <th className="admin-th">Type</th>
                    <th className="admin-th">Amount</th>
                    <th className="admin-th" style={styles.left}>Description</th>
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
                        <td className="admin-td"><TypeLabel type={item.type} /></td>
                        <td className="admin-td" style={isIncome ? styles.amountIncome : styles.amountExpense}>
                          {money(item.amount)}
                        </td>
                        <td className="admin-td" style={styles.left}>{formatCashflowNote(item.note)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div ref={loaderRef} style={styles.loaderSentinel}>
              {loadingMore ? "Loading more..." : hasMore ? "Scroll to load more" : "All transactions loaded"}
            </div>
          </>
        )}
      </div>

      {selectedItem && (
        <div className={modalStyles.overlay} onClick={() => setSelectedItem(null)}>
          <div className={modalStyles.box} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>Direct Transaction Detail</div>
            <div style={styles.modalGrid}>
              <DetailRow label="Date" value={formatDate(selectedItem.date)} />
              <DetailRow label="Reference" value={selectedItem.ref_id} />
              <DetailRow label="Type" value={<TypeLabel type={selectedItem.type} />} />
              <DetailRow
                label="Amount"
                value={money(selectedItem.amount)}
                strongStyle={selectedItem.type === "income" ? styles.amountIncome : styles.amountExpense}
              />
              <DetailRow label="Description" value={formatCashflowNote(selectedItem.note)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  title: { margin: 0 },
  collapseButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    padding: 0,
    border: "none",
    borderRadius: 8,
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    font: "inherit",
    fontSize: 18,
    fontWeight: 900,
    lineHeight: 1,
  },
  helperText: {
    marginTop: 6,
    color: "var(--admin-muted)",
    fontSize: 13,
    lineHeight: 1.6,
  },
  fileLabel: {
    display: "grid",
    gap: 6,
    color: "var(--admin-muted)",
    fontSize: 13,
    fontWeight: 700,
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
  label: { fontSize: 12, fontWeight: 700, color: "var(--admin-muted)", marginBottom: 8 },
  incomeValue: { color: "var(--admin-income)", fontWeight: 800, fontSize: 22 },
  expenseValue: { color: "var(--admin-expense)", fontWeight: 800, fontSize: 22 },
  toolbar: { marginBottom: 12 },
  metaBar: { marginBottom: 10, color: "var(--admin-muted)", fontSize: 12, fontWeight: 700 },
  typeIncome: { color: "var(--admin-income)", fontWeight: 700, textTransform: "capitalize" },
  typeExpense: { color: "var(--admin-expense)", fontWeight: 700, textTransform: "capitalize" },
  amountIncome: { color: "var(--admin-income)", fontWeight: 800 },
  amountExpense: { color: "var(--admin-expense)", fontWeight: 800 },
  left: { textAlign: "left" },
  loaderSentinel: {
    padding: "14px 0 4px",
    color: "var(--admin-muted)",
    fontSize: 12,
    fontWeight: 700,
    textAlign: "center",
  },
  modalTitle: { fontSize: 24, fontWeight: 800, marginBottom: 18, color: "var(--admin-text)" },
  modalGrid: { display: "grid", gap: 12 },
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