"use client";

import AdminSubtabs from "@/components/admin/AdminSubtabs";
import LoadingButtonContent from "@/components/admin/LoadingButtonContent";
import PaymentProofReviewCard from "@/components/admin/PaymentProofReviewCard";
import { readJson, sendJson } from "@/components/admin/adminClientApi";
import Toast from "@/components/Toast";
import { getCurrentPeriod } from "@/lib/depositUtils";
import { useEffect, useMemo, useRef, useState } from "react";

const START_PAYMENT_PERIOD = "2026-02";
const PAYMENT_REMINDER_MESSAGE = [
  "Assalamu’alaikum bapak/ibu warga Amarta Residence 2 Blok E.",
  "",
  "Izin mengingatkan bahwa pembayaran kas dan sampah bulan ini jatuh tempo hari ini. Bagi bapak/ibu yang belum melakukan pembayaran, mohon dapat segera melakukan pembayaran.",
  "",
  "Terima kasih 🙏",
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

function getEffectiveStartPeriod(joinPeriod) {
  if (!isValidPeriod(joinPeriod)) return "";
  return joinPeriod < START_PAYMENT_PERIOD ? START_PAYMENT_PERIOD : joinPeriod;
}

function isDepositPaid(deposit, normalize) {
  return normalize(deposit.status).toLowerCase() === "paid"
    && normalize(deposit.paid_at) !== ""
    && normalize(deposit.payment_id) !== "";
}

function WakeLockInfo({ wakeLock }) {
  if (!wakeLock) return null;
  const message = wakeLock.supported
    ? wakeLock.locked
      ? "The screen will stay active during the process. Do not switch apps until it finishes."
      : "Trying to keep the screen active. Do not lock the screen until the process finishes."
    : "This device/browser does not support screen wake lock. Do not lock the screen until the process finishes.";
  return <div style={styles.wakeLock}>{message}</div>;
}

function useModalScrollLock(open) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [open]);
}

function usePaymentToast() {
  const [toast, setToast] = useState({ show: false, type: "info", message: "" });

  function showToast(type, message) {
    setToast({ show: true, type, message });
    setTimeout(() => {
      setToast((current) => current.message === message
        ? { ...current, show: false }
        : current);
    }, 2800);
  }

  return { toast, showToast };
}

function PaymentReminderCard({ sendingReminder, showPreview, setShowPreview, sendReminder }) {
  useModalScrollLock(showPreview);

  function closePreview() {
    if (!sendingReminder) setShowPreview(false);
  }

  return (
    <div className="admin-card">
      <h3 style={{ marginTop: 0 }}>WhatsApp Monthly Reminder</h3>
      <p style={styles.description}>
        Preview the monthly cash and trash payment reminder before sending it to the resident group.
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
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-reminder-title"
          onClick={closePreview}
        >
          <div
            className="modal-box"
            style={{ width: "min(100%,560px)" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div style={styles.modalHeader}>
                <div>
                  <div id="payment-reminder-title" className="modal-title">
                    Preview WhatsApp Reminder
                  </div>
                  <div className="modal-section">
                    This message will be sent to the resident group.
                  </div>
                </div>
                <button
                  type="button"
                  style={styles.closeButton}
                  disabled={sendingReminder}
                  onClick={closePreview}
                  aria-label="Close modal"
                >
                  ×
                </button>
              </div>
            </div>
            <pre style={styles.preview}>{PAYMENT_REMINDER_MESSAGE}</pre>
            <div style={styles.modalActions}>
              <button
                type="button"
                className="admin-small-btn"
                disabled={sendingReminder}
                onClick={closePreview}
                style={styles.secondaryButton}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn"
                disabled={sendingReminder}
                onClick={sendReminder}
                style={{ width: "auto", minWidth: 150 }}
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

function SelectedResidentsPanel({ selectedResidents, loadingPayment, onReset }) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const selectedCount = selectedResidents.length;

  useEffect(() => {
    if (!confirmingReset) return undefined;
    const timeoutId = setTimeout(() => setConfirmingReset(false), 3000);
    return () => clearTimeout(timeoutId);
  }, [confirmingReset]);

  useEffect(() => {
    if (selectedCount === 0 || loadingPayment) setConfirmingReset(false);
  }, [selectedCount, loadingPayment]);

  function handleResetClick() {
    if (loadingPayment) return;
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    onReset();
    setConfirmingReset(false);
  }

  return (
    <section className="admin-selected-residents-card" aria-live="polite">
      <div className="admin-selected-residents-header">
        <span>Selected houses:</span>
        <strong>{selectedCount} {selectedCount === 1 ? "house" : "houses"}</strong>
      </div>
      {selectedCount > 0 ? (
        <ul className="admin-selected-residents-list">
          {selectedResidents.map((person) => (
            <li key={person.id} className="admin-selected-residents-item">
              {person.house} — {person.name}
            </li>
          ))}
        </ul>
      ) : (
        <div className="admin-selected-residents-empty">
          The names of the selected residents will appear here.
        </div>
      )}
      {selectedCount > 0 && (
        <div className="admin-selected-residents-actions">
          <button
            type="button"
            className={confirmingReset
              ? "admin-small-btn admin-reset-confirm-btn"
              : "admin-small-btn"}
            disabled={loadingPayment}
            onClick={handleResetClick}
          >
            {confirmingReset ? "Click again to confirm reset" : "Reset Selection"}
          </button>
        </div>
      )}
    </section>
  );
}

function PaymentProgressBar({ progress }) {
  if (!progress?.total) return null;
  const percent = Math.min(
    100,
    Math.max(0, Math.round((progress.current / progress.total) * 100)),
  );
  return (
    <section className="payment-bulk-progress-card" style={styles.progressCard} aria-live="polite">
      <div style={styles.progressHeader}>
        <span>Recording payments</span>
        <strong>{progress.current}/{progress.total}</strong>
      </div>
      <div className="booking-multipay-progress-track">
        <div className="booking-multipay-progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <div style={styles.progressMeta}>
        Processing {progress.current} of {progress.total} selected houses.
      </div>
    </section>
  );
}

function RecordPaymentPanel({
  configError,
  recordPayment,
  payment,
  setPayment,
  personal,
  payments,
  selected,
  toggleHouse,
  resetSelected,
  normalize,
  isHousePaidForPeriod,
  loadingPayment,
  paymentProgress,
  wakeLock,
  deposits,
  depositsLoading,
  depositsError,
  onRetryDeposits,
}) {
  const currentPeriod = getCurrentPeriod();
  const pendingCurrentDeposits = useMemo(() => deposits.filter((deposit) => (
    normalize(deposit.period) === currentPeriod
      && !isDepositPaid(deposit, normalize)
  )), [deposits, currentPeriod, normalize]);

  const selectedResidents = useMemo(() => personal
    .filter((person) => selected.includes(person.id))
    .sort((a, b) => a.house.localeCompare(b.house, undefined, { numeric: true })),
  [personal, selected]);

  function isPaidForPeriod(person, period) {
    return payments.some((pay) => {
      const samePeriod = normalize(pay.period).slice(0, 7) === period;
      const samePerson = normalize(pay.person_id) === normalize(person.id);
      const sameHouse = normalize(pay.person_house) === normalize(person.house);
      return samePeriod && (samePerson || sameHouse);
    });
  }

  const availablePaymentPeriods = useMemo(() => {
    const candidatePeriods = [...new Set([
      ...payments.map((pay) => normalize(pay.period).slice(0, 7)).filter(isValidPeriod),
      currentPeriod,
    ])].sort();

    return candidatePeriods.filter((period) => personal
      .filter((person) => person.active === "Y")
      .some((person) => {
        const joinPeriod = normalize(person.join_date).slice(0, 7);
        const effectiveStartPeriod = getEffectiveStartPeriod(joinPeriod);
        return isValidPeriod(effectiveStartPeriod)
          && period >= effectiveStartPeriod
          && !isPaidForPeriod(person, period);
      }));
  }, [personal, payments, currentPeriod, normalize]);

  const selectedCount = selectedResidents.length;
  const hasPendingCurrentDeposit = pendingCurrentDeposits.length > 0;
  const disabled = loadingPayment
    || depositsLoading
    || Boolean(depositsError)
    || hasPendingCurrentDeposit
    || selectedCount === 0;
  const loadingText = paymentProgress?.total
    ? `Recording payment ${paymentProgress.current}/${paymentProgress.total}...`
    : "Recording...";
  const label = selectedCount === 0
    ? "Select houses first"
    : `Record ${selectedCount} ${selectedCount === 1 ? "Payment" : "Payments"}`;

  return (
    <div id="payment-record-panel" role="tabpanel">
      {configError && <div className="admin-error-box">{configError}</div>}
      {depositsError && (
        <div className="admin-error-box" style={styles.retryBox}>
          <span>{depositsError}</span>
          <button type="button" className="admin-small-btn" onClick={onRetryDeposits}>
            Retry
          </button>
        </div>
      )}
      {hasPendingCurrentDeposit && (
        <div className="admin-error-box">
          Complete {pendingCurrentDeposits.length} current-month booking payments with Pay Now
          before recording manual payments.
        </div>
      )}
      <div className="admin-card">
        <h3>Bulk Payment</h3>
        <form onSubmit={recordPayment} className="admin-form">
          <select
            className="admin-input"
            value={payment.period}
            disabled={loadingPayment}
            onChange={(event) => setPayment({ ...payment, period: event.target.value })}
          >
            <option value="">Select unpaid period</option>
            {availablePaymentPeriods.map((period) => (
              <option key={period} value={period}>{formatPeriod(period)}</option>
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
              .filter((person) => person.active === "Y")
              .sort((a, b) => a.house.localeCompare(b.house, undefined, { numeric: true }))
              .map((person) => {
                const period = normalize(payment.period);
                const joinPeriod = normalize(person.join_date).slice(0, 7);
                const effectiveStartPeriod = getEffectiveStartPeriod(joinPeriod);
                const alreadyPaid = isHousePaidForPeriod(person);
                const notJoined = period && effectiveStartPeriod && period < effectiveStartPeriod;
                const disabledChip = loadingPayment || alreadyPaid || notJoined;
                const chipClass = [
                  "admin-checkbox-chip",
                  selected.includes(person.id) ? "admin-checkbox-chip-active" : "",
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
                  <label key={person.id} title={title} className={chipClass}>
                    <input
                      type="checkbox"
                      className="admin-checkbox-input"
                      checked={selected.includes(person.id)}
                      disabled={disabledChip}
                      onChange={() => toggleHouse(person.id)}
                    />
                    <div className="admin-house-chip-content">
                      <div className="admin-house-chip-house">{person.house}</div>
                      {alreadyPaid && <div className="admin-house-chip-paid">Paid</div>}
                      {notJoined && <div className="admin-house-chip-paid">Not joined</div>}
                    </div>
                  </label>
                );
              })}
          </div>
          <SelectedResidentsPanel
            selectedResidents={selectedResidents}
            loadingPayment={loadingPayment}
            onReset={resetSelected}
          />
          {loadingPayment && <PaymentProgressBar progress={paymentProgress} />}
          <button className="admin-btn" disabled={disabled}>
            <LoadingButtonContent loading={loadingPayment} loadingText={loadingText}>
              {depositsLoading ? "Checking booking payments..." : label}
            </LoadingButtonContent>
          </button>
          {loadingPayment && <WakeLockInfo wakeLock={wakeLock} />}
        </form>
      </div>
    </div>
  );
}

export default function PaymentTab(props) {
  const [activePanel, setActivePanel] = useState("record");
  const [deposits, setDeposits] = useState([]);
  const [depositsLoaded, setDepositsLoaded] = useState(false);
  const [depositsLoading, setDepositsLoading] = useState(false);
  const [depositsError, setDepositsError] = useState("");
  const [depositLoadVersion, setDepositLoadVersion] = useState(0);
  const [showReminderPreview, setShowReminderPreview] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [pendingProofCount, setPendingProofCount] = useState(0);
  const depositRequestRef = useRef(null);
  const { toast, showToast } = usePaymentToast();

  useEffect(() => {
    if (activePanel !== "record" || depositsLoaded) return undefined;

    depositRequestRef.current?.abort();
    const controller = new AbortController();
    depositRequestRef.current = controller;
    setDepositsLoading(true);
    setDepositsError("");

    readJson("/api/sheets/deposit", { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted || depositRequestRef.current !== controller) return;
        setDeposits(Array.isArray(data) ? data : []);
        setDepositsLoaded(true);
      })
      .catch((error) => {
        if (error?.name === "AbortError" || controller.signal.aborted) return;
        if (depositRequestRef.current !== controller) return;
        setDeposits([]);
        setDepositsError(error.message || "Failed to check current booking payments");
      })
      .finally(() => {
        if (!controller.signal.aborted && depositRequestRef.current === controller) {
          setDepositsLoading(false);
        }
      });

    return () => controller.abort();
  }, [activePanel, depositsLoaded, depositLoadVersion]);

  useEffect(() => () => depositRequestRef.current?.abort(), []);

  useEffect(() => {
    let cancelled = false;
    readJson("/api/admin/payment-proofs?status=pending")
      .then((data) => {
        if (cancelled) return;
        setPendingProofCount(Array.isArray(data?.proofs) ? data.proofs.length : 0);
      })
      .catch(() => {
        if (!cancelled) setPendingProofCount(0);
      });
    return () => { cancelled = true; };
  }, []);

  function retryDeposits() {
    setDepositsLoaded(false);
    setDepositsError("");
    setDepositLoadVersion((value) => value + 1);
  }

  async function sendPaymentReminder() {
    if (sendingReminder) return;
    try {
      setSendingReminder(true);
      await sendJson("/api/waha/payment-reminder", "POST", {
        message: PAYMENT_REMINDER_MESSAGE,
      });
      setShowReminderPreview(false);
      showToast("success", "WhatsApp payment reminder queued successfully.");
    } catch (error) {
      showToast("error", error.message || "Failed to send WhatsApp payment reminder.");
    } finally {
      setSendingReminder(false);
    }
  }

  async function refreshProofCount() {
    try {
      const data = await readJson("/api/admin/payment-proofs?status=pending");
      setPendingProofCount(Array.isArray(data?.proofs) ? data.proofs.length : 0);
    } catch {
      setPendingProofCount(0);
    }
  }

  return (
    <>
      <Toast show={toast.show} type={toast.type} message={toast.message} />
      <AdminSubtabs
        value={activePanel}
        onChange={setActivePanel}
        ariaLabel="Payment navigation"
        items={[
          { value: "record", label: "Record Payment", panelId: "payment-record-panel" },
          { value: "proofs", label: "Payment Proofs", badge: pendingProofCount, panelId: "payment-proofs-panel" },
          { value: "reminder", label: "Reminder", panelId: "payment-reminder-panel" },
        ]}
      />

      {activePanel === "record" && (
        <RecordPaymentPanel
          {...props}
          payments={props.payments || []}
          deposits={deposits}
          depositsLoading={depositsLoading}
          depositsError={depositsError}
          onRetryDeposits={retryDeposits}
        />
      )}

      {activePanel === "proofs" && (
        <div id="payment-proofs-panel" role="tabpanel">
          <PaymentProofReviewCard
            onReviewed={() => { props.onPaymentProofReviewed?.(); refreshProofCount(); }}
            onToast={showToast}
          />
        </div>
      )}

      {activePanel === "reminder" && (
        <div id="payment-reminder-panel" role="tabpanel">
          <PaymentReminderCard
            sendingReminder={sendingReminder}
            showPreview={showReminderPreview}
            setShowPreview={setShowReminderPreview}
            sendReminder={sendPaymentReminder}
          />
        </div>
      )}
    </>
  );
}

const styles = {
  description: {
    margin: "0 0 14px",
    color: "var(--admin-muted)",
    fontSize: 14,
    lineHeight: 1.5,
  },
  retryBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  modalHeader: {
    width: "100%",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-row)",
    color: "var(--admin-text)",
    fontSize: 22,
    lineHeight: 1,
    fontWeight: 800,
    cursor: "pointer",
    flexShrink: 0,
  },
  preview: {
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
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
  },
  secondaryButton: {
    background: "var(--admin-row)",
    color: "var(--admin-text)",
    border: "1px solid var(--admin-border)",
  },
  progressCard: {
    display: "grid",
    gap: 8,
    padding: 12,
    borderRadius: 14,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-row)",
  },
  progressHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    color: "var(--admin-text)",
    fontSize: 13,
    fontWeight: 800,
  },
  progressMeta: {
    color: "var(--admin-muted)",
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1.5,
  },
  wakeLock: {
    marginTop: -4,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-row)",
    color: "var(--admin-muted)",
    fontSize: 12,
  },
};
