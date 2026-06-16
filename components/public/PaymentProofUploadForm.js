"use client";

import { useEffect, useRef, useState } from "react";

const SUBMIT_LABELS = {
  idle: "Kirim Bukti",
  processing: "Memproses...",
  still_processing: "Masih Diproses...",
  almost_done: "Hampir Selesai...",
  success: "Bukti Terkirim",
  error: "Coba Lagi",
};

function getFileLabel(file) {
  if (!file?.name) return "Belum ada file dipilih";

  return file.name.length > 28 ? `${file.name.slice(0, 24)}...` : file.name;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default function PaymentProofUploadForm({ resident, selectedPeriod, onSubmitted }) {
  const [proofFile, setProofFile] = useState(null);
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState(null);
  const fileInputRef = useRef(null);
  const progressTimersRef = useRef([]);

  const submitting = ["processing", "still_processing", "almost_done"].includes(submitStatus);

  function clearProgressTimers() {
    progressTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    progressTimersRef.current = [];
  }

  function startProgress() {
    clearProgressTimers();
    setSubmitStatus("processing");
    progressTimersRef.current = [
      window.setTimeout(() => setSubmitStatus("still_processing"), 4000),
      window.setTimeout(() => setSubmitStatus("almost_done"), 8000),
    ];
  }

  useEffect(() => () => clearProgressTimers(), []);

  async function submitProof(event) {
    event.preventDefault();

    if (submitting || submitted || submitStatus === "success") return;
    if (!proofFile) {
      setSubmitStatus("error");
      setMessage({ type: "error", text: "Bukti pembayaran wajib dilampirkan." });
      return;
    }

    startProgress();
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

      clearProgressTimers();
      setProofFile(null);
      setSubmitStatus("success");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMessage({ type: "success", text: "Bukti pembayaran berhasil dikirim. Menunggu persetujuan admin." });

      await Promise.all([
        Promise.resolve().then(() => onSubmitted?.()).catch(() => undefined),
        wait(1000),
      ]);
      setSubmitted(true);
    } catch (err) {
      clearProgressTimers();
      setSubmitStatus("error");
      setMessage({ type: "error", text: err.message || "Gagal mengirim bukti pembayaran" });
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
        onChange={(event) => {
          setProofFile(event.target.files?.[0] || null);
          if (submitStatus === "error") setSubmitStatus("idle");
        }}
        style={hiddenFileInputStyle}
      />

      <button
        type="button"
        style={filePickerStyle}
        onClick={() => fileInputRef.current?.click()}
        disabled={submitting || submitStatus === "success"}
      >
        <span style={filePickerButtonStyle}>Pilih File</span>
        <span style={fileNameStyle}>{getFileLabel(proofFile)}</span>
      </button>

      {message && (
        <div className={message.type === "success" ? "admin-success-box" : "admin-error-box"}>
          {message.text}
        </div>
      )}

      <button
        type="submit"
        style={submitButtonStyle}
        disabled={submitting || submitStatus === "success"}
      >
        {SUBMIT_LABELS[submitStatus] || SUBMIT_LABELS.idle}
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
