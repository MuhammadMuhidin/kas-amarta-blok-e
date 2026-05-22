import LoadingButtonContent from "@/components/admin/LoadingButtonContent";
import { useEffect, useMemo, useState } from "react";

function getCurrentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

const START_PAYMENT_PERIOD = "2026-02";

function isValidPeriod(period) {
  return /^\d{4}-\d{2}$/.test(period);
}

function addMonth(period) {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(year, month, 1);

  return date.toISOString().slice(0, 7);
}

function getEffectiveStartPeriod(joinPeriod) {
  if (!isValidPeriod(joinPeriod)) return "";

  const firstPaymentPeriod = addMonth(joinPeriod);

  return firstPaymentPeriod < START_PAYMENT_PERIOD
    ? START_PAYMENT_PERIOD
    : firstPaymentPeriod;
}

function buildPeriodRange(startPeriod, endPeriod) {
  if (!isValidPeriod(startPeriod) || !isValidPeriod(endPeriod)) return [];

  const periods = [];
  let cursor = startPeriod;
  let guard = 0;

  while (cursor <= endPeriod && guard < 24) {
    periods.push(cursor);
    cursor = addMonth(cursor);
    guard += 1;
  }

  return periods;
}

function isDepositPaid(deposit, normalize) {
  return (
    normalize(deposit.status).toLowerCase() === "paid" &&
    normalize(deposit.paid_at) !== "" &&
    normalize(deposit.payment_id) !== ""
  );
}

export default function PaymentTab({
  configError,
  recordPayment,
  payment,
  setPayment,
  personal,
  payments = [],
  selected,
  toggleHouse,
  normalize,
  isHousePaidForPeriod,
  loadingPayment,
}) {
  const [deposits, setDeposits] = useState([]);
  const currentPeriod = getCurrentPeriod();

  useEffect(() => {
    async function loadDeposit() {
      const res = await fetch("/api/sheets/deposit", {
        cache: "no-store",
        method: "GET",
      });

      const data = await res.json();
      setDeposits(data || []);
    }

    loadDeposit();
  }, []);

  const pendingCurrentDeposits = useMemo(() => {
    return deposits.filter((deposit) => {
      const samePeriod = normalize(deposit.period) === currentPeriod;
      const notPaid = !isDepositPaid(deposit, normalize);

      return samePeriod && notPaid;
    });
  }, [deposits, currentPeriod, normalize]);

  const hasPendingCurrentDeposit = pendingCurrentDeposits.length > 0;
  const disableRecordPayment = loadingPayment || hasPendingCurrentDeposit;

  function isPaidForPeriod(person, period) {
    return payments.some((pay) => {
      const samePeriod = normalize(pay.period).slice(0, 7) === period;
      const samePerson = normalize(pay.person_id) === normalize(person.id);
      const sameHouse = normalize(pay.person_house) === normalize(person.house);

      return samePeriod && (samePerson || sameHouse);
    });
  }

  const availablePaymentPeriods = useMemo(() => {
    const periods = new Set();

    personal
      .filter((person) => person.active === "Y")
      .forEach((person) => {
        const joinPeriod = normalize(person.join_date).slice(0, 7);
        const effectiveStartPeriod = getEffectiveStartPeriod(joinPeriod);

        if (!isValidPeriod(effectiveStartPeriod)) return;

        buildPeriodRange(effectiveStartPeriod, currentPeriod).forEach((period) => {
          if (!isPaidForPeriod(person, period)) {
            periods.add(period);
          }
        });
      });

    return [...periods].sort();
  }, [personal, payments, currentPeriod, normalize]);

  return (
    <>
      {configError && <div className="admin-error-box">{configError}</div>}
      {hasPendingCurrentDeposit && (
        <div className="admin-error-box">
          Selesaikan {pendingCurrentDeposits.length} deposit bulan berjalan lewat Pay Now sebelum mencatat payment manual.
        </div>
      )}
      <div className="admin-card">
        <h3>Bulk Payment</h3>
        <form onSubmit={recordPayment} className="admin-form">
          <select
            className="admin-input"
            value={payment.period}
            onChange={(e) => setPayment({ ...payment, period: e.target.value })}
          >
            <option value="">Pilih periode tunggakan</option>

            {availablePaymentPeriods.map((period) => (
              <option key={period} value={period}>
                {period}
              </option>
            ))}
          </select>
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
                const effectiveStartPeriod = getEffectiveStartPeriod(joinPeriod);
                const alreadyPaid = isHousePaidForPeriod(p);
                const notJoined = period && effectiveStartPeriod && period < effectiveStartPeriod;
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
          <button className="admin-btn" disabled={disableRecordPayment}>
            <LoadingButtonContent loading={loadingPayment} loadingText="Recording...">
              Record Payment
            </LoadingButtonContent>
          </button>
        </form>
      </div>
    </>
  );
}
