export default function SummaryBackupTab({
  loadingSummary,
  summaryBackup,
}) {
  return (
    <div className="admin-card">
      <div className="admin-summary-header">
        <h3>Summary Backup</h3>
      </div>

      {loadingSummary ? (
        <p>Loading summary...</p>
      ) : (
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
              {summaryBackup.map((x, i) => (
                <tr key={i} className={i % 2 ? "admin-row-alt" : ""}>
                  <td className="admin-td">{x.created_at}</td>
                  <td className="admin-td">
                    Rp{Number(x.total_income || 0).toLocaleString()}
                  </td>
                  <td className="admin-td">
                    Rp{Number(x.total_expense || 0).toLocaleString()}
                  </td>
                  <td className="admin-td">
                    Rp{Number(x.net_saldo || 0).toLocaleString()}
                  </td>
                  <td className="admin-td">
                    {x.total_personal_active}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
