"use client";

import AdminSubtabs from "@/components/admin/AdminSubtabs";
import LoadingButtonContent from "@/components/admin/LoadingButtonContent";
import Toast from "@/components/Toast";
import modalStyles from "@/components/admin/AdminModal.module.css";
import useInfiniteRows from "@/components/admin/useInfiniteRows";
import { useRef, useState } from "react";

const pageSize = 10;
const money = (value) => `Rp${Number(value || 0).toLocaleString("id-ID")}`;

function formatDate(date) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatPeriod(period) {
  if (!period || period === "-") return "-";
  const normalized = String(period).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(normalized)) return period;
  return new Date(`${normalized}-01`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatCashflowNote(note) {
  if (!note) return "-";
  return String(note).replace(/\b(\d{4}-\d{2})(?:-\d{2})?\b/g, (_, period) => (
    formatPeriod(period)
  ));
}

function getCookie(name) {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}

function TypeLabel({ type }) {
  return (
    <span style={type === "income" ? styles.typeIncome : styles.typeExpense}>
      {type}
    </span>
  );
}

function SummaryCard({ label, value, type }) {
  return (
    <div className="cashflow-summary-card" style={styles.card}>
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

function RecordTransactionPanel({
  addCashflow,
  cashflow,
  setCashflow,
  loadingCashflow,
  onRecorded,
  showToast,
}) {
  const [receiptFile, setReceiptFile] = useState(null);
  const [savingCashflow, setSavingCashflow] = useState(false);
  const [formError, setFormError] = useState("");
  const fileInputRef = useRef(null);
  const isExpense = cashflow.type === "expense";

  function resetReceiptFile() {
    setReceiptFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleAddCashflow(event) {
    event.preventDefault();
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
      try {
        await addCashflow(event);
        onRecorded();
      } catch (error) {
        setFormError(error.message || "Failed to record transaction");
      }
      return;
    }

    setSavingCashflow(true);
    try {
      const formData = new FormData();
      formData.append("type", cashflow.type);
      formData.append("amount", cashflow.amount);
      formData.append("note", cashflow.note);
      formData.append("receipt", receiptFile);

      const response = await fetch("/api/sheets/cashflow", {
        method: "POST",
        headers: { "x-csrf-token": getCookie("csrf_token") },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to record transaction");

      setCashflow({ type: "", amount: "", note: "" });
      resetReceiptFile();
      showToast("Transaction successfully recorded", "success");
      onRecorded();
    } catch (error) {
      const message = error.message || "Failed to record transaction";
      setFormError(message);
      showToast(message, "error");
    } finally {
      setSavingCashflow(false);
    }
  }

  return (
    <div id="cashflow-record-panel" role="tabpanel" className="admin-card">
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>Record Direct Transaction</h3>
          <div style={styles.helperText}>
            Record direct income or expenses outside resident payments.
          </div>
        </div>
      </div>

      <form onSubmit={handleAddCashflow} className="admin-form">
        <select
          className="admin-input"
          value={cashflow.type}
          onChange={(event) => {
            const nextType = event.target.value;
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
          onChange={(event) => setCashflow({ ...cashflow, amount: event.target.value })}
        />

        <input
          className="admin-input"
          placeholder="Description"
          value={cashflow.note}
          onChange={(event) => setCashflow({ ...cashflow, note: event.target.value })}
        />

        {isExpense && (
          <label className="cashflow-receipt-panel" style={styles.fileLabel}>
            <span>Receipt / note / proof of purchase</span>
            <input
              ref={fileInputRef}
              className="admin-input"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(event) => setReceiptFile(event.target.files?.[0] || null)}
            />
            {receiptFile && (
              <small className="cashflow-receipt-file-name">
                Selected file: {receiptFile.name}
              </small>
            )}
            <small style={styles.helperText}>
              Required for expenses. JPG, PNG, WEBP, or PDF format. Maximum 5MB.
            </small>
          </label>
        )}

        {formError && <div className="admin-error-box">{formError}</div>}

        <button className="admin-btn" disabled={loadingCashflow || savingCashflow}>
          <LoadingButtonContent
            loading={loadingCashflow || savingCashflow}
            loadingText="Recording..."
          >
            Record Transaction
          </LoadingButtonContent>
        </button>
      </form>
    </div>
  );
}

function TransactionHistoryPanel() {
  const [typeFilter, setTypeFilter] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [summary, setSummary] = useState({ income: 0, expense: 0 });

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

  return (
    <div id="cashflow-history-panel" role="tabpanel" className="admin-card">
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>Transaction History</h3>
          <div style={styles.helperText}>
            Browse direct income and expense records. Click a row for details.
          </div>
        </div>
        <button
          type="button"
          className="admin-small-btn admin-refresh-btn"
          disabled={loading || loadingMore}
          onClick={refresh}
        >
          Refresh
        </button>
      </div>

      <div style={styles.summaryGrid}>
        <SummaryCard label="Direct Income" value={summary.income} type="income" />
        <SummaryCard label="Direct Expense" value={summary.expense} type="expense" />
      </div>

      <div style={styles.toolbar}>
        <select
          className="admin-input"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
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
                      className={index % 2
                        ? "admin-row-alt admin-clickable-row"
                        : "admin-clickable-row"}
                      onClick={() => setSelectedItem(item)}
                    >
                      <td className="admin-td">{formatDate(item.date)}</td>
                      <td className="admin-td"><TypeLabel type={item.type} /></td>
                      <td
                        className="admin-td"
                        style={isIncome ? styles.amountIncome : styles.amountExpense}
                      >
                        {money(item.amount)}
                      </td>
                      <td className="admin-td" style={styles.left}>
                        {formatCashflowNote(item.note)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div
            ref={loaderRef}
            className={loadingMore
              ? "admin-loader-sentinel admin-loader-sentinel-loading"
              : "admin-loader-sentinel"}
            style={styles.loaderSentinel}
          >
            {loadingMore
              ? "Loading more"
              : hasMore
                ? "Scroll to load more"
                : "All transactions loaded"}
          </div>
        </>
      )}

      {selectedItem && (
        <div className={modalStyles.overlay} onClick={() => setSelectedItem(null)}>
          <div className={modalStyles.box} onClick={(event) => event.stopPropagation()}>
            <div style={styles.modalTitle}>Direct Transaction Detail</div>
            <div style={styles.modalGrid}>
              <DetailRow label="Date" value={formatDate(selectedItem.date)} />
              <DetailRow label="Reference" value={selectedItem.ref_id} />
              <DetailRow label="Type" value={<TypeLabel type={selectedItem.type} />} />
              <DetailRow
                label="Amount"
                value={money(selectedItem.amount)}
                strongStyle={selectedItem.type === "income"
                  ? styles.amountIncome
                  : styles.amountExpense}
              />
              <DetailRow
                label="Description"
                value={formatCashflowNote(selectedItem.note)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CashflowTab(props) {
  const [activePanel, setActivePanel] = useState("record");
  const [historyVersion, setHistoryVersion] = useState(0);
  const [toast, setToast] = useState(null);

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }

  function handleRecorded() {
    setHistoryVersion((value) => value + 1);
    setActivePanel("history");
  }

  return (
    <>
      <Toast show={Boolean(toast)} type={toast?.type} message={toast?.message} />
      <AdminSubtabs
        value={activePanel}
        onChange={setActivePanel}
        ariaLabel="Cashflow navigation"
        items={[
          { value: "record", label: "Record Transaction", panelId: "cashflow-record-panel" },
          { value: "history", label: "Transaction History", panelId: "cashflow-history-panel" },
        ]}
      />

      {activePanel === "record" && (
        <RecordTransactionPanel
          {...props}
          onRecorded={handleRecorded}
          showToast={showToast}
        />
      )}
      {activePanel === "history" && (
        <TransactionHistoryPanel key={historyVersion} />
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
    flexWrap: "wrap",
  },
  title: { margin: 0 },
  helperText: {
    color: "var(--admin-muted)",
    fontSize: 12,
    lineHeight: 1.45,
  },
  fileLabel: {
    display: "grid",
    gap: 8,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
    gap: 12,
    marginBottom: 14,
  },
  card: {
    padding: 14,
    border: "1px solid var(--admin-border)",
    borderRadius: 14,
    background: "var(--admin-row)",
  },
  label: {
    color: "var(--admin-muted)",
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 6,
  },
  incomeValue: {
    color: "var(--admin-income)",
    fontSize: 22,
    fontWeight: 900,
  },
  expenseValue: {
    color: "var(--admin-expense)",
    fontSize: 22,
    fontWeight: 900,
  },
  typeIncome: {
    color: "var(--admin-income)",
    fontWeight: 800,
    textTransform: "capitalize",
  },
  typeExpense: {
    color: "var(--admin-expense)",
    fontWeight: 800,
    textTransform: "capitalize",
  },
  toolbar: {
    display: "grid",
    gridTemplateColumns: "minmax(0,260px)",
    gap: 10,
    marginBottom: 10,
  },
  metaBar: {
    margin: "10px 0",
    color: "var(--admin-muted)",
    fontSize: 12,
    fontWeight: 700,
  },
  left: { textAlign: "left" },
  amountIncome: { color: "var(--admin-income)", fontWeight: 800 },
  amountExpense: { color: "var(--admin-expense)", fontWeight: 800 },
  loaderSentinel: {
    padding: "14px 0 4px",
    color: "var(--admin-muted)",
    fontSize: 12,
    fontWeight: 700,
    textAlign: "center",
  },
  modalTitle: {
    marginBottom: 14,
    fontSize: 20,
    fontWeight: 900,
  },
  modalGrid: { display: "grid", gap: 10 },
  modalRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 0",
    borderBottom: "1px solid var(--admin-border)",
  },
};
