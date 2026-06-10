"use client";

import modalStyles from "@/components/admin/AdminModal.module.css";
import useInfiniteRows from "@/components/admin/useInfiniteRows";
import { formatJakartaDateTimeLong } from "@/lib/localDate";
import { useState } from "react";

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

export default function SummaryBackupTab() {
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
    buildUrl: ({ page, limit }) =>
      `/api/summary-backup?page=${page}&limit=${limit}`,
    deps: [],
    getItems: (data) => data.summary || [],
    getPagination: (data) => data.pagination || {},
  });

  const latest = summaryBackup?.[0];
  const previous = summaryBackup?.[1];

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
    ? getDelta(
        latest?.total_personal_active,
        previous?.total_personal_active,
        { increaseIsGood: true },
      )
    : null;

  return (
    <div className="admin-card">
      <div className="admin-summary-header">
        <h3>Summary Backup</h3>

        <button
          type="button"
          className="admin-small-btn admin-refresh-btn"
          disabled={loading || loadingMore}
          onClick={refresh}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && <div className="admin-error-box">{error}</div>}

      {loading ? (
        <p>Loading summary...</p>
      ) : !summaryBackup?.length ? (
        <div className="admin-empty-state">
          Backup summary is not available yet.
        </div>
      ) : (
        <>
          <div style={styles.summaryGrid}>
            <SummaryCard
              label="Latest Income"
              value={formatRupiah(latest?.total_income)}
              valueColor={incomeColor}
              delta={
                incomeDelta && {
                  ...incomeDelta,
                  value: formatRupiah(incomeDelta.value),
                }
              }
            />

            <SummaryCard
              label="Latest Expense"
              value={formatRupiah(latest?.total_expense)}
              valueColor={expenseColor}
              delta={
                expenseDelta && {
                  ...expenseDelta,
                  value: formatRupiah(expenseDelta.value),
                }
              }
            />

            <SummaryCard
              label="Latest Net"
              value={formatRupiah(latest?.net_saldo)}
              valueColor={
                Number(latest?.net_saldo || 0) >= 0
                  ? successColor
                  : expenseColor
              }
              delta={
                netDelta && {
                  ...netDelta,
                  value: formatRupiah(netDelta.value),
                }
              }
            />

            <SummaryCard
              label="Active Members"
              value={latest?.total_personal_active || 0}
              delta={activeDelta}
            />
          </div>

          <div style={styles.metaBar}>
            <span>{summaryBackup.length} / {total} loaded</span>
            <span>Scroll to load more data</span>
          </div>

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
                {summaryBackup.map((x, i) => {
                  const rowClassName = [
                    i % 2 ? "admin-row-alt" : "",
                    "admin-clickable-row",
                    i === 0 ? "summary-backup-latest-row" : "",
                  ].filter(Boolean).join(" ");

                  return (
                    <tr
                      key={`${x.created_at || "summary"}-${i}`}
                      className={rowClassName}
                      onClick={() => setSelectedBackup(x)}
                    >
                      <td className="admin-td">
                        <div style={styles.dateCell}>
                          <span>{formatBackupDate(x.created_at)}</span>

                          {i === 0 && (
                            <span style={styles.latestBadge}>Latest</span>
                          )}
                        </div>
                      </td>

                      <td className="admin-td">
                        <span
                          style={{
                            color:
                              Number(x.net_saldo || 0) >= 0
                                ? successColor
                                : expenseColor,
                            fontWeight: 700,
                          }}
                        >
                          {formatRupiah(x.net_saldo)}
                        </span>
                      </td>

                      <td className="admin-td">
                        {x.total_personal_active}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div
            ref={loaderRef}
            className={loadingMore ? "admin-loader-sentinel admin-loader-sentinel-loading" : "admin-loader-sentinel"}
            style={styles.loaderSentinel}
          >
            {loadingMore
              ? "Loading more"
              : hasMore
                ? "Scroll to load more"
                : "All summaries loaded"}
          </div>
        </>
      )}

      {selectedBackup && (
        <div
          className={modalStyles.overlay}
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedBackup(null)}
        >
          <div
            className={modalStyles.box}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Summary Backup Detail</h3>
                <p style={styles.modalSubtitle}>{formatBackupDate(selectedBackup.created_at)}</p>
              </div>

              <button
                type="button"
                className="admin-refresh-btn"
                style={styles.closeButton}
                onClick={() => setSelectedBackup(null)}
              >
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <DetailRow
                label="Income"
                value={formatRupiah(selectedBackup.total_income)}
                valueStyle={{ color: incomeColor }}
              />

              <DetailRow
                label="Expense"
                value={formatRupiah(selectedBackup.total_expense)}
                valueStyle={{ color: expenseColor }}
              />

              <DetailRow
                label="Net"
                value={formatRupiah(selectedBackup.net_saldo)}
                valueStyle={{
                  color:
                    Number(selectedBackup.net_saldo || 0) >= 0
                      ? successColor
                      : expenseColor,
                }}
              />

              <DetailRow
                label="Active Members"
                value={selectedBackup.total_personal_active}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
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
    color: "var(--admin-text)",
    lineHeight: 1.1,
  },

  summaryDelta: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: 800,
  },

  metaBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
    color: "var(--admin-muted)",
    fontSize: 12,
    fontWeight: 700,
  },

  dateCell: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },

  latestBadge: {
    padding: "3px 8px",
    borderRadius: 999,
    background: "var(--admin-primary-soft)",
    color: "var(--admin-primary)",
    fontSize: 11,
    fontWeight: 800,
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

  modalBody: {
    display: "grid",
    gap: 10,
  },

  modalRow: {
    display: "grid",
    gridTemplateColumns: "120px 1fr",
    gap: 12,
    padding: "12px 13px",
    border: "1px solid var(--admin-border)",
    borderRadius: 14,
    background: "var(--admin-row)",
  },

  modalLabel: {
    color: "var(--admin-muted)",
    fontSize: 12,
    fontWeight: 700,
  },

  modalValue: {
    color: "var(--admin-text)",
    fontSize: 13,
    lineHeight: 1.45,
    wordBreak: "break-word",
  },
};
