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
      showPopup("Lengkapi jenis, nominal dan catatan transaksi", "error");
      return;
    }

    setLoadingCashflow(true);

    try {
      await createCashflow(cashflow);
      showPopup("Transaksi berhasil dicatat", "success");
      setCashflow({ type: "", amount: "", note: "" });
      await loadCashflow();
    } catch (err) {
      showPopup(err.message || "Gagal mencatat transaksi", "error");
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
