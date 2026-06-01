"use client";

import { useState } from "react";
import { getDepositStatus as resolveDepositStatus } from "@/lib/depositUtils";

export default function useAdminDepositActions({
  currentPeriod,
  normalize,
  depositForm,
  setDepositForm,
  selectedDepositPerson,
  selectedDepositPeriods,
  depositAmount,
  loadDeposit,
  loadPayment,
  loadTrash,
  loadCashflow,
  showPopup,
  createDeposit,
  payDepositBooking,
}) {
  const [savingDeposit, setSavingDeposit] = useState(false);
  const [payingDepositId, setPayingDepositId] = useState("");

  function getDepositStatus(deposit) {
    return resolveDepositStatus(deposit, currentPeriod, normalize);
  }

  async function saveDeposit(e) {
    e.preventDefault();

    if (!selectedDepositPerson || selectedDepositPeriods.length === 0) {
      showPopup("Pilih rumah dan periode booking terlebih dahulu", "error");
      return;
    }

    setSavingDeposit(true);

    try {
      await createDeposit({
        person_id: selectedDepositPerson.id,
        house: selectedDepositPerson.house,
        name: selectedDepositPerson.name,
        periods: selectedDepositPeriods,
        amount: depositAmount,
      });
      showPopup("Booking payment berhasil disimpan", "success");
      setDepositForm({ person_id: "", end_period: "" });
      await loadDeposit();
    } catch (err) {
      showPopup(err.message || "Gagal menyimpan data booking", "error");
    } finally {
      setSavingDeposit(false);
    }
  }

  async function payDeposit(id) {
    setPayingDepositId(id);

    try {
      await payDepositBooking({ id, action: "PAY_NOW" });
      showPopup("Booking payment berhasil dibayarkan", "success");
      await Promise.all([loadDeposit(), loadPayment(), loadTrash(), loadCashflow()]);
      return { ok: true };
    } catch (err) {
      const message = err.message || "Gagal membayarkan data booking";
      showPopup(message, "error");
      return { ok: false, error: message };
    } finally {
      setPayingDepositId("");
    }
  }

  return {
    savingDeposit,
    payingDepositId,
    getDepositStatus,
    saveDeposit,
    payDeposit,
  };
}
