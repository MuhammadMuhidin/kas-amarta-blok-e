import LoadingButtonContent from "@/components/admin/LoadingButtonContent";

export default function PaymentTab({
  configError,
  recordPayment,
  payment,
  setPayment,
  personal,
  selected,
  toggleHouse,
  normalize,
  isHousePaidForPeriod,
  loadingPayment,
}) {
  return (
    <>
      {configError && <div className="admin-error-box">{configError}</div>}
      <div className="admin-card">
        <h3>Bulk Payment</h3>
        <form onSubmit={recordPayment} className="admin-form">
          <input
            className="admin-input"
            placeholder="Period (2026-02)"
            value={payment.period}
            onChange={(e) => setPayment({ ...payment, period: e.target.value })}
          />
          <input
            className="admin-input admin-readonly-input"
            type="number"
            value={payment.amount}
            readOnly
            aria-readonly="true"
          />
          <div className="admin-house-list">
            {personal
              .filter((p) => p.active === "Y")
              .sort((a, b) => a.house.localeCompare(b.house, undefined, { numeric: true }))
              .map((p) => {
                const period = normalize(payment.period);
                const joinPeriod = normalize(p.join_date).slice(0, 7);
                const alreadyPaid = isHousePaidForPeriod(p);
                const notJoined = period && joinPeriod && period < joinPeriod;
                const disabledChip = alreadyPaid || notJoined;
                const chipClass = [
                  "admin-checkbox-chip",
                  selected.includes(p.id) ? "admin-checkbox-chip-active" : "",
                  disabledChip ? "admin-checkbox-chip-disabled" : "",
                ].filter(Boolean).join(" ");

                return (
                  <label
                    key={p.id}
                    title={alreadyPaid ? "Already paid for this period" : notJoined ? "Not joined yet for this period" : ""}
                    className={chipClass}
                  >
                    <input
                      type="checkbox"
                      className="admin-checkbox-input"
                      checked={selected.includes(p.id)}
                      disabled={disabledChip}
                      onChange={() => toggleHouse(p.id)}
                    />
                    <div className="admin-house-chip-content">
                      <div className="admin-house-chip-house">{p.house}</div>
                      {alreadyPaid && <div className="admin-house-chip-paid">Paid</div>}
                      {notJoined && <div className="admin-house-chip-paid">Not join</div>}
                    </div>
                  </label>
                );
              })}
          </div>
          <button className="admin-btn" disabled={loadingPayment}>
            <LoadingButtonContent loading={loadingPayment} loadingText="Recording...">
              Record Payment
            </LoadingButtonContent>
          </button>
        </form>
      </div>
    </>
  );
}
