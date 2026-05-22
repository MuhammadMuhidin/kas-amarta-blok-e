"use client";

import modalStyles from "@/components/admin/AdminModal.module.css";
import { useMemo, useState } from "react";

const pageSize = 10;

function formatRupiah(value) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
}

function getDelta(current, previous) {
  const diff = Number(current || 0) - Number(previous || 0);

  if (diff === 0) {
    return {
      value: 0,
      label: "Stable",
      color: "var(--admin-muted)",
    };
  }

  return {
    value: Math.abs(diff),
    label: diff > 0 ? "↑" : "↓",
    color: diff > 0 ? "#dc2626" : "#16a34a",
  };
}

function DetailRow({ label, value, valueStyle }) {
  return (
    <div style={styles.modalRow}>
      <span style={styles.modalLabel}>{label}</span>
      <b style={{ ...styles.modalValue, ...valueStyle }}>{value || "-"}</b>
    </div>
  );
}

export default function SummaryBackupTab({
  loadingSummary,
  summaryBackup,
}) {
  const [page, setPage] = useState(1);
  const [selectedBackup, setSelectedBackup] = useState(null);

  const totalPages = Math.max(
    1,
    Math.ceil((summaryBackup?.length || 0) / pageSize),
  );

  const currentPage = Math.min(page, totalPages);

  const pagedSummary = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return (summaryBackup || []).slice(start, start + pageSize);
  }, [summaryBackup, currentPage]);

  const latest = summaryBackup?.[0];

  return (
    <div className="admin-card">
      <div className="admin-summary-header">
        <h3>Summary Backup</h3>
      </div>

      {loadingSummary ? (
        <p>Loading summary...</p>
      ) : !summaryBackup?.length ? (
        <div className="admin-empty-state">
          Backup summary belum tersedia.
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
              gap: 12,
              marginBottom: 18,
            }}
          >
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Latest Income</div>
              <div style={styles.summaryValue}>
                {formatRupiah(latest?.total_income)}
              </div>
            </div>

            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Latest Expense</div>
              <div style={styles.summaryValue}>
                {formatRupiah(latest?.total_expense)}
              </div>
            </div>

            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Latest Net</div>
              <div
                style={{
                  ...styles.summaryValue,
                  color:
                    Number(latest?.net_saldo || 0) >= 0
                      ? "#16a34a"
                      : "#dc2626",
                }}
              >
                {formatRupiah(latest?.net_saldo)}
              </div>
            </div>

            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Active Personal</div>
              <div style={styles.summaryValue}>
                {latest?.total_personal_active || 0}
              </div>
            </div>
          </div>

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="admin-th">Date</th>
                  <th className="admin-th">Income</th>
                  <th className="admin-th">Expense</th>
                  <th className="admin-th">Net</th>
                  <th className="admin-th">Personal Active</th>
                </tr>
              </thead>

              <tbody>
                {pagedSummary.map((x, i) => {
                  const originalIndex =
                    (currentPage - 1) * pageSize + i;
                  const prev = summaryBackup[originalIndex + 1];

                  const netDelta = getDelta(
                    x.net_saldo,
                    prev?.net_saldo,
                  );

                  const expenseDelta = getDelta(
                    x.total_expense,
                    prev?.total_expense,
                  );

                  return (
                    <tr
                      key={`${x.created_at || "summary"}-${originalIndex}`}
                      className={i % 2 ? "admin-row-alt" : ""}
                      onClick={() => setSelectedBackup(x)}
                      style={{
                        cursor: "pointer",
                        ...(originalIndex === 0
                          ? {
                              borderLeft:
                                "4px solid var(--admin-primary)",
                            }
                          : {}),
                      }}
                    >
                      <td className="admin-td">
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <span>{x.created_at}</span>

                          {originalIndex === 0 && (
                            <span style={styles.latestBadge}>
                              Latest
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="admin-td">
                        {formatRupiah(x.total_income)}
                      </td>

                      <td className="admin-td">
                        <div>
                          <div>
                            {formatRupiah(x.total_expense)}
                          </div>

                          {prev && (
                            <div
                              style={{
                                fontSize: 11,
                                marginTop: 4,
                                color: expenseDelta.color,
                                fontWeight: 700,
                              }}
                            >
                              {expenseDelta.label} {formatRupiah(expenseDelta.value)}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="admin-td">
                        <div>
                          <div
                            style={{
                              color:
                                Number(x.net_saldo || 0) >= 0
                                  ? "#16a34a"
                                  : "#dc2626",
                              fontWeight: 700,
                            }}
                          >
                            {formatRupiah(x.net_saldo)}
                          </div>

                          {prev && (
                            <div
                              style={{
                                fontSize: 11,
                                marginTop: 4,
                                color: netDelta.color,
                                fontWeight: 700,
                              }}
                            >
                              {netDelta.label} {formatRupiah(netDelta.value)}
                            </div>
                          )}
                        </div>
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

          <div style={styles.pagination}>
            <button
              type="button"
              className="admin-small-btn"
              disabled={currentPage <= 1}
              style={styles.pageButton}
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            >
              Prev
            </button>

            <span style={styles.pageInfo}>
              {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              className="admin-small-btn"
              disabled={currentPage >= totalPages}
              style={styles.pageButton}
              onClick={() =>
                setPage((prev) => Math.min(prev + 1, totalPages))
              }
            >
              Next
            </button>
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
                <p style={styles.modalSubtitle}>{selectedBackup.created_at}</p>
              </div>

              <button
                type="button"
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
              />

              <DetailRow
                label="Expense"
                value={formatRupiah(selectedBackup.total_expense)}
              />

              <DetailRow
                label="Net"
                value={formatRupiah(selectedBackup.net_saldo)}
                valueStyle={{
                  color:
                    Number(selectedBackup.net_saldo || 0) >= 0
                      ? "#16a34a"
                      : "#dc2626",
                }}
              />

              <DetailRow
                label="Member Active"
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

  latestBadge: {
    padding: "3px 8px",
    borderRadius: 999,
    background: "rgba(37,99,235,.12)",
    color: "#2563eb",
    fontSize: 11,
    fontWeight: 800,
  },

  pagination: {
    display: "grid",
    gridTemplateColumns: "minmax(72px,1fr) auto minmax(72px,1fr)",
    alignItems: "center",
    gap: 10,
    width: "100%",
    marginTop: 12,
  },

  pageButton: {
    width: "100%",
    minWidth: 0,
    height: 40,
    padding: "8px 10px",
    whiteSpace: "nowrap",
  },

  pageInfo: {
    minWidth: 54,
    textAlign: "center",
    whiteSpace: "nowrap",
    fontWeight: 800,
    color: "var(--admin-text)",
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