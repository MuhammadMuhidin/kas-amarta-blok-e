"use client";

import PaymentProofUploadForm from "@/components/public/PaymentProofUploadForm";
import {
  canUploadPaymentProof,
  getPaymentConfirmationStatus,
  getRegisteredServices,
  getSelectedPeriodStatus,
} from "@/lib/public/publicCalculations";

function getProofHelperText(resident) {
  const status = String(resident?.paymentConfirmation?.status || "").toLowerCase();

  if (status === "pending") return "Bukti sedang dicek admin.";

  if (status === "rejected") {
    const reason = String(resident?.paymentConfirmation?.reject_reason || "").trim();
    return reason
      ? `Bukti sebelumnya ditolak: ${reason}. Silakan kirim ulang.`
      : "Bukti sebelumnya ditolak. Silakan kirim ulang.";
  }

  return "Sudah transfer? Upload bukti di sini.";
}

function getConfirmationStyle(resident) {
  const status = String(resident?.paymentConfirmation?.status || "").toLowerCase();

  if (resident?.paid || status === "approved") {
    return { color: "#16a34a", fontWeight: 900 };
  }

  if (status === "pending") {
    return { color: "#2563eb", fontWeight: 900 };
  }

  if (status === "rejected") {
    return { color: "#dc2626", fontWeight: 900 };
  }

  return { fontWeight: 800 };
}

export default function ResidentDetailModal({ resident, selectedPeriod, onSubmitted, onClose }) {
  if (!resident) return null;

  const canUpload = canUploadPaymentProof(resident);
  const helperText = getProofHelperText(resident);
  const showUploadSection = !resident.paid && !resident.notApplicable;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="resident-modal" onClick={(event) => event.stopPropagation()}>
        <div className="resident-house">{resident.house}</div>

        <div className="resident-section">
          <div className="resident-label">Layanan terdaftar</div>
          <div className="resident-value">{getRegisteredServices(resident)}</div>
        </div>

        <div className="resident-section">
          <div className="resident-label">Status periode dipilih</div>
          <div className="resident-value">{getSelectedPeriodStatus(resident)}</div>
        </div>

        <div className="resident-section">
          <div className="resident-label">Konfirmasi pembayaran</div>
          <div className="resident-value" style={getConfirmationStyle(resident)}>
            {getPaymentConfirmationStatus(resident)}
          </div>
        </div>

        {showUploadSection && (
          <div className="resident-section">
            <div className="resident-label">Upload bukti pembayaran</div>
            <div className="resident-value" style={{ display: "grid", gap: 10 }}>
              <small style={{ fontSize: 14, lineHeight: 1.4 }}>{helperText}</small>
              {canUpload && (
                <PaymentProofUploadForm
                  resident={resident}
                  selectedPeriod={selectedPeriod}
                  onSubmitted={onSubmitted}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
