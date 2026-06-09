"use client";

import { useMemo, useRef, useState } from "react";

function money(value) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
}

export default function PaymentProofUploadForm({ resident, payments = [], selectedPeriod, onSubmitted }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const fileInputRef = useRef(null);
  const suggestedAmount = useMemo(() => {
    const latestPayment = [...payments]
      .filter((payment) => Number(payment.amount || 0) > 0)
      .sort((a, b) => String(b.period || "").localeCompare(String(a.period || "")))[0];

    return Number(latestPayment?.amount || 0);
  }, [payments]);

  async function submitProof(event) {
    event.preventDefault();

    if (submitting) return;
    if (!proofFile) {
      setMessage({ type: "error", text: "Bukti pembayaran wajib dilampirkan." });
      return;
    }

    const proofAmount = Number(amount || suggestedAmount || 0);

    if (!Number.isFinite(proofAmount) || proofAmount <= 0) {
      setMessage({ type: "error", text: "Nominal pembayaran wajib diisi." });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("person_id", resident.id);
      formData.append("period", selectedPeriod);
      formData.append("amount", String(proofAmount));
      formData.append("note", note);
      formData.append("proof", proofFile);

      const res = await fetch("/api/payment-proofs", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data.error || "Gagal mengirim bukti pembayaran");

      setAmount("");
      setNote("");
      setProofFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMessage({ type: "success", text: "Bukti pembayaran berhasil dikirim. Menunggu persetujuan admin." });
      await onSubmitted?.();
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Gagal mengirim bukti pembayaran" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submitProof} style={{ display: "grid", gap: 10 }}>
      <input
        className="admin-input"
        type="number"
        min="1"
        placeholder={suggestedAmount ? `Nominal, contoh ${money(suggestedAmount)}` : "Nominal pembayaran"}
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
      />
      <input
        ref={fileInputRef}
        className="admin-input"
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={(event) => setProofFile(event.target.files?.[0] || null)}
      />
      <input
        className="admin-input"
        placeholder="Catatan opsional"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      {message && (
        <div className={message.type === "success" ? "admin-success-box" : "admin-error-box"}>
          {message.text}
        </div>
      )}
      <button className="admin-btn" disabled={submitting}>
        {submitting ? "Mengirim..." : "Kirim Bukti Pembayaran"}
      </button>
    </form>
  );
}
