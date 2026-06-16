"use client";

import AdminSubtabs from "@/components/admin/AdminSubtabs";
import AdminDataSkeleton from "@/components/admin/AdminDataSkeleton";
import modalStyles from "@/components/admin/AdminModal.module.css";
import useInfiniteRows from "@/components/admin/useInfiniteRows";
import { formatJakartaDateTimeLong } from "@/lib/localDate";
import { useEffect, useState } from "react";

const pageSize = 10;
const incomeColor = "var(--admin-income)";
const expenseColor = "var(--admin-expense)";
const successColor = "var(--admin-success)";

function formatRupiah(value) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
}

function formatBackupDate(value) {
  return value ? `${formatJakartaDateTimeLong(value, "id-ID")} WIB` : "-";
}

function getDelta(current, previous, { increaseIsGood = true } = {}) {
  const diff = Number(current || 0) - Number(previous || 0);
  if (diff === 0) {
    return {
      value: 0,
      label: "Stable",
      color: "var(--admin-muted)",
      tone: "stable",
    };
  }
  const isIncrease = diff > 0;
  const isGood = increaseIsGood ? isIncrease : !isIncrease;
  return {
    value: Math.abs(diff),
    label: isIncrease ? "↑" : "↓",
    color: isGood ? successColor : expenseColor,
    tone: isGood ? "good" : "bad",
  };
}

function SummaryCard({ label, value, delta, valueColor }) {
  const deltaClassName = delta?.tone
    ? `summary-backup-delta summary-backup-delta-${delta.tone}`
    : "summary-backup-delta";
  return (
    <div className="summary-backup-card" style={styles.summaryCard}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={{ ...styles.summaryValue, color: valueColor || "var(--admin-text)" }}>
        {value}
      </div>
      {delta && (
        <div className={deltaClassName} style={{ ...styles.summaryDelta, color: delta.color }}>
          {delta.label === "Stable"
            ? "Stable from previous backup"
            : `${delta.label} ${delta.value}`}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, valueStyle }) {
  return (
    <div className="summary-backup-modal-row" style={styles.modalRow}>
      <span style={styles.modalLabel}>{label}</span>
      <b style={{ ...styles.modalValue, ...valueStyle }}>{value || "-"}</b>
    </div>
  );
}

function BackupDetailModal({ backup, onClose }) {
  if (!backup) return null;
  return (
    <div
      className={modalStyles.overlay}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className={modalStyles.box} onClick={(event) => event.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <h3 style={styles.modalTitle}>Summary Backup Detail</h3>
            <p style={styles.modalSubtitle}>{formatBackupDate(backup.created_at)}</p>
          </div>
          <button
            type="button"
            className="admin-refresh-btn"
            style={styles.closeButton}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div style={styles.modalBody}>
          <DetailRow
            label="Income"
            value={formatRupiah(backup.total_income)}
            valueStyle={{ color: incomeColor }}
          />
          <DetailRow
            label="Expense"
            value={formatRupiah(backup.total_expense)}
            valueStyle={{ color: expenseColor }}
          />
          <DetailRow
            label="Net"
            value={formatRupiah(backup.net_saldo)}
            valueStyle={{
              color: Number(backup.net_saldo || 0) >= 0 ? successColor : expenseColor,
            }}
          />
          <DetailRow label="Active Members" value={backup.total_personal_active} />
        </div>
      </div>
    </div>
  );
}

function SnapshotPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    fetch("/api/summary-backup?page=1&limit=2", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load backup snapshot");
        return data;
      })
      .then((data) => setRows(data.summary || []))
      .catch((fetchError) => {
        if (fetchError.name !== "AbortError") {
          setError(fetchError.message || "Failed to load backup snapshot");
          setRows([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [version]);

  const latest = rows[0];
  const previous = rows[1];
  const incomeDelta = previous
    ? getDelta(latest?.total_income, previous?.total_income, { increaseIsGood: true })
    : null;
  const expenseDelta = previous
    ? getDelta(latest?.total_expense, previous?.total_expense, { increaseIsGood: false })
    : null;
  const netDelta = previous
    ? getDelta(latest?.net_saldo, previous?.net_saldo, { increaseIsGood: true })
    : null;
  const activeDelta = previous
    ? getDelta(latest?.total_personal_active, previous?.total_personal_active, {
        increaseIsGood: true,
      })
    : null;

  return (
    <div id="summary-snapshot-panel" role="tabpanel" className="admin-card">
      <div className="admin-summary-header">
        <div>
          <h3 style={{ marginBottom: 4 }}>Latest Snapshot</h3>
          <div style={styles.helperText}>
            Loads only the latest two records for a lightweight comparison.
          </div>
        </div>
        <button
          type="button"
          className="admin-small-btn admin-refresh-btn"
          disabled={loading}
          onClick={() => setVersion((value) => value + 1)}
        >
          Refresh
        </button>
      </div>

      {error && <div className="admin-error-box">{error}</div>}
      {loading ? (
        <AdminDataSkeleton cards={4} rows={0} />
      ) : !latest ? (
        <div className="admin-empty-state">Backup summary is not available yet.</div>
      ) : (
        <>
          <div style={styles.summaryGrid}>
            <SummaryCard
              label="Latest Income"
              value={formatRupiah(latest.total_income)}
              valueColor={incomeColor}
              delta={incomeDelta && { ...incomeDelta, value: formatRupiah(incomeDelta.value) }}
            />
            <SummaryCard
              label="Latest Expense"
              value={formatRupiah(latest.total_expense)}
              valueColor={expenseColor}
              delta={expenseDelta && { ...expenseDelta, value: formatRupiah(expenseDelta.value) }}
            />
            <SummaryCard
              label="Latest Net"
              value={formatRupiah(latest.net_saldo)}
              valueColor={Number(latest.net_saldo || 0) >= 0 ? successColor : expenseColor}
              delta={netDelta && { ...netDelta, value: formatRupiah(netDelta.value) }}
            />
            <SummaryCard
              label="Active Members"
              value={latest.total_personal_active || 0}
              delta={activeDelta}
            />
          </div>
          <div style={styles.snapshotMeta}>
            Latest backup: <strong>{formatBackupDate(latest.created_at)}</strong>
          </div>
        </>
      )}
    </div>
  );
}

function BackupHistoryPanel() {
  const [selectedBackup, setSelectedBackup] = useState(null);
  const {
    items: summaryBackup,
    total,
    loading,
    loadingMore,
    error,
    hasMore,
    loaderRef,
    refresh,
  } = useInfiniteRows({
    pageSize,
    buildUrl: ({ page, limit }) => `/api/summary-backup?page=${page}&limit=${limit}`,
    deps: [],
    getItems: (data) => data.summary || [],
    getPagination: (data) => data.pagination || {},
  });

  return (
    <div id="summary-history-panel" role="tabpanel" className="admin-card">
      <div className="admin-summary-header">
        <div>
          <h3 style={{ marginBottom: 4 }}>Backup History</h3>
          <div style={styles.helperText}>
            Historical records load only when this subtab is opened.
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

      {error && <div className="admin-error-box">{error}</div>}
      {loading && !summaryBackup.length ? (
        <AdminDataSkeleton showSummary={false} rows={6} />
      ) : !summaryBackup.length ? (
        <div className="admin-empty-state">Backup summary is not available yet.</div>
      ) : (
        <>
          <div style={styles.metaBar}>{total} backup records</div>
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="admin-th">Date</th>
                  <th className="admin-th">Net</th>
                  <th className="admin-th">Active Members</th>
                </tr>
              </thead>
              <tbody>
                {summaryBackup.map((row, index) => (
                  <tr
                    key={`${row.created_at || "summary"}-${index}`}
                    className={index % 2
                      ? "admin-row-alt admin-clickable-row"
                      : "admin-clickable-row"}
                    onClick={() => setSelectedBackup(row)}
                  >
                    <td className="admin-td">{formatBackupDate(row.created_at)}</td>
                    <td className="admin-td">
                      <span style={{
                        color: Number(row.net_saldo || 0) >= 0 ? successColor : expenseColor,
                        fontWeight: 700,
                      }}>
                        {formatRupiah(row.net_saldo)}
                      </span>
                    </td>
                    <td className="admin-td">{row.total_personal_active}</td>
                  </tr>
                ))}
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
            {loadingMore ? "Loading more" : hasMore ? "Scroll to load more" : ""}
          </div>
        </>
      )}

      <BackupDetailModal backup={selectedBackup} onClose={() => setSelectedBackup(null)} />
    </div>
  );
}

export default function SummaryBackupTab() {
  const [activePanel, setActivePanel] = useState("snapshot");

  return (
    <>
      <AdminSubtabs
        value={activePanel}
        onChange={setActivePanel}
        ariaLabel="Summary Backup navigation"
        items={[
          { value: "snapshot", label: "Latest Snapshot", panelId: "summary-snapshot-panel" },
          { value: "history", label: "Backup History", panelId: "summary-history-panel" },
        ]}
      />
      {activePanel === "snapshot" && <SnapshotPanel />}
      {activePanel === "history" && <BackupHistoryPanel />}
    </>
  );
}

const styles = {
  helperText: {
    color: "var(--admin-muted)",
    fontSize: 12,
    lineHeight: 1.45,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
    gap: 12,
    marginBottom: 18,
  },
  summaryCard: {
    border: "1px solid var(--admin-border)",
    background: "var(--admin-row)",
    borderRadius: 14,
    padding: 14,
  },
  summaryLabel: {
    fontSize: 12,
    color: "var(--admin-muted)",
    marginBottom: 8,
    fontWeight: 700,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 800,
    lineHeight: 1.1,
  },
  summaryDelta: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: 800,
  },
  snapshotMeta: {
    color: "var(--admin-muted)",
    fontSize: 12,
    fontWeight: 700,
  },
  metaBar: {
    marginBottom: 10,
    color: "var(--admin-muted)",
    fontSize: 12,
    fontWeight: 700,
  },
  loaderSentinel: {
    padding: "14px 0 4px",
    color: "var(--admin-muted)",
    fontSize: 12,
    fontWeight: 700,
    textAlign: "center",
  },
  modalHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  modalTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 800,
    color: "var(--admin-text)",
  },
  modalSubtitle: {
    margin: "5px 0 0",
    color: "var(--admin-muted)",
    fontSize: 13,
    fontWeight: 600,
  },
  closeButton: {
    width: 34,
    height: 34,
    border: "1px solid var(--admin-border)",
    borderRadius: 999,
    background: "var(--admin-row)",
    color: "var(--admin-text)",
    fontSize: 24,
    lineHeight: 1,
    cursor: "pointer",
  },
  modalBody: { display: "grid", gap: 10 },
  modalRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 0",
    borderBottom: "1px solid var(--admin-border)",
  },
  modalLabel: { color: "var(--admin-muted)", fontSize: 12, fontWeight: 700 },
  modalValue: { color: "var(--admin-text)", fontSize: 14, textAlign: "right" },
};
