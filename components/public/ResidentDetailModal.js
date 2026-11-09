"use client";

import PaymentProofUploadForm from "@/components/public/PaymentProofUploadForm";
import { usePaymentReceipt } from "@/hooks/public/usePaymentReceipt";
import { shareSinglePaymentReceiptMinimalist } from "@/components/admin/exportMembersJpg";
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

export default function ResidentDetailModal({
  resident,
  selectedPeriod,
  payments,
  paymentConfirmations,
  appConfig,
  onSubmitted,
  onClose,
}) {
  if (!resident) return null;

  const canUpload = canUploadPaymentProof(resident);
  const helperText = getProofHelperText(resident);
  const showUploadSection = !resident.paid && !resident.notApplicable;

  // Receipt data untuk kwitansi
  const receiptData = usePaymentReceipt({
    resident,
    selectedPeriod,
    payments,
    paymentConfirmations,
    appConfig,
  });

  const handleDownloadReceipt = async () => {
    if (!receiptData) return;
    try {
      await shareSinglePaymentReceiptMinimalist({
        period: receiptData.period,
        house: receiptData.house,
        paymentDate: receiptData.paymentDate,
        cashAmount: receiptData.cashAmount,
        trashAmount: receiptData.trashAmount,
        totalAmount: receiptData.totalAmount,
        approvedBy: receiptData.approvedBy,
        approvedAt: receiptData.approvedAt,
        fileName: receiptData.fileName,
      });
    } catch (error) {
      console.error("Gagal generate kwitansi:", error);
      alert("Gagal membuat kwitansi. Silakan coba lagi.");
    }
  };

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

        {resident.paid && receiptData && (
          <div className="resident-section">
            <div className="resident-label">Kwitansi</div>
            <div className="resident-value" style={{ display: "grid", gap: 10 }}>
              <button
                type="button"
                onClick={handleDownloadReceipt}
                style={{
                  padding: "10px 16px",
                  background: "#16a34a",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  justifyContent: "center",
                }}
              >
                🧾 Unduh Kwitansi
              </button>
            </div>
          </div>
        )}

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
                  onClose={onClose}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
