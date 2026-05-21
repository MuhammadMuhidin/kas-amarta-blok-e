import LoadingButtonContent from "@/components/admin/LoadingButtonContent";

export default function CashflowTab({
  addCashflow,
  cashflow,
  setCashflow,
  loadingCashflow,
}) {
  return (
    <div className="admin-card">
      <h3>Cashflow</h3>
      <form onSubmit={addCashflow} className="admin-form">
        <select
          className="admin-input"
          value={cashflow.type}
          onChange={(e) => setCashflow({ ...cashflow, type: e.target.value })}
        >
          <option value="">Type</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <input
          className="admin-input"
          placeholder="Amount"
          value={cashflow.amount}
          onChange={(e) => setCashflow({ ...cashflow, amount: e.target.value })}
        />
        <input
          className="admin-input"
          placeholder="Note"
          value={cashflow.note}
          onChange={(e) => setCashflow({ ...cashflow, note: e.target.value })}
        />
        <button className="admin-btn" disabled={loadingCashflow}>
          <LoadingButtonContent loading={loadingCashflow} loadingText="Recording...">
            Record Transaction
          </LoadingButtonContent>
        </button>
      </form>
    </div>
  );
}
