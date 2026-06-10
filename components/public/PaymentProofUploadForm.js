"use client";

import { useRef, useState } from "react";

function getFileLabel(file) {
  if (!file?.name) return "Belum ada file dipilih";

  return file.name.length > 28 ? `${file.name.slice(0, 24)}...` : file.name;
}

export default function PaymentProofUploadForm({ resident, selectedPeriod, onSubmitted }) {
  const [proofFile, setProofFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState(null);
  const fileInputRef = useRef(null);

  async function submitProof(event) {
    event.preventDefault();

    if (submitting || submitted) return;
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
      setSubmitted(true);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMessage({ type: "success", text: "Bukti pembayaran berhasil dikirim. Menunggu persetujuan admin." });
      await onSubmitted?.();
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Gagal mengirim bukti pembayaran" });
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="admin-success-box">
        Bukti pembayaran berhasil dikirim. Menunggu persetujuan admin.
      </div>
    );
  }

  return (
    <form onSubmit={submitProof} style={formStyle}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={(event) => setProofFile(event.target.files?.[0] || null)}
        style={hiddenFileInputStyle}
      />

      <button
        type="button"
        style={filePickerStyle}
        onClick={() => fileInputRef.current?.click()}
      >
        <span style={filePickerButtonStyle}>Pilih File</span>
        <span style={fileNameStyle}>{getFileLabel(proofFile)}</span>
      </button>

      {message && (
        <div className={message.type === "success" ? "admin-success-box" : "admin-error-box"}>
          {message.text}
        </div>
      )}

      <button type="submit" style={submitButtonStyle} disabled={submitting}>
        {submitting ? "Mengirim..." : "Kirim Bukti Pembayaran"}
      </button>
    </form>
  );
}

const formStyle = {
  display: "grid",
  gap: 12,
};

const hiddenFileInputStyle = {
  position: "absolute",
  width: 1,
  height: 1,
  opacity: 0,
  pointerEvents: "none",
};

const filePickerStyle = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: 10,
  minHeight: 54,
  borderRadius: 14,
  border: "1px solid rgba(16, 185, 129, 0.35)",
  background: "#fff",
  color: "#064e3b",
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
};

const filePickerButtonStyle = {
  flexShrink: 0,
  padding: "9px 12px",
  borderRadius: 10,
  background: "#ecfdf5",
  border: "1px solid rgba(16, 185, 129, 0.35)",
  color: "#065f46",
  fontWeight: 800,
};

const fileNameStyle = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "#064e3b",
  fontWeight: 700,
};

const submitButtonStyle = {
  width: "100%",
  minHeight: 54,
  border: 0,
  borderRadius: 14,
  background: "#10b981",
  color: "#042f2e",
  fontWeight: 900,
  fontSize: 16,
  cursor: "pointer",
  boxShadow: "0 10px 22px rgba(16, 185, 129, 0.22)",
};
