"use client";

import LoadingButtonContent from "@/components/admin/LoadingButtonContent";
import PersonSearchBox from "@/components/admin/PersonSearchBox";
import modalStyles from "@/components/admin/AdminModal.module.css";
import useInfiniteRows from "@/components/admin/useInfiniteRows";
import { readJson, sendJson } from "@/components/admin/adminClientApi";
import Toast from "@/components/Toast";
import { getCurrentPeriod, addMonths } from "@/lib/depositUtils";
import { useMemo, useState } from "react";

const pageSize = 10;
const money = (value) => `Rp${Number(value || 0).toLocaleString("id-ID")}`;

function formatDate(date) {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatPeriod(period) {
  if (!period || period === "-") return "-";

  const normalized = String(period).slice(0, 7);

  if (!/^\d{4}-\d{2}$/.test(normalized)) return period;

  return new Date(`${normalized}-01`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
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

function buildMultiPayFailureMessage({ success, recovered, failures }) {
  const recoveredLines = recovered.length
    ? [
        "",
        "Detected as paid after the error response:",
        ...recovered.map((item, index) => `${index + 1}. ${item.house || "-"} - ${item.name || "-"} (${formatPeriod(item.period)}): ${item.note}`),
      ]
    : [];
  const failureLines = failures.length
    ? failures
        .map((item, index) => `${index + 1}. ${item.house || "-"} - ${item.name || "-"} (${formatPeriod(item.period)}): ${item.error}`)
        .join("\n")
    : "-";

  return [
    "[ADMIN ALERT] Multipay Booking Payment needs review.",
    "",
    `Success: ${success} houses`,
    `Recovered: ${recovered.length} houses`,
    `Failed: ${failures.length} houses`,
    ...recoveredLines,
    "",
    "Failure details:",
    failureLines,
  ].join("\n");
}

async function notifyMultiPayFailures({ success, recovered, failures }) {
  if (!failures.length && !recovered.length) return;

  await sendJson("/api/waha/workflow", "POST", {
    period: failures[0]?.period || recovered[0]?.period || "-",
    source: "admin-multipay-booking-failure",
    message: buildMultiPayFailureMessage({ success, recovered, failures }),
  });
}

async function verifyBookingPaymentAfterFailure({ booking, normalize }) {
  const [latestDeposits, latestPayments] = await Promise.all([
    readJson("/api/sheets/deposit"),
    readJson("/api/sheets/payment"),
  ]);

  const latestDeposit = latestDeposits.find((item) => normalize(item.id) === normalize(booking.id));
  const recordedPayment = latestPayments.find((item) => {
    const samePeriod = normalize(item.period) === normalize(booking.period);
    const samePerson = normalize(item.person_id) === normalize(booking.person_id);
    const sameHouse = normalize(item.person_house) === normalize(booking.house);

    return samePeriod && (samePerson || sameHouse);
  });

  if (normalize(latestDeposit?.status).toLowerCase() === "paid" && normalize(latestDeposit?.payment_id)) {
    return {
      recovered: true,
      note: "Booking was marked paid after the error response.",
    };
  }

  if (recordedPayment?.id) {
    return {
      recovered: false,
      error: "Payment was found, but the booking has not been marked paid. Manual review is needed to prevent double payment.",
    };
  }

  return null;
}

export default function DepositTab({
  saveDeposit,
  depositForm,
  setDepositForm,
  activePersons,
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
  onBatchComplete,
  onBatchStatusChange,
  wakeLock,
}) {
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [snapshotOverrides, setSnapshotOverrides] = useState({});
  const [editingSnapshot, setEditingSnapshot] = useState(false);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [snapshotError, setSnapshotError] = useState("");
  const [toast, setToast] = useState(null);
  const [showCreateBooking, setShowCreateBooking] = useState(false);
  const [showMultiPayModal, setShowMultiPayModal] = useState(false);
  const [multiPayLoading, setMultiPayLoading] = useState(false);
  const [multiPayProgress, setMultiPayProgress] = useState({ current: 0, total: 0 });
  const [snapshotDraft, setSnapshotDraft] = useState({ amount: "", trash_amount: "" });

  const {
    items: bookingRows,
    total,
    loading,
    loadingMore,
    error,
    hasMore,
    loaderRef,
    refresh,
  } = useInfiniteRows({
    pageSize,
    buildUrl: ({ page, limit }) => `/api/sheets/deposit?page=${page}&limit=${limit}`,
    deps: [],
    getItems: (data) => data.deposits || [],
    getPagination: (data) => data.pagination || {},
  });

  const trashEnabled = (selectedDepositPerson?.trash || "").toUpperCase() === "Y";
  const currentTrashFee = Number(appConfig?.trash_fee || 0);
  const currentMonthlyFee = Number(appConfig?.monthly_fee || 0);
  const bookingPreviewTotal =
    (currentMonthlyFee + (trashEnabled ? currentTrashFee : 0)) * selectedDepositPeriods.length;

  const unpaidPastPeriods = useMemo(() => {
    if (!selectedDepositPerson) return [];
    const currentPeriod = getCurrentPeriod();
    const joinPeriod = normalize(selectedDepositPerson.join_date).slice(0, 7);
    const start = joinPeriod && joinPeriod >= "2026-02" ? joinPeriod : "2026-02";
    const lastPast = addMonths(currentPeriod, -1);
    const result = [];
    let period = start;
    while (period <= lastPast) {
      const alreadyPaid = payments.some(
        (payment) =>
          normalize(payment.person_id) === normalize(selectedDepositPerson.id) &&
          normalize(payment.person_house) === normalize(selectedDepositPerson.house) &&
          normalize(payment.period).slice(0, 7) === period,
      );
      if (!alreadyPaid) result.push(period);
      period = addMonths(period, 1);
    }
    return result;
  }, [selectedDepositPerson, payments]);

  const effectiveDeposits = useMemo(
    () => bookingRows.map((deposit) => ({ ...deposit, ...(snapshotOverrides[deposit.id] || {}) })),
    [bookingRows, snapshotOverrides],
  );

  const totalDeposits = useMemo(
    () => sortedDeposits.map((deposit) => ({ ...deposit, ...(snapshotOverrides[deposit.id] || {}) })),
    [sortedDeposits, snapshotOverrides],
  );

  function hasPaymentForDeposit(deposit) {
    return payments.some(
      (payment) =>
        normalize(payment.person_id) === normalize(deposit.person_id) &&
        normalize(payment.person_house) === normalize(deposit.house) &&
        normalize(payment.period) === normalize(deposit.period),
    );
  }

  function resolveDepositStatus(deposit) {
    if (hasPaymentForDeposit(deposit)) return "paid";
    return getDepositStatus(deposit);
  }

  const activeDepositTotal = totalDeposits.reduce((sum, item) => {
    const status = resolveDepositStatus(item);
    if (!["pending", "waiting"].includes(status)) return sum;
    return sum + Number(item.amount || 0) + Number(item.trash_amount || 0);
  }, 0);

  const readyPayBookings = useMemo(
    () => totalDeposits.filter((deposit) => resolveDepositStatus(deposit) === "pending"),
    [totalDeposits, payments],
  );

  const readyPayTotal = readyPayBookings.reduce((sum, booking) => {
    return sum + Number(booking.amount || 0) + Number(booking.trash_amount || 0);
  }, 0);

  const isMultiPayDisabled = readyPayBookings.length === 0 || loading || loadingMore || multiPayLoading;
  const multiPayLoadingText = multiPayProgress.total
    ? `Paying booking ${multiPayProgress.current}/${multiPayProgress.total}...`
    : "Paying...";
  const bookingAmount = Number(selectedBooking?.amount || 0);
  const trashAmount = Number(selectedBooking?.trash_amount || 0);
  const totalBookingPayment = bookingAmount + trashAmount;
  const selectedBookingStatus = selectedBooking ? resolveDepositStatus(selectedBooking) : "";
  const canEditSnapshot = ["pending", "waiting"].includes(selectedBookingStatus);

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }

  function openBookingModal(deposit) {
    const latest = { ...deposit, ...(snapshotOverrides[deposit.id] || {}) };

    setSelectedBooking(latest);
    setSnapshotDraft({
      amount: String(Number(latest.amount || 0)),
      trash_amount: String(Number(latest.trash_amount || 0)),
    });
    setEditingSnapshot(false);
    setSnapshotError("");
  }

  function closeBookingModal() {
    setSelectedBooking(null);
    setEditingSnapshot(false);
    setSnapshotError("");
  }

  async function handleSaveDeposit(e) {
    await saveDeposit(e);
    await refresh();
    setShowCreateBooking(false);
  }

  async function handlePayDeposit(id) {
    await payDeposit(id);
    await refresh();
    await onBatchComplete?.();
  }

  async function handleMultiPayBookings() {
    if (readyPayBookings.length === 0 || multiPayLoading) return;

    setMultiPayLoading(true);
    onBatchStatusChange?.(true);
    setMultiPayProgress({ current: 0, total: readyPayBookings.length });

    try {
      let success = 0;
      const recovered = [];
      const failures = [];

      for (const [index, booking] of readyPayBookings.entries()) {
        setMultiPayProgress({ current: index + 1, total: readyPayBookings.length });
        const result = await payDeposit(booking.id, { silent: true });

        if (result?.ok) {
          success += 1;
          continue;
        }

        try {
          const verification = await verifyBookingPaymentAfterFailure({ booking, normalize });

          if (verification?.recovered) {
            success += 1;
            recovered.push({
              id: booking.id,
              house: booking.house,
              name: booking.name,
              period: booking.period,
              note: verification.note,
            });
            continue;
          }

          failures.push({
            id: booking.id,
            house: booking.house,
            name: booking.name,
            period: booking.period,
            error: verification?.error || result?.error || "Failed to pay booking",
          });
        } catch (verifyErr) {
          failures.push({
            id: booking.id,
            house: booking.house,
            name: booking.name,
            period: booking.period,
            error: `${result?.error || "Failed to pay booking"}. Verification failed: ${verifyErr.message || "unknown"}`,
          });
        }
      }

      await Promise.all([refresh(), onBatchComplete?.()]);

      if (failures.length > 0 || recovered.length > 0) {
        try {
          await notifyMultiPayFailures({ success, recovered, failures });
        } catch (notifyErr) {
          showToast(notifyErr.message || "Failed to trigger WhatsApp workflow", "error");
        }
      }

      if (failures.length === 0) {
        const recoveredText = recovered.length ? `, ${recovered.length} recovered` : "";
        setShowMultiPayModal(false);
        showToast(`Multipay completed: ${success} successful${recoveredText}, 0 failed`, "success");
      } else if (success > 0) {
        const recoveredText = recovered.length ? `, ${recovered.length} recovered` : "";
        showToast(`Multipay completed: ${success} successful${recoveredText}, ${failures.length} failed`, "warning");
      } else {
        showToast(`Multipay completed: 0 successful, ${failures.length} failed`, "error");
      }
    } finally {
      setMultiPayLoading(false);
      onBatchStatusChange?.(false);
      setMultiPayProgress({ current: 0, total: 0 });
    }
  }

  async function updateBookingSnapshot(e) {
    e.preventDefault();
    if (!selectedBooking) return;

    const amount = Number(snapshotDraft.amount || 0);
    const nextTrashAmount = Number(snapshotDraft.trash_amount || 0);

    if (
      !Number.isFinite(amount) ||
      amount < 0 ||
      !Number.isFinite(nextTrashAmount) ||
      nextTrashAmount < 0
    ) {
      setSnapshotError("Invalid booking amount");
      showToast("Invalid booking amount", "error");
      return;
    }

    if (amount === bookingAmount && nextTrashAmount === trashAmount) {
      setSnapshotError("");
      return;
    }

    setSavingSnapshot(true);
    setSnapshotError("");

    try {
      await sendJson("/api/sheets/deposit", "PATCH", {
        id: selectedBooking.id,
        action: "UPDATE_SNAPSHOT",
        amount,
        trash_amount: nextTrashAmount,
      });

      const updatedBooking = { ...selectedBooking, amount, trash_amount: nextTrashAmount };
      setSnapshotOverrides((prev) => ({ ...prev, [selectedBooking.id]: updatedBooking }));
      setSelectedBooking(updatedBooking);
      setEditingSnapshot(false);
      await Promise.all([refresh(), onBatchComplete?.()]);
      showToast("Booking snapshot updated successfully", "success");
    } catch (err) {
      const message = err.message || "Failed to update booking snapshot";
      setSnapshotError(message);
      showToast(message, "error");
    } finally {
      setSavingSnapshot(false);
    }
  }

  return (
    <>
      <Toast show={!!toast} type={toast?.type} message={toast?.message} />

      <div className="admin-card">
        <div style={sectionHeaderStyle}>
          <div>
            <h3 style={{ margin: 0 }}>Booking Payment</h3>
            <div className="admin-deposit-meta" style={{ marginTop: 8 }}>
              Payment fee snapshot will be saved when the booking is created.
            </div>
          </div>

          <button
            type="button"
            className={showCreateBooking ? "admin-collapse-toggle admin-collapse-toggle-open" : "admin-collapse-toggle"}
            style={collapseButtonStyle}
            aria-label={showCreateBooking ? "Collapse booking payment form" : "Expand booking payment form"}
            aria-expanded={showCreateBooking}
            onClick={() => setShowCreateBooking((prev) => !prev)}
          >
            {showCreateBooking ? "▴" : "▾"}
          </button>
        </div>

        {showCreateBooking && (
          <form onSubmit={handleSaveDeposit} className="admin-form admin-collapsible-panel">
            <PersonSearchBox
              persons={activePersons}
              value={depositForm.person_id}
              selectedPerson={selectedDepositPerson}
              onChange={(personId) =>
                setDepositForm({ ...depositForm, person_id: personId, end_period: "" })
              }
            />

            {selectedDepositPerson && (
              <div className="booking-preview-box" style={previewBoxStyle}>
                <InfoRow label="Current Cash Fee" value={money(currentMonthlyFee)} />
                <InfoRow
                  label="Current Trash Fee"
                  value={trashEnabled ? money(currentTrashFee) : "Not included"}
                />
                <InfoRow label="Total Booking" value={money(bookingPreviewTotal)} strong />
              </div>
            )}

            {selectedDepositPerson && unpaidPastPeriods.length > 0 && (
              <div
                style={{
                  marginTop: 10,
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "#fee2e2",
                  color: "#b91c1c",
                  fontWeight: 800,
                  fontSize: 14,
                  lineHeight: 1.4,
                }}
              >
                Rumah ini masih memiliki tunggakan ({unpaidPastPeriods.length} periode lewat:{" "}
                {unpaidPastPeriods.map((period) => formatPeriod(period)).join(", ")})
              </div>
            )}

            <div className="admin-deposit-meta">
              Snapshot can be changed if cash or trash fees are adjusted before payment is made.
            </div>

            <div className="admin-deposit-chips">
              {nextSixPeriods.map((period) => {
                const active = selectedDepositPeriods.includes(period);
                const alreadyBooked = selectedDepositPerson
                  && deposits.some(
                    (deposit) =>
                      normalize(deposit.person_id) === normalize(selectedDepositPerson.id)
                      && normalize(deposit.period) === period
                      && normalize(deposit.status) !== "cancelled",
                  );

                return (
                  <button
                    key={period}
                    type="button"
                    className={active ? "admin-deposit-chip admin-deposit-chip-active" : "admin-deposit-chip"}
                    onClick={() => setDepositForm({ ...depositForm, end_period: period })}
                    disabled={!depositForm.person_id || alreadyBooked}
                    title={alreadyBooked ? "Sudah dibooking untuk periode ini" : ""}
                  >
                    {formatPeriod(period)}
                    {alreadyBooked && <span style={{ display: "block", fontSize: 11, fontWeight: 600, opacity: 0.8 }}>sudah dibooking</span>}
                  </button>
                );
              })}
            </div>

            <button className="admin-btn" disabled={savingDeposit}>
              <LoadingButtonContent loading={savingDeposit} loadingText="Saving...">
                Create Booking
              </LoadingButtonContent>
            </button>
          </form>
        )}

        <h4>Booking List ({money(activeDepositTotal)})</h4>
        <div className="booking-ready-pay-summary" style={readyPaySummaryStyle}>
          <span style={readyPaySummaryTextStyle}>
            Ready to pay: <strong>{readyPayBookings.length} houses</strong>
          </span>

          <button
            type="button"
            className="admin-refresh-btn"
            style={isMultiPayDisabled ? multiPayButtonMutedStyle : multiPayButtonStyle}
            disabled={isMultiPayDisabled}
            onClick={() => setShowMultiPayModal(true)}
          >
            Multi Pay
          </button>
        </div>
        {error && <div className="admin-error-box">{error}</div>}

        <div style={listMetaStyle}>
          <span>{effectiveDeposits.length} / {total} loaded</span>
          <button
            type="button"
            className="admin-small-btn admin-refresh-btn"
            disabled={loading || loadingMore || multiPayLoading}
            onClick={refresh}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <BookingList
          deposits={effectiveDeposits}
          loading={loading}
          payingDepositId={payingDepositId}
          savingDeposit={savingDeposit}
          multiPayLoading={multiPayLoading}
          resolveDepositStatus={resolveDepositStatus}
          handlePayDeposit={handlePayDeposit}
          openBookingModal={openBookingModal}
        />

        {effectiveDeposits.length > 0 && (
          <div
            ref={loaderRef}
            className={loadingMore ? "admin-loader-sentinel admin-loader-sentinel-loading" : "admin-loader-sentinel"}
            style={loaderSentinelStyle}
          >
            {loadingMore ? "Loading more" : hasMore ? "Scroll to load more" : "All bookings loaded"}
          </div>
        )}

        {selectedBooking && (
          <BookingModal
            booking={selectedBooking}
            bookingAmount={bookingAmount}
            trashAmount={trashAmount}
            totalBookingPayment={totalBookingPayment}
            editingSnapshot={editingSnapshot}
            setEditingSnapshot={setEditingSnapshot}
            snapshotDraft={snapshotDraft}
            setSnapshotDraft={setSnapshotDraft}
            snapshotError={snapshotError}
            setSnapshotError={setSnapshotError}
            savingSnapshot={savingSnapshot}
            updateBookingSnapshot={updateBookingSnapshot}
            closeBookingModal={closeBookingModal}
            canEditSnapshot={canEditSnapshot}
          />
        )}

        {showMultiPayModal && (
          <MultiPayModal
            bookings={readyPayBookings}
            total={readyPayTotal}
            loading={multiPayLoading}
            loadingText={multiPayLoadingText}
            progress={multiPayProgress}
            wakeLock={wakeLock}
            onClose={() => setShowMultiPayModal(false)}
            onConfirm={handleMultiPayBookings}
          />
        )}
      </div>
    </>
  );
}

function InfoRow({ label, value, strong = false }) {
  return (
    <div style={strong ? totalRowStyle : infoRowStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function BookingList({
  deposits,
  loading,
  payingDepositId,
  savingDeposit,
  multiPayLoading,
  resolveDepositStatus,
  handlePayDeposit,
  openBookingModal,
}) {
  if (loading) return <p>Loading booking...</p>;
  if (deposits.length === 0) return <div className="admin-empty-state">Booking payment is not available yet.</div>;

  return (
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
          {deposits.map((deposit, index) => {
            const status = resolveDepositStatus(deposit);
            const isPaying = payingDepositId === deposit.id;
            const canPay = status === "pending";
            const buttonText =
              status === "paid" ? "Paid" : status === "waiting" ? "Waiting" : status === "missed" ? "Unpaid" : "Pay Now";

            return (
              <tr
                key={deposit.id || index}
                className={index % 2 ? "admin-row-alt admin-clickable-row" : "admin-clickable-row"}
                onClick={() => openBookingModal(deposit)}
              >
                <td className="admin-td">{deposit.house}</td>
                <td className="admin-td">{deposit.name}</td>
                <td className="admin-td">{formatPeriod(deposit.period)}</td>
                <td className="admin-td"><span className={`admin-deposit-status admin-deposit-status-${status}`}>{status}</span></td>
                <td className="admin-td" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className={buttonText === "Paid" ? "admin-small-btn admin-small-btn-paid" : "admin-small-btn"}
                    style={{ minWidth: 96 }}
                    disabled={!canPay || isPaying || savingDeposit || multiPayLoading}
                    onClick={() => handlePayDeposit(deposit.id)}
                  >
                    <LoadingButtonContent loading={isPaying} loadingText="Paying...">
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
  );
}

function MultiPayModal({ bookings, total, loading, loadingText, progress, wakeLock, onClose, onConfirm }) {
  const progressPercent = progress?.total
    ? Math.min(100, Math.max(0, Math.round((progress.current / progress.total) * 100)))
    : 0;

  return (
    <div className={modalStyles.overlay} onClick={loading ? undefined : onClose}>
      <div className={modalStyles.box} onClick={(e) => e.stopPropagation()}>
        <div style={modalTitleStyle}>Confirm Multi Pay Booking</div>
        <div style={modalNoteStyle}>
          Make sure the booking data is correct. All bookings below will be marked paid immediately.
        </div>

        <div style={multiPayListStyle}>
          {bookings.map((booking) => (
            <div key={booking.id} style={multiPayItemStyle}>
              <span>{booking.house} - {booking.name}</span>
              <strong>{money(Number(booking.amount || 0) + Number(booking.trash_amount || 0))}</strong>
            </div>
          ))}
        </div>

        <div style={multiPayTotalStyle}>
          <span>Total houses: {bookings.length}</span>
          <strong>{money(total)}</strong>
        </div>

        {loading && progress?.total > 0 && (
          <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
            <div className="booking-multipay-progress-track">
              <div className="booking-multipay-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <div style={modalNoteStyle}>
              Processing {progress.current} of {progress.total} bookings.
            </div>
          </div>
        )}

        <div style={modalButtonGridStyle}>
          <button type="button" className="admin-small-btn" disabled={loading} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="admin-small-btn" disabled={loading || bookings.length === 0} onClick={onConfirm}>
            <LoadingButtonContent loading={loading} loadingText={loadingText || "Paying..."}>
              Pay {bookings.length} Booking
            </LoadingButtonContent>
          </button>
        </div>
        {loading && <WakeLockInfo wakeLock={wakeLock} />}
      </div>
    </div>
  );
}

function BookingModal({
  booking,
  bookingAmount,
  trashAmount,
  totalBookingPayment,
  editingSnapshot,
  setEditingSnapshot,
  snapshotDraft,
  setSnapshotDraft,
  snapshotError,
  setSnapshotError,
  savingSnapshot,
  updateBookingSnapshot,
  closeBookingModal,
  canEditSnapshot,
}) {
  const hasSnapshotChanges =
    Number(snapshotDraft.amount || 0) !== bookingAmount ||
    Number(snapshotDraft.trash_amount || 0) !== trashAmount;

  return (
    <div className={modalStyles.overlay} onClick={closeBookingModal}>
      <div className={modalStyles.box} onClick={(e) => e.stopPropagation()}>
        <div style={{ marginBottom: 18 }}>
          <div style={modalTitleStyle}>{booking.house} • {formatPeriod(booking.period)}</div>
          <div style={modalSubtitleStyle}>{booking.name}</div>
        </div>

        {editingSnapshot ? (
          <form onSubmit={updateBookingSnapshot} style={{ display: "grid", gap: 12 }}>
            <SnapshotInput
              label="Cash Booking"
              value={snapshotDraft.amount}
              onChange={(value) => setSnapshotDraft((prev) => ({ ...prev, amount: value }))}
            />
            <SnapshotInput
              label="Trash Booking"
              value={snapshotDraft.trash_amount}
              onChange={(value) => setSnapshotDraft((prev) => ({ ...prev, trash_amount: value }))}
            />

            {snapshotError && <div className="admin-error-box" style={{ marginBottom: 0 }}>{snapshotError}</div>}

            <div style={modalButtonGridStyle}>
              <button
                type="button"
                className="admin-small-btn"
                disabled={savingSnapshot}
                onClick={() => {
                  setEditingSnapshot(false);
                  setSnapshotError("");
                  setSnapshotDraft({ amount: String(bookingAmount), trash_amount: String(trashAmount) });
                }}
              >
                Cancel
              </button>
              <button className="admin-small-btn" disabled={savingSnapshot || !hasSnapshotChanges}>
                <LoadingButtonContent loading={savingSnapshot} loadingText="Saving...">Save</LoadingButtonContent>
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <InfoRow label="Cash Booking" value={money(bookingAmount)} />
            <InfoRow label="Trash Booking" value={trashAmount > 0 ? money(trashAmount) : "Not included"} />
            <InfoRow label="Total Payment" value={money(totalBookingPayment)} strong />
            <InfoRow label="Created At" value={formatDate(booking.created_at)} />
            <InfoRow label="Paid At" value={formatDate(booking.paid_at)} />
            <div style={modalNoteStyle}>Snapshot follows the fee when the booking was created.</div>
            {canEditSnapshot && (
              <button type="button" className="admin-small-btn" onClick={() => setEditingSnapshot(true)}>
                Edit Snapshot
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SnapshotInput({ label, value, onChange }) {
  return (
    <label style={snapshotLabelStyle}>
      <span>{label}</span>
      <input className="admin-input" type="number" min="0" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

const sectionHeaderStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 14,
};

const previewBoxStyle = {
  padding: 14,
  borderRadius: 14,
  border: "1px solid var(--admin-border)",
  background: "var(--admin-row)",
  display: "grid",
  gap: 10,
};

const infoRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  color: "var(--admin-text)",
  fontSize: 13,
};

const totalRowStyle = {
  ...infoRowStyle,
  marginTop: 2,
  paddingTop: 12,
  borderTop: "1px solid var(--admin-border)",
  fontSize: 14,
  fontWeight: 700,
};

const readyPaySummaryStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",
  gap: 10,
  margin: "-4px 0 12px",
  padding: 12,
  borderRadius: 14,
  border: "1px solid var(--admin-border)",
  background: "var(--admin-row)",
};

const readyPaySummaryTextStyle = {
  color: "var(--admin-muted)",
  fontSize: 13,
  fontWeight: 700,
};

const multiPayButtonStyle = {
  border: 0,
  borderRadius: 12,
  padding: "10px 14px",
  background: "#10b981",
  color: "#052e16",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const multiPayButtonMutedStyle = {
  ...multiPayButtonStyle,
  background: "var(--admin-border)",
  color: "var(--admin-muted)",
  cursor: "not-allowed",
  opacity: 0.72,
};

const listMetaStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  margin: "12px 0 10px",
  color: "var(--admin-muted)",
  fontSize: 12,
  fontWeight: 700,
};

const loaderSentinelStyle = {
  padding: "14px 0 4px",
  color: "var(--admin-muted)",
  fontSize: 12,
  fontWeight: 700,
  textAlign: "center",
};

const modalTitleStyle = {
  fontSize: 26,
  fontWeight: 800,
  lineHeight: 1.1,
};

const modalSubtitleStyle = {
  marginTop: 6,
  color: "var(--admin-muted)",
  fontSize: 14,
  fontWeight: 600,
};

const modalButtonGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const modalNoteStyle = {
  paddingTop: 12,
  borderTop: "1px solid var(--admin-border)",
  color: "var(--admin-muted)",
  fontSize: 12,
  lineHeight: 1.6,
};

const multiPayListStyle = {
  display: "grid",
  gap: 8,
  maxHeight: 260,
  overflowY: "auto",
  margin: "14px 0",
};

const multiPayItemStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid var(--admin-border)",
  color: "var(--admin-text)",
  fontSize: 13,
};

const multiPayTotalStyle = {
  ...totalRowStyle,
  marginBottom: 14,
};

const wakeLockInfoStyle = {
  marginTop: 10,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid var(--admin-border)",
  background: "var(--admin-row)",
  color: "var(--admin-muted)",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.45,
};

const snapshotLabelStyle = {
  display: "grid",
  gap: 6,
  color: "var(--admin-muted)",
  fontSize: 13,
  fontWeight: 700,
};

const collapseButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  padding: 0,
  border: "none",
  borderRadius: 8,
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  font: "inherit",
  fontSize: 18,
  fontWeight: 900,
  lineHeight: 1,
};