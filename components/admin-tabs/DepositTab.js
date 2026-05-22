import LoadingButtonContent from "@/components/admin/LoadingButtonContent";
import { useState } from "react";

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
  const [selectedBooking, setSelectedBooking] = useState(null);
  const trashFee = Number(appConfig?.trash_fee || 0);
  const personById = new Map(activePersons.map((p) => [normalize(p.id), p]));

  const activeDepositTotal = sortedDeposits.reduce((total, d) => {
    const status = getDepositStatus(d);

    if (!["pending", "waiting"].includes(status)) return total;

    const person = personById.get(normalize(d.person_id));
    const includeTrash = normalize(person?.trash).toUpperCase() === "Y";

    return total + Number(d.amount || 0) + (includeTrash ? trashFee : 0);
  }, 0);

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

      <h4>Deposit List (Rp{activeDepositTotal.toLocaleString("id-ID")})</h4>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th className="admin-th">House</th>
              <th className="admin-th">Name</th>
              <th className="admin-th">Period</th>
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
                <tr
                  key={d.id || i}
                  className={i % 2 ? "admin-row-alt" : ""}
                  onClick={() => setSelectedBooking(d)}
                  style={{ cursor: "pointer" }}
                >
                  <td className="admin-td">{d.house}</td>
                  <td className="admin-td">{d.name}</td>
                  <td className="admin-td">{d.period}</td>
                  <td className="admin-td">
                    <span className={statusClass}>{depositStatus}</span>
                  </td>
                  <td
                    className="admin-td"
                    onClick={(e) => e.stopPropagation()}
                  >
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

      {selectedBooking && (
        <div
          onClick={() => setSelectedBooking(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            background: "rgba(2,6,23,.6)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 360,
              padding: 20,
              borderRadius: 18,
              border: "1px solid var(--admin-border)",
              background: "var(--admin-card)",
              color: "var(--admin-text)",
              boxShadow: "0 18px 40px rgba(0,0,0,.28)",
            }}
          >
            <div style={{ marginBottom: 18 }}>
              <div
                style={{
                  color: "var(--admin-muted)",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Booking Payment
              </div>

              <div
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  lineHeight: 1.1,
                }}
              >
                {selectedBooking.house}
              </div>

              <div
                style={{
                  marginTop: 6,
                  color: "var(--admin-muted)",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {selectedBooking.name} • {selectedBooking.period}
              </div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <div style={modalInfoStyle}>
                <span>Status</span>
                <strong>{getDepositStatus(selectedBooking)}</strong>
              </div>

              <div style={modalInfoStyle}>
                <span>Amount</span>
                <strong>
                  Rp{Number(selectedBooking.amount || 0).toLocaleString("id-ID")}
                </strong>
              </div>

              <div style={modalInfoStyle}>
                <span>Created</span>
                <strong>{selectedBooking.created_at || "-"}</strong>
              </div>

              {selectedBooking.payment_id && (
                <div style={modalInfoStyle}>
                  <span>Payment ID</span>
                  <strong>{selectedBooking.payment_id}</strong>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const modalInfoStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  paddingTop: 12,
  borderTop: "1px solid var(--admin-border)",
  color: "var(--admin-muted)",
  fontSize: 13,
};