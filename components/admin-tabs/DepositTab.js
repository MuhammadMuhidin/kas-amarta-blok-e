"use client";

import LoadingButtonContent from "@/components/admin/LoadingButtonContent";
import PersonSearchBox from "@/components/admin/PersonSearchBox";
import modalStyles from "@/components/admin/AdminModal.module.css";
import useInfiniteRows from "@/components/admin/useInfiniteRows";
import Toast from "@/components/Toast";
import { useMemo, useState } from "react";

const pageSize = 10;
const money = (value) => `Rp${Number(value || 0).toLocaleString("id-ID")}`;

function formatDate(date) {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatPeriod(period) {
  if (!period || period === "-") return "-";

  const normalized = String(period).slice(0, 7);

  if (!/^\d{4}-\d{2}$/.test(normalized)) return period;

  return new Date(`${normalized}-01`).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
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
    () => effectiveDeposits.filter((deposit) => resolveDepositStatus(deposit) === "pending"),
    [effectiveDeposits, payments],
  );

  const readyPayTotal = readyPayBookings.reduce((sum, booking) => {
    return sum + Number(booking.amount || 0) + Number(booking.trash_amount || 0);
  }, 0);

  const bookingAmount = Number(selectedBooking?.amount || 0);
  const trashAmount = Number(selectedBooking?.trash_amount || 0);
  const totalBookingPayment = bookingAmount + trashAmount;
  const selectedBookingStatus = selectedBooking ? resolveDepositStatus(selectedBooking) : "";
  const canEditSnapshot = ["pending", "waiting"].includes(selectedBookingStatus);

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }

  function getCookie(name) {
    return document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${name}=`))
      ?.split("=")[1];
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
  }

  async function handleMultiPayBookings() {
    if (readyPayBookings.length === 0 || multiPayLoading) return;

    setMultiPayLoading(true);

    try {
      for (const booking of readyPayBookings) {
        await payDeposit(booking.id);
      }

      await refresh();
      setShowMultiPayModal(false);
      showToast(`Booking berhasil dibayarkan untuk ${readyPayBookings.length} rumah`, "success");
    } catch (err) {
      showToast(err.message || "Gagal membayarkan booking", "error");
    } finally {
      setMultiPayLoading(false);
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
      setSnapshotError("Nominal booking tidak valid");
      showToast("Nominal booking tidak valid", "error");
      return;
    }

    if (amount === bookingAmount && nextTrashAmount === trashAmount) {
      setSnapshotError("");
      return;
    }

    setSavingSnapshot(true);
    setSnapshotError("");

    try {
      const csrfToken = getCookie("csrf_token");
      const res = await fetch("/api/sheets/deposit", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          id: selectedBooking.id,
          action: "UPDATE_SNAPSHOT",
          amount,
          trash_amount: nextTrashAmount,
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Gagal memperbarui booking snapshot");

      const updatedBooking = { ...selectedBooking, amount, trash_amount: nextTrashAmount };
      setSnapshotOverrides((prev) => ({ ...prev, [selectedBooking.id]: updatedBooking }));
      setSelectedBooking(updatedBooking);
      setEditingSnapshot(false);
      await refresh();
      showToast("Booking snapshot berhasil diperbarui", "success");
    } catch (err) {
      const message = err.message || "Gagal memperbarui booking snapshot";
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
              Snapshot tarif pembayaran akan disimpan saat booking dibuat.
            </div>
          </div>

          <button
            type="button"
            className="admin-small-btn"
            onClick={() => setShowCreateBooking((prev) => !prev)}
          >
            {showCreateBooking ? "▴ Hide Booking" : "▾ Create Booking"}
          </button>
        </div>

        {showCreateBooking && (
          <form onSubmit={handleSaveDeposit} className="admin-form">
            <PersonSearchBox
              persons={activePersons}
              value={depositForm.person_id}
              selectedPerson={selectedDepositPerson}
              onChange={(personId) =>
                setDepositForm({ ...depositForm, person_id: personId, end_period: "" })
              }
            />

            {selectedDepositPerson && (
              <div style={previewBoxStyle}>
                <InfoRow label="Tarif Kas Saat Ini" value={money(currentMonthlyFee)} />
                <InfoRow
                  label="Tarif Sampah Saat Ini"
                  value={trashEnabled ? money(currentTrashFee) : "Not include"}
                />
                <InfoRow label="Total Booking" value={money(bookingPreviewTotal)} strong />
              </div>
            )}

            <div className="admin-deposit-meta">
              Snapshot dapat diubah jika terjadi penyesuaian tarif kas atau sampah sebelum pembayaran dilakukan.
            </div>

            <div className="admin-deposit-chips">
              {nextSixPeriods.map((period) => {
                const active = selectedDepositPeriods.includes(period);

                return (
                  <button
                    key={period}
                    type="button"
                    className={active ? "admin-deposit-chip admin-deposit-chip-active" : "admin-deposit-chip"}
                    onClick={() => setDepositForm({ ...depositForm, end_period: period })}
                    disabled={!depositForm.person_id}
                  >
                    {formatPeriod(period)}
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
        <div style={readyPaySummaryStyle}>
          <span style={readyPaySummaryTextStyle}>
            Ready pay bulan ini: <strong>{readyPayBookings.length} rumah</strong> • {money(readyPayTotal)}
          </span>

          {readyPayBookings.length > 0 && (
            <button
              type="button"
              className="admin-small-btn"
              disabled={loading || loadingMore || multiPayLoading}
              onClick={() => setShowMultiPayModal(true)}
            >
              Pay {readyPayBookings.length} Ready Booking
            </button>
          )}
        </div>
        {error && <div className="admin-error-box">{error}</div>}

        <div style={listMetaStyle}>
          <span>{effectiveDeposits.length} / {total} loaded</span>
          <button
            type="button"
            className="admin-small-btn"
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
          <div ref={loaderRef} style={loaderSentinelStyle}>
            {loadingMore ? "Loading more..." : hasMore ? "Scroll to load more" : "All bookings loaded"}
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
  if (deposits.length === 0) return <div className="admin-empty-state">Booking payment belum tersedia.</div>;

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
                className={index % 2 ? "admin-row-alt" : ""}
                onClick={() => openBookingModal(deposit)}
                style={{ cursor: "pointer" }}
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

function MultiPayModal({ bookings, total, loading, onClose, onConfirm }) {
  return (
    <div className={modalStyles.overlay} onClick={loading ? undefined : onClose}>
      <div className={modalStyles.box} onClick={(e) => e.stopPropagation()}>
        <div style={modalTitleStyle}>Konfirmasi Multi Pay Booking</div>
        <div style={modalNoteStyle}>
          Pastikan data booking sudah benar. Semua booking di bawah akan langsung ditandai paid.
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
          <span>Total rumah: {bookings.length}</span>
          <strong>{money(total)}</strong>
        </div>

        <div style={modalButtonGridStyle}>
          <button type="button" className="admin-small-btn" disabled={loading} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="admin-small-btn" disabled={loading || bookings.length === 0} onClick={onConfirm}>
            <LoadingButtonContent loading={loading} loadingText="Paying...">
              Pay {bookings.length} Booking
            </LoadingButtonContent>
          </button>
        </div>
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
              label="Kas Booking"
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
            <InfoRow label="Kas Booking" value={money(bookingAmount)} />
            <InfoRow label="Trash Booking" value={trashAmount > 0 ? money(trashAmount) : "Not include"} />
            <InfoRow label="Total Payment" value={money(totalBookingPayment)} strong />
            <InfoRow label="Created At" value={formatDate(booking.created_at)} />
            <InfoRow label="Paid At" value={formatDate(booking.paid_at)} />
            <div style={modalNoteStyle}>Snapshot mengikuti tarif saat booking dibuat.</div>
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
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
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

const snapshotLabelStyle = {
  display: "grid",
  gap: 6,
  color: "var(--admin-muted)",
  fontSize: 13,
  fontWeight: 700,
};