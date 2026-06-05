import LoadingButtonContent from "@/components/admin/LoadingButtonContent";
import { readJson, sendJson } from "@/components/admin/adminClientApi";
import { getCurrentPeriod } from "@/lib/depositUtils";
import { useEffect, useMemo, useState } from "react";

const START_PAYMENT_PERIOD = "2026-02";
const PAYMENT_REMINDER_MESSAGE = [
  "Assalamu’alaikum bapak/ibu warga Amarta Residence 2 Blok E.",
  "",
  "Izin mengingatkan bahwa pembayaran kas dan sampah bulan ini jatuh tempo hari ini. Bagi bapak/ibu yang belum melakukan pembayaran, mohon dapat segera melakukan pembayaran.",
  "",
  "Terima kasih 🙏",
  "@semua",
  "",
  "_Pesan ini dikirim secara otomatis._",
].join("\n");

function isValidPeriod(period) {
  return /^\d{4}-\d{2}$/.test(period);
}

function formatPeriod(period) {
  if (!period || period === "-") return "-";

  const normalized = String(period).slice(0, 7);

  if (!isValidPeriod(normalized)) return period;

  return new Date(`${normalized}-01`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function addMonth(period) {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(year, month, 1);

  return date.toISOString().slice(0, 7);
}

function getEffectiveStartPeriod(joinPeriod) {
  if (!isValidPeriod(joinPeriod)) return "";

  return joinPeriod < START_PAYMENT_PERIOD
    ? START_PAYMENT_PERIOD
    : joinPeriod;
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

function WakeLockInfo({ wakeLock }) {
  if (!wakeLock) return null;

  const message = wakeLock.supported
    ? wakeLock.locked
      ? "The screen will stay active during the process. Do not switch apps until it finishes."
      : "Trying to keep the screen active. Do not lock the screen until the process finishes."
    : "This device/browser does not support screen wake lock. Do not lock the screen until the process finishes.";

  return <div style={wakeLockInfoStyle}>{message}</div>;
}

function PaymentReminderCard({ sendingReminder, showPreview, setShowPreview, sendReminder }) {
  return (
    <div className="admin-card" style={reminderCardStyle}>
      <h3 style={reminderTitleStyle}>WhatsApp Monthly Reminder</h3>
      <p style={reminderDescriptionStyle}>
        Preview reminder bulanan pembayaran kas dan sampah sebelum dikirim ke grup warga.
      </p>
      <button
        type="button"
        className="admin-btn"
        disabled={sendingReminder}
        onClick={() => setShowPreview(true)}
      >
        <LoadingButtonContent loading={sendingReminder} loadingText="Sending reminder...">
          Preview & Send Monthly Reminder
        </LoadingButtonContent>
      </button>

      {showPreview && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="payment-reminder-title">
          <div className="modal-box" style={reminderModalStyle}>
            <div className="modal-header">
              <div>
                <div id="payment-reminder-title" className="modal-title">Preview WhatsApp Reminder</div>
                <div className="modal-section">Pesan ini akan dikirim ke grup warga.</div>
              </div>
              <button
                type="button"
                className="admin-small-btn"
                disabled={sendingReminder}
                onClick={() => setShowPreview(false)}
              >
                Close
              </button>
            </div>
            <pre style={reminderPreviewStyle}>{PAYMENT_REMINDER_MESSAGE}</pre>
            <div style={reminderActionsStyle}>
              <button
                type="button"
                className="admin-small-btn"
                disabled={sendingReminder}
                onClick={() => setShowPreview(false)}
                style={secondaryButtonStyle}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn"
                disabled={sendingReminder}
                onClick={sendReminder}
                style={sendButtonStyle}
              >
                <LoadingButtonContent loading={sendingReminder} loadingText="Sending...">
                  Send Reminder
                </LoadingButtonContent>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
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
  paymentProgress,
  wakeLock,
}) {
  const [deposits, setDeposits] = useState([]);
  const [showReminderPreview, setShowReminderPreview] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const currentPeriod = getCurrentPeriod();

  useEffect(() => {
    let ignore = false;

    async function loadDeposit() {
      try {
        const data = await readJson("/api/sheets/deposit");
        if (!ignore) setDeposits(Array.isArray(data) ? data : []);
      } catch {
        if (!ignore) setDeposits([]);
      }
    }

    loadDeposit();

    return () => {
      ignore = true;
    };
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
  const loadingText = paymentProgress?.total
    ? `Recording payment ${paymentProgress.current}/${paymentProgress.total}...`
    : "Recording...";

  async function sendPaymentReminder() {
    if (sendingReminder) return;

    try {
      setSendingReminder(true);
      await sendJson("/api/waha/payment-reminder", "POST", {
        message: PAYMENT_REMINDER_MESSAGE,
      });
      setShowReminderPreview(false);
      alert("WhatsApp payment reminder queued successfully.");
    } catch (err) {
      alert(err.message || "Failed to send WhatsApp payment reminder.");
    } finally {
      setSendingReminder(false);
    }
  }

  function isPaidForPeriod(person, period) {
    return payments.some((pay) => {
      const samePeriod = normalize(pay.period).slice(0, 7) === period;
      const samePerson = normalize(pay.person_id) === normalize(person.id);
      const sameHouse = normalize(pay.person_house) === normalize(person.house);

      return samePeriod && (samePerson || sameHouse);
    });
  }

  const availablePaymentPeriods = useMemo(() => {
    const candidatePeriods = [
      ...new Set([
        ...payments
          .map((pay) => normalize(pay.period).slice(0, 7))
          .filter(isValidPeriod),
        currentPeriod,
      ]),
    ].sort();

    return candidatePeriods.filter((period) =>
      personal
        .filter((person) => person.active === "Y")
        .some((person) => {
          const joinPeriod = normalize(person.join_date).slice(0, 7);
          const effectiveStartPeriod = getEffectiveStartPeriod(joinPeriod);

          if (!isValidPeriod(effectiveStartPeriod)) return false;
          if (period < effectiveStartPeriod) return false;

          return !isPaidForPeriod(person, period);
        }),
    );
  }, [personal, payments, currentPeriod, normalize]);

  return (
    <>
      {configError && <div className="admin-error-box">{configError}</div>}
      {hasPendingCurrentDeposit && (
        <div className="admin-error-box">
          Complete {pendingCurrentDeposits.length} current-month booking payments with Pay Now before recording manual payments.
        </div>
      )}
      <PaymentReminderCard
        sendingReminder={sendingReminder}
        showPreview={showReminderPreview}
        setShowPreview={setShowReminderPreview}
        sendReminder={sendPaymentReminder}
      />
      <div className="admin-card">
        <h3>Bulk Payment</h3>
        <form onSubmit={recordPayment} className="admin-form">
          <select
            className="admin-input"
            value={payment.period}
            disabled={loadingPayment}
            onChange={(e) => setPayment({ ...payment, period: e.target.value })}
          >
            <option value="">Select unpaid period</option>

            {availablePaymentPeriods.map((period) => (
              <option key={period} value={period}>
                {formatPeriod(period)}
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
                const disabledChip = loadingPayment || alreadyPaid || notJoined;
                const chipClass = [
                  "admin-checkbox-chip",
                  selected.includes(p.id) ? "admin-checkbox-chip-active" : "",
                  disabledChip ? "admin-checkbox-chip-disabled" : "",
                ].filter(Boolean).join(" ");
                const title = loadingPayment
                  ? "Bulk payment is being processed"
                  : alreadyPaid
                    ? "Already paid for this period"
                    : notJoined
                      ? "Not joined yet for this period"
                      : "";

                return (
                  <label
                    key={p.id}
                    title={title}
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
                      {notJoined && <div className="admin-house-chip-paid">Not joined</div>}
                    </div>
                  </label>
                );
              })}
          </div>
          <button className="admin-btn" disabled={disableRecordPayment}>
            <LoadingButtonContent loading={loadingPayment} loadingText={loadingText}>
              Record Payment
            </LoadingButtonContent>
          </button>
          {loadingPayment && <WakeLockInfo wakeLock={wakeLock} />}
        </form>
      </div>
    </>
  );
}

const wakeLockInfoStyle = {
  marginTop: -4,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid var(--admin-border)",
  background: "var(--admin-row)",
  color: "var(--admin-muted)",
  fontSize: 12,
};

const reminderCardStyle = {
  marginBottom: 16,
};

const reminderTitleStyle = {
  marginTop: 0,
  marginBottom: 8,
};

const reminderDescriptionStyle = {
  margin: "0 0 14px",
  color: "var(--admin-muted)",
  fontSize: 14,
  lineHeight: 1.5,
};

const reminderModalStyle = {
  width: "min(100%, 560px)",
};

const reminderPreviewStyle = {
  margin: "12px 0 16px",
  padding: 14,
  borderRadius: 12,
  border: "1px solid var(--admin-border)",
  background: "var(--admin-row)",
  color: "var(--admin-text)",
  whiteSpace: "pre-wrap",
  lineHeight: 1.6,
  fontFamily: "inherit",
  fontSize: 14,
};

const reminderActionsStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
};

const secondaryButtonStyle = {
  background: "var(--admin-row)",
  color: "var(--admin-text)",
  border: "1px solid var(--admin-border)",
};

const sendButtonStyle = {
  width: "auto",
  minWidth: 150,
};
