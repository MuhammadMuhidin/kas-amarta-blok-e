"use client";

import LoadingButtonContent from "@/components/admin/LoadingButtonContent";
import useInfiniteRows from "@/components/admin/useInfiniteRows";
import Toast from "@/components/Toast";
import modalStyles from "@/components/admin/AdminModal.module.css";
import { useMemo, useState } from "react";

const pageSize = 10;

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
  const [snapshotOverrides, setSnapshotOverrides] = useState({});
  const [editingSnapshot, setEditingSnapshot] = useState(false);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [snapshotError, setSnapshotError] = useState("");
  const [toast, setToast] = useState(null);
  const [snapshotDraft, setSnapshotDraft] = useState({
    amount: "",
    trash_amount: "",
  });

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
    buildUrl: ({ page, limit }) =>
      `/api/sheets/deposit?page=${page}&limit=${limit}`,
    deps: [],
    getItems: (data) => data.deposits || [],
    getPagination: (data) => data.pagination || {},
  });

  const trashEnabled =
    (selectedDepositPerson?.trash || "").toUpperCase() === "Y";

  const currentTrashFee = Number(appConfig?.trash_fee || 0);
  const currentMonthlyFee = Number(appConfig?.monthly_fee || 0);

  const selectedPeriodsCount = selectedDepositPeriods.length;

  const bookingPreviewTotal =
    (currentMonthlyFee + (trashEnabled ? currentTrashFee : 0)) *
    selectedPeriodsCount;

  const effectiveDeposits = useMemo(() => {
    return bookingRows.map((deposit) => ({
      ...deposit,
      ...(snapshotOverrides[deposit.id] || {}),
    }));
  }, [bookingRows, snapshotOverrides]);

  const totalDeposits = useMemo(() => {
    return sortedDeposits.map((deposit) => ({
      ...deposit,
      ...(snapshotOverrides[deposit.id] || {}),
    }));
  }, [sortedDeposits, snapshotOverrides]);

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

  const activeDepositTotal = totalDeposits.reduce((sum, d) => {
    const status = resolveDepositStatus(d);

    if (!["pending", "waiting"].includes(status)) return sum;

    return sum + Number(d.amount || 0) + Number(d.trash_amount || 0);
  }, 0);

  const bookingAmount = Number(selectedBooking?.amount || 0);
  const trashAmount = Number(selectedBooking?.trash_amount || 0);

  const totalBookingPayment = bookingAmount + trashAmount;

  const selectedBookingStatus = selectedBooking
    ? resolveDepositStatus(selectedBooking)
    : "";

  const canEditSnapshot = ["pending", "waiting"].includes(
    selectedBookingStatus,
  );

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
    const latest = {
      ...deposit,
      ...(snapshotOverrides[deposit.id] || {}),
    };

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
  }

  async function handlePayDeposit(id) {
    await payDeposit(id);
    await refresh();
  }

  async function updateBookingSnapshot(e) {
    e.preventDefault();

    if (!selectedBooking) return;

    const amount = Number(snapshotDraft.amount || 0);
    const trashAmount = Number(snapshotDraft.trash_amount || 0);

    if (
      !Number.isFinite(amount) ||
      amount < 0 ||
      !Number.isFinite(trashAmount) ||
      trashAmount < 0
    ) {
      setSnapshotError("Nominal booking tidak valid");
      showToast("Nominal booking tidak valid", "error");
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
          trash_amount: trashAmount,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal memperbarui booking snapshot");
      }

      const updatedBooking = {
        ...selectedBooking,
        amount,
        trash_amount: trashAmount,
      };

      setSnapshotOverrides((prev) => ({
        ...prev,
        [selectedBooking.id]: updatedBooking,
      }));

      setSelectedBooking(updatedBooking);
      setEditingSnapshot(false);

      await refresh();
      showToast("Booking snapshot berhasil diperbarui", "success");
    } catch (err) {
      const message =
        err.message || "Gagal memperbarui booking snapshot";

      setSnapshotError(message);
      showToast(message, "error");
    } finally {
      setSavingSnapshot(false);
    }
  }

  return (
    <>
      <Toast
        show={!!toast}
        type={toast?.type}
        message={toast?.message}
      />

      <div className="admin-card">
        <h3>Booking Payment</h3>

        <div className="admin-deposit-meta" style={{ marginBottom: 14 }}>
          Snapshot tarif pembayaran akan disimpan saat booking dibuat.
        </div>

        <form onSubmit={handleSaveDeposit} className="admin-form">
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

          {selectedDepositPerson && (
            <div
              style={{
                padding: 14,
                borderRadius: 14,
                border: "1px solid var(--admin-border)",
                background: "var(--admin-row)",
                display: "grid",
                gap: 10,
              }}
            >
              <div style={infoRowStyle}>
                <span>Tarif Kas Saat Ini</span>

                <strong>
                  Rp{currentMonthlyFee.toLocaleString("id-ID")}
                </strong>
              </div>

              <div style={infoRowStyle}>
                <span>Tarif Sampah Saat Ini</span>

                <strong>
                  {trashEnabled
                    ? `Rp${currentTrashFee.toLocaleString("id-ID")}`
                    : "Not include"}
                </strong>
              </div>

              <div style={totalRowStyle}>
                <span>Total Booking</span>

                <strong>
                  Rp{bookingPreviewTotal.toLocaleString("id-ID")}
                </strong>
              </div>
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
                  className={
                    active
                      ? "admin-deposit-chip admin-deposit-chip-active"
                      : "admin-deposit-chip"
                  }
                  onClick={() =>
                    setDepositForm({
                      ...depositForm,
                      end_period: period,
                    })
                  }
                  disabled={!depositForm.person_id}
                >
                  {period}
                </button>
              );
            })}
          </div>

          <button className="admin-btn" disabled={savingDeposit}>
            <LoadingButtonContent
              loading={savingDeposit}
              loadingText="Saving..."
            >
              Create Booking
            </LoadingButtonContent>
          </button>
        </form>

        <h4>
          Booking List (Rp{activeDepositTotal.toLocaleString("id-ID")})
        </h4>

        {error && <div className="admin-error-box">{error}</div>}

        <div style={listMetaStyle}>
          <span>{effectiveDeposits.length} / {total} loaded</span>
          <button
            type="button"
            className="admin-small-btn"
            disabled={loading || loadingMore}
            onClick={refresh}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {loading ? (
          <p>Loading booking...</p>
        ) : effectiveDeposits.length === 0 ? (
          <div className="admin-empty-state">Booking payment belum tersedia.</div>
        ) : (
          <>
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
                  {effectiveDeposits.map((d, i) => {
                    const depositStatus = resolveDepositStatus(d);
                    const isPayingThisDeposit = payingDepositId === d.id;
                    const canPay = depositStatus === "pending";

                    const buttonText =
                      depositStatus === "paid"
                        ? "Paid"
                        : depositStatus === "waiting"
                          ? "Waiting"
                          : depositStatus === "missed"
                            ? "Unpaid"
                            : "Pay Now";

                    const statusClass =
                      `admin-deposit-status admin-deposit-status-${depositStatus}`;

                    const buttonClass =
                      buttonText === "Paid"
                        ? "admin-small-btn admin-small-btn-paid"
                        : "admin-small-btn";

                    return (
                      <tr
                        key={d.id || i}
                        className={i % 2 ? "admin-row-alt" : ""}
                        onClick={() => openBookingModal(d)}
                        style={{ cursor: "pointer" }}
                      >
                        <td className="admin-td">{d.house}</td>
                        <td className="admin-td">{d.name}</td>
                        <td className="admin-td">{d.period}</td>
                        <td className="admin-td">
                          <span className={statusClass}>
                            {depositStatus}
                          </span>
                        </td>

                        <td
                          className="admin-td"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className={buttonClass}
                            style={{ minWidth: 96 }}
                            disabled={
                              !canPay ||
                              isPayingThisDeposit ||
                              savingDeposit
                            }
                            onClick={() => handlePayDeposit(d.id)}
                          >
                            <LoadingButtonContent
                              loading={isPayingThisDeposit}
                              loadingText="Paying..."
                            >
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

            <div ref={loaderRef} style={loaderSentinelStyle}>
              {loadingMore
                ? "Loading more..."
                : hasMore
                  ? "Scroll to load more"
                  : "All bookings loaded"}
            </div>
          </>
        )}

        {selectedBooking && (
          <div
            className={modalStyles.overlay}
            onClick={closeBookingModal}
          >
            <div
              className={modalStyles.box}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ marginBottom: 18 }}>
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 800,
                    lineHeight: 1.1,
                  }}
                >
                  {selectedBooking.house} • {selectedBooking.period}
                </div>

                <div
                  style={{
                    marginTop: 6,
                    color: "var(--admin-muted)",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {selectedBooking.name}
                </div>
              </div>

              {editingSnapshot ? (
                <form
                  onSubmit={updateBookingSnapshot}
                  style={{ display: "grid", gap: 12 }}
                >
                  <label style={snapshotLabelStyle}>
                    <span>Kas Booking</span>

                    <input
                      className="admin-input"
                      type="number"
                      min="0"
                      value={snapshotDraft.amount}
                      onChange={(e) =>
                        setSnapshotDraft((prev) => ({
                          ...prev,
                          amount: e.target.value,
                        }))
                      }
                    />
                  </label>

                  <label style={snapshotLabelStyle}>
                    <span>Trash Booking</span>

                    <input
                      className="admin-input"
                      type="number"
                      min="0"
                      value={snapshotDraft.trash_amount}
                      onChange={(e) =>
                        setSnapshotDraft((prev) => ({
                          ...prev,
                          trash_amount: e.target.value,
                        }))
                      }
                    />
                  </label>

                  {snapshotError && (
                    <div
                      className="admin-error-box"
                      style={{ marginBottom: 0 }}
                    >
                      {snapshotError}
                    </div>
                  )}

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                    }}
                  >
                    <button
                      type="button"
                      className="admin-small-btn"
                      disabled={savingSnapshot}
                      onClick={() => {
                        setEditingSnapshot(false);
                        setSnapshotError("");

                        setSnapshotDraft({
                          amount: String(bookingAmount),
                          trash_amount: String(trashAmount),
                        });
                      }}
                    >
                      Cancel
                    </button>

                    <button
                      className="admin-small-btn"
                      disabled={savingSnapshot}
                    >
                      <LoadingButtonContent
                        loading={savingSnapshot}
                        loadingText="Saving..."
                      >
                        Save
                      </LoadingButtonContent>
                    </button>
                  </div>
                </form>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={modalInfoStyle}>
                    <span>Kas Booking</span>

                    <strong>
                      Rp{bookingAmount.toLocaleString("id-ID")}
                    </strong>
                  </div>

                  <div style={modalInfoStyle}>
                    <span>Trash Booking</span>

                    <strong>
                      {trashAmount > 0
                        ? `Rp${trashAmount.toLocaleString("id-ID")}`
                        : "Not include"}
                    </strong>
                  </div>

                  <div style={totalModalRowStyle}>
                    <span>Total Payment</span>

                    <strong>
                      Rp{totalBookingPayment.toLocaleString("id-ID")}
                    </strong>
                  </div>

                  <div style={modalInfoStyle}>
                    <span>Created At</span>

                    <strong>
                      {selectedBooking.created_at || "-"}
                    </strong>
                  </div>

                  <div style={modalInfoStyle}>
                    <span>Paid At</span>

                    <strong>
                      {selectedBooking.paid_at || "-"}
                    </strong>
                  </div>

                  <div
                    style={{
                      paddingTop: 12,
                      borderTop:
                        "1px solid var(--admin-border)",
                      color: "var(--admin-muted)",
                      fontSize: 12,
                      lineHeight: 1.6,
                    }}
                  >
                    Snapshot mengikuti tarif saat booking dibuat.
                  </div>

                  {canEditSnapshot && (
                    <button
                      type="button"
                      className="admin-small-btn"
                      onClick={() => setEditingSnapshot(true)}
                    >
                      Edit Snapshot
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const infoRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  color: "var(--admin-text)",
  fontSize: 13,
};

const totalRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  marginTop: 2,
  paddingTop: 12,
  borderTop: "1px solid var(--admin-border)",
  color: "var(--admin-text)",
  fontSize: 14,
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

const totalModalRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  paddingTop: 12,
  borderTop: "1px solid var(--admin-border)",
  color: "var(--admin-text)",
  fontSize: 14,
  fontWeight: 700,
};

const snapshotLabelStyle = {
  display: "grid",
  gap: 6,
  color: "var(--admin-muted)",
  fontSize: 13,
  fontWeight: 700,
};