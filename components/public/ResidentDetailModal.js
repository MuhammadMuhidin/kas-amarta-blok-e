"use client";

import PaymentProofUploadForm from "@/components/public/PaymentProofUploadForm";
import { formatDate, formatPeriod } from "@/lib/public/publicFormatters";
import {
  canUploadPaymentProof,
  getLastPaymentPeriod,
  getPaymentConfirmationStatus,
  getRegisteredServices,
  getSelectedPeriodStatus,
} from "@/lib/public/publicCalculations";

function getProofHelperText(resident) {
  const status = String(resident?.paymentConfirmation?.status || "").toLowerCase();

  if (status === "pending") return "Bukti pembayaran sudah dikirim dan sedang menunggu verifikasi admin.";
  if (status === "rejected") return `Bukti sebelumnya ditolak${resident.paymentConfirmation?.reject_reason ? `: ${resident.paymentConfirmation.reject_reason}` : "."}`;
  if (resident?.paid) return "Pembayaran periode ini sudah tercatat.";

  return "Upload bukti pembayaran hanya mengirim konfirmasi. Status akan berubah menjadi sudah bayar setelah admin menyetujui.";
}

export default function ResidentDetailModal({ resident, payments, selectedPeriod, onSubmitted, onClose }) {
  if (!resident) return null;

  const canUpload = canUploadPaymentProof(resident);
  const helperText = getProofHelperText(resident);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="resident-modal" onClick={(event) => event.stopPropagation()}>
        <div className="resident-house">{resident.house}</div>

        <div className="resident-section">
          <div className="resident-label">Layanan terdaftar</div>
          <div className="resident-value">{getRegisteredServices(resident)}</div>
        </div>

        <div className="resident-section">
          <div className="resident-label">Bergabung sejak</div>
          <div className="resident-value">{formatDate(resident.join_date)}</div>
        </div>

        <div className="resident-section">
          <div className="resident-label">Status periode dipilih</div>
          <div className="resident-value">{getSelectedPeriodStatus(resident)}</div>
        </div>

        <div className="resident-section">
          <div className="resident-label">Konfirmasi pembayaran</div>
          <div className="resident-value">{getPaymentConfirmationStatus(resident)}</div>
        </div>

        <div className="resident-section">
          <div className="resident-label">Pembayaran terakhir</div>
          <div className="resident-value">
            {formatPeriod(getLastPaymentPeriod({ resident, payments }))}
          </div>
        </div>

        <div className="resident-section">
          <div className="resident-label">Upload bukti pembayaran</div>
          <div className="resident-value" style={{ display: "grid", gap: 10 }}>
            <small>{helperText}</small>
            {canUpload && (
              <PaymentProofUploadForm
                resident={resident}
                selectedPeriod={selectedPeriod}
                onSubmitted={onSubmitted}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
