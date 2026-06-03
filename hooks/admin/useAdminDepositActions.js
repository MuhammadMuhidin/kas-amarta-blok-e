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
      showPopup("Select a house and booking period first", "error");
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
      showPopup("Booking payment saved successfully", "success");
      setDepositForm({ person_id: "", end_period: "" });
      await loadDeposit();
    } catch (err) {
      showPopup(err.message || "Failed to save booking data", "error");
    } finally {
      setSavingDeposit(false);
    }
  }

  async function payDeposit(id, options = {}) {
    const silent = Boolean(options.silent);
    setPayingDepositId(id);

    try {
      await payDepositBooking({ id, action: "PAY_NOW" });

      if (!silent) {
        showPopup("Booking payment paid successfully", "success");
        await Promise.all([loadDeposit(), loadPayment(), loadTrash(), loadCashflow()]);
      }

      return { ok: true };
    } catch (err) {
      const message = err.message || "Failed to pay booking data";

      if (!silent) {
        showPopup(message, "error");
      }

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