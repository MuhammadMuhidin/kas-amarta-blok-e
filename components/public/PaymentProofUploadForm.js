"use client";

import { useEffect, useRef, useState } from "react";
import PaymentProofReceivedCard from "./PaymentProofReceivedCard";

const SUBMIT_LABELS = {
  idle: "Kirim Bukti",
  processing: "Memproses...",
  still_processing: "Masih Diproses...",
  almost_done: "Hampir Selesai...",
  success: "Bukti Terkirim",
  error: "Coba Lagi",
};

const MAX_IMAGE_SIZE = 1024 * 1024; // 1MB - compress jika lebih besar
const MAX_DIMENSION = 1920;
const IMAGE_QUALITY = 0.8;

function getFileLabel(file) {
  if (!file?.name) return "Belum ada file dipilih";

  return file.name.length > 28 ? `${file.name.slice(0, 24)}...` : file.name;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width *= ratio;
        height *= ratio;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        },
        file.type,
        IMAGE_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}

function maybeCompressImage(file) {
  if (!file || !file.type.startsWith("image/") || file.size <= MAX_IMAGE_SIZE) {
    return Promise.resolve(file);
  }
  return compressImage(file);
}

export default function PaymentProofUploadForm({ resident, selectedPeriod, onSubmitted }) {
  const [proofFile, setProofFile] = useState(null);
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [submitted, setSubmitted] = useState(false);
  const [proofData, setProofData] = useState(null);
  const [message, setMessage] = useState(null);
  const fileInputRef = useRef(null);
  const progressTimersRef = useRef([]);
  const submitLockRef = useRef(false);

  const submitting = ["processing", "still_processing", "almost_done"].includes(submitStatus);
  const blocked = submitting || submitted || submitStatus === "success";

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

    if (submitLockRef.current || blocked) return;
    if (!proofFile) {
      setSubmitStatus("error");
      setMessage({ type: "error", text: "Bukti pembayaran wajib dilampirkan." });
      return;
    }

    submitLockRef.current = true;
    startProgress();
    setMessage(null);

    try {
      // Compress image jika perlu sebelum upload
      const fileToUpload = await maybeCompressImage(proofFile);

      const formData = new FormData();
      formData.append("person_id", resident.id);
      formData.append("period", selectedPeriod);
      formData.append("proof", fileToUpload);

      const res = await fetch("/api/payment-proofs", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data.error || "Gagal mengirim bukti pembayaran");

      clearProgressTimers();
      setProofFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setProofData(data.proof); // simpan proof object dari response

      await Promise.all([
        Promise.resolve().then(() => onSubmitted?.()).catch(() => undefined),
        wait(1000),
      ]);
      setSubmitted(true);
    } catch (err) {
      clearProgressTimers();
      submitLockRef.current = false;
      setSubmitStatus("error");
      setMessage({ type: "error", text: err.message || "Gagal mengirim bukti pembayaran" });
    }
  }

  function handleCloseSuccess() {
    setSubmitted(false);
    setProofData(null);
    onSubmitted?.();
  }

  if (submitted && proofData) {
    return (
      <PaymentProofReceivedCard
        proof={proofData}
        resident={resident}
        onClose={handleCloseSuccess}
      />
    );
  }

  return (
    <form onSubmit={submitProof} style={formStyle}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={async (event) => {
          const file = event.target.files?.[0] || null;
          if (file) {
            const compressed = await maybeCompressImage(file);
            setProofFile(compressed);
          } else {
            setProofFile(null);
          }
          if (submitStatus === "error") setSubmitStatus("idle");
        }}
        style={hiddenFileInputStyle}
      />

      <button
        type="button"
        style={{ ...filePickerStyle, ...(blocked ? disabledButtonStyle : {}) }}
        onClick={() => fileInputRef.current?.click()}
        disabled={blocked}
        aria-busy={submitting}
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
        style={{ ...submitButtonStyle, ...(blocked ? disabledButtonStyle : {}) }}
        disabled={blocked}
        aria-busy={submitting}
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

const disabledButtonStyle = {
  pointerEvents: "none",
  cursor: "not-allowed",
  opacity: 0.65,
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
