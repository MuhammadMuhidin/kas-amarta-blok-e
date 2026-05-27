"use client";

import { formatDate, formatPeriod } from "@/lib/public/publicFormatters";
import {
  getLastPaymentPeriod,
  getRegisteredServices,
  getSelectedPeriodStatus,
} from "@/lib/public/publicCalculations";

export default function ResidentDetailModal({ resident, payments, onClose }) {
  if (!resident) return null;

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
          <div className="resident-label">Pembayaran terakhir</div>
          <div className="resident-value">
            {formatPeriod(getLastPaymentPeriod({ resident, payments }))}
          </div>
        </div>
      </div>
    </div>
  );
}
