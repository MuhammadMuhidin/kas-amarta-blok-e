"use client";

import { useRef, useState } from "react";

export default function PaymentProofUploadForm({ resident, selectedPeriod, onSubmitted }) {
  const [proofFile, setProofFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const fileInputRef = useRef(null);

  async function submitProof(event) {
    event.preventDefault();

    if (submitting) return;
    if (!proofFile) {
      setMessage({ type: "error", text: "Bukti pembayaran wajib dilampirkan." });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("person_id", resident.id);
      formData.append("period", selectedPeriod);
      formData.append("proof", proofFile);

      const res = await fetch("/api/payment-proofs", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data.error || "Gagal mengirim bukti pembayaran");

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
        ref={fileInputRef}
        className="admin-input"
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={(event) => setProofFile(event.target.files?.[0] || null)}
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
