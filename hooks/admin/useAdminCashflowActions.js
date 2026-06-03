"use client";

import { useState } from "react";

export default function useAdminCashflowActions({
  loadCashflow,
  showPopup,
  createCashflow,
}) {
  const [cashflow, setCashflow] = useState({ type: "", amount: "", note: "" });
  const [loadingCashflow, setLoadingCashflow] = useState(false);

  async function addCashflow(e) {
    e.preventDefault();

    if (!cashflow.type.trim() || !String(cashflow.amount || "").trim() || !cashflow.note.trim()) {
      showPopup("Complete the transaction type, amount, and note", "error");
      return;
    }

    setLoadingCashflow(true);

    try {
      await createCashflow(cashflow);
      showPopup("Transaction recorded successfully", "success");
      setCashflow({ type: "", amount: "", note: "" });
      await loadCashflow();
    } catch (err) {
      showPopup(err.message || "Failed to record transaction", "error");
    } finally {
      setLoadingCashflow(false);
    }
  }

  return {
    cashflow,
    setCashflow,
    loadingCashflow,
    addCashflow,
  };
}