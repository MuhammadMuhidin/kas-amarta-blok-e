function StatusCard({ label, value, meta = [], error = false }) {
  return (
    <div className="admin-status-card">
      <div className="admin-status-label">{label}</div>
      <div className={error ? "admin-status-error" : "admin-status-value"}>
        {value}
      </div>
      {meta.map((item) => (
        <div key={item} className="admin-status-meta">
          {item}
        </div>
      ))}
    </div>
  );
}

function IssueTable({ title, rows, columns }) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="admin-monitor-detail">
      <h3>{title}</h3>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} className="admin-th">
                  {column === "detail" ? "Issue" : column}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={i % 2 ? "admin-row-alt" : ""}>
                {columns.map((column) => (
                  <td key={column} className="admin-td admin-issue-text">
                    {row[column]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function MonitoringTab({
  loadingDailyBackup,
  dailyBackup,
  paymentCashflowIntegrity,
  trashMismatch,
  suspiciousData,
}) {
  return (
    <div className="admin-card">
      <div className="admin-monitor-grid">
        <StatusCard
          label="Daily Backup Status"
          value={
            loadingDailyBackup
              ? "Checking..."
              : dailyBackup?.ok
                ? dailyBackup.name
                : "Backup file not found"
          }
          meta={
            dailyBackup?.ok
              ? [
                  `Last created: ${dailyBackup.created_at}`,
                  `Retention: ${dailyBackup?.count} backup files`,
                ]
              : []
          }
          error={!loadingDailyBackup && !dailyBackup?.ok}
        />

        <StatusCard
          label="Payment Cashflow Integrity"
          value={`${paymentCashflowIntegrity.length} issue`}
          meta={[
            paymentCashflowIntegrity.length === 0
              ? "No issue detected"
              : "Need review",
          ]}
        />

        <StatusCard
          label="Trash Payment Integrity"
          value={`${trashMismatch.length} issue`}
          meta={[
            trashMismatch.length === 0
              ? "No issue detected"
              : "Need review",
          ]}
        />

        <StatusCard
          label="Data Quality Check"
          value={`${suspiciousData.length} issue`}
          meta={[
            suspiciousData.length === 0
              ? "No suspicious data"
              : "Need review",
          ]}
        />
      </div>

      <IssueTable
        title="Payment Cashflow Integrity"
        rows={paymentCashflowIntegrity}
        columns={["house", "name", "period", "type", "detail"]}
      />

      <IssueTable
        title="Trash Payment Integrity"
        rows={trashMismatch}
        columns={["house", "name", "period", "detail"]}
      />

      <IssueTable
        title="Suspicious Data"
        rows={suspiciousData}
        columns={["sheet", "row", "type", "detail"]}
      />
    </div>
  );
}
