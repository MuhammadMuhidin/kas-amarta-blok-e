import LoadingButtonContent from "@/components/admin/LoadingButtonContent";

export default function DepositTab({
  saveDeposit,
  depositForm,
  setDepositForm,
  activePersons,
  depositAmount,
  selectedDepositPerson,
  appConfig,
  nextSixPeriods,
  selectedDepositPeriods,
  savingDeposit,
  sortedDeposits,
  getDepositStatus,
  payingDepositId,
  payments,
  normalize,
  payDeposit,
}) {
  return (
    <div className="admin-card">
      <h3>Deposit Balance</h3>

      <form onSubmit={saveDeposit} className="admin-form">
        <select
          className="admin-input"
          value={depositForm.person_id}
          onChange={(e) =>
            setDepositForm({
              ...depositForm,
              person_id: e.target.value,
              end_period: "",
            })
          }
        >
          <option value="">Select active house</option>
          {activePersons.map((p) => (
            <option key={p.id} value={p.id}>
              {p.house} - {p.name}
            </option>
          ))}
        </select>

        <input
          className="admin-input admin-readonly-input"
          value={`Rp${depositAmount.toLocaleString("id-ID")}`}
          readOnly
        />

        {selectedDepositPerson && (
          <div className="admin-deposit-meta">
            {(selectedDepositPerson.trash || "").toUpperCase() === "Y"
              ? `Layanan: Kas + Sampah. Sampah dicatat terpisah Rp${Number(
                  appConfig?.trash_fee || 0,
                ).toLocaleString("id-ID")} saat Pay Now.`
              : "Layanan: Kas"}
          </div>
        )}

        <div className="admin-deposit-chips">
          {nextSixPeriods.map((period) => {
            const active = selectedDepositPeriods.includes(period);

            return (
              <button
                key={period}
                type="button"
                className={
                  active
                    ? "admin-deposit-chip admin-deposit-chip-active"
                    : "admin-deposit-chip"
                }
                onClick={() => setDepositForm({ ...depositForm, end_period: period })}
                disabled={!depositForm.person_id}
              >
                {period}
              </button>
            );
          })}
        </div>

        <button className="admin-btn" disabled={savingDeposit}>
          <LoadingButtonContent loading={savingDeposit} loadingText="Saving...">
            Save Deposit
          </LoadingButtonContent>
        </button>
      </form>

      <h4>Deposit List</h4>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th className="admin-th">House</th>
              <th className="admin-th">Name</th>
              <th className="admin-th">Period</th>
              <th className="admin-th">Amount</th>
              <th className="admin-th">Status</th>
              <th className="admin-th">Action</th>
            </tr>
          </thead>

          <tbody>
            {sortedDeposits.map((d, i) => {
              const depositStatus = getDepositStatus(d);
              const isPayingThisDeposit = payingDepositId === d.id;
              const paymentExists = payments.some(
                (p) =>
                  normalize(p.person_id) === normalize(d.person_id) &&
                  normalize(p.person_house) === normalize(d.house) &&
                  normalize(p.period) === normalize(d.period),
              );
              const canPay = depositStatus === "pending";
              const buttonText =
                depositStatus === "paid"
                  ? "Paid"
                  : depositStatus === "waiting"
                    ? "Waiting"
                    : depositStatus === "missed"
                      ? paymentExists
                        ? "Paid"
                        : "Unpaid"
                      : "Pay Now";
              const statusClass = `admin-deposit-status admin-deposit-status-${depositStatus}`;
              const buttonClass =
                buttonText === "Paid"
                  ? "admin-small-btn admin-small-btn-paid"
                  : "admin-small-btn";

              return (
                <tr key={d.id || i} className={i % 2 ? "admin-row-alt" : ""}>
                  <td className="admin-td">{d.house}</td>
                  <td className="admin-td">{d.name}</td>
                  <td className="admin-td">{d.period}</td>
                  <td className="admin-td">
                    Rp{Number(d.amount || 0).toLocaleString("id-ID")}
                  </td>
                  <td className="admin-td">
                    <span className={statusClass}>{depositStatus}</span>
                  </td>
                  <td className="admin-td">
                    <button
                      type="button"
                      className={buttonClass}
                      style={{ minWidth: 96 }}
                      disabled={!canPay || isPayingThisDeposit || savingDeposit}
                      onClick={() => payDeposit(d.id)}
                    >
                      <LoadingButtonContent loading={isPayingThisDeposit} loadingText="Paying...">
                        {buttonText}
                      </LoadingButtonContent>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
