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

export default function SummaryBackupTab({
  loadingSummary,
  summaryBackup,
}) {
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
                {summaryBackup.map((x, i) => {
                  const prev = summaryBackup[i + 1];

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
                      key={i}
                      className={i % 2 ? "admin-row-alt" : ""}
                      style={
                        i === 0
                          ? {
                              borderLeft:
                                "4px solid var(--admin-primary)",
                            }
                          : undefined
                      }
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

                          {i === 0 && (
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
        </>
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
};