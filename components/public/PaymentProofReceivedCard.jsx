"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

function formatRupiah(value) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
}

function formatSubmittedAt(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPeriod(value) {
  if (!value) return "-";
  const normalized = String(value).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(normalized)) return normalized;
  return new Date(`${normalized}-01`).toLocaleString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

function CheckmarkCircle({ size = 56, color = "#10b981" }) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimate(true), 80);
    return () => clearTimeout(timer);
  }, []);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{
        filter: `drop-shadow(0 4px 12px ${color}30)`,
        display: "block",
        margin: "0 auto",
      }}
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="11"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeDasharray={animate ? "69" : "0 69"}
        style={{
          transition: "stroke-dasharray 0.5s cubic-bezier(0.4,0,0.2,1)",
        }}
      />
      <path
        d="M7 12l3 3 7-7"
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={animate ? "22" : "0 22"}
        style={{
          transition: "stroke-dasharray 0.35s 0.25s cubic-bezier(0.4,0,0.2,1)",
        }}
      />
    </svg>
  );
}

const OVERLAY_STYLE = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  background: "rgba(0, 0, 0, 0.5)",
  backdropFilter: "blur(2px)",
  WebkitBackdropFilter: "blur(2px)",
};

const CARD_STYLE = {
  width: "100%",
  maxWidth: 400,
  padding: 24,
  borderRadius: 18,
  background: "#fff",
  boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18)",
  border: "1px solid #eef2f7",
  animation: "slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1)",
};

const HEADER_STYLE = {
  textAlign: "center",
  marginBottom: 20,
};

const TITLE_STYLE = {
  margin: "12px 0 6px",
  fontSize: 20,
  fontWeight: 800,
  color: "#064e3b",
};

const SUBTITLE_STYLE = {
  margin: 0,
  color: "#6b7280",
  fontSize: 13,
};

const RECEIPT_STYLE = {
  background: "#f0fdf4",
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
};

const ROW_STYLE = {
  display: "flex",
  justifyContent: "space-between",
  padding: "8px 0",
  fontSize: 14,
};

const LABEL_STYLE = {
  color: "#374151",
  fontWeight: 500,
};

const VALUE_STYLE = {
  color: "#111827",
  fontWeight: 600,
  textAlign: "right",
  maxWidth: "65%",
};

const TOTAL_ROW_STYLE = {
  ...ROW_STYLE,
  borderTop: "1px dashed #d1d5db",
  paddingTop: 12,
  marginTop: 8,
};

const TOTAL_LABEL_STYLE = {
  ...LABEL_STYLE,
  fontSize: 15,
  fontWeight: 700,
};

const TOTAL_VALUE_STYLE = {
  ...VALUE_STYLE,
  fontSize: 18,
  fontWeight: 800,
  color: "#10b981",
};

const STATUS_VALUE_STYLE = {
  ...VALUE_STYLE,
  color: "#f59e0b",
  fontWeight: 700,
};

const INFO_BOX_STYLE = {
  display: "flex",
  gap: 10,
  background: "#fffbeb",
  borderRadius: 12,
  padding: 14,
  marginBottom: 20,
  fontSize: 13,
  color: "#78350f",
};

const INFO_ICON_STYLE = {
  fontSize: 18,
  flexShrink: 0,
  marginTop: 2,
};

const INFO_TEXT_STYLE = {
  flex: 1,
};

const INFO_LIST_STYLE = {
  margin: "8px 0 0",
  paddingLeft: 18,
  fontSize: 13,
  lineHeight: 1.7,
};

const CLOSE_BTN_STYLE = {
  width: "100%",
  padding: "14px",
  borderRadius: 12,
  border: 0,
  background: "#10b981",
  color: "#042f2e",
  fontWeight: 800,
  fontSize: 16,
  cursor: "pointer",
  boxShadow: "0 4px 14px rgba(16,185,129,0.3)",
  transition: "transform 0.1s ease",
};

const GLOBAL_STYLE_ID = "payment-proof-received-card-styles";

function injectGlobalStyles() {
  if (typeof document === "undefined" || document.getElementById(GLOBAL_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = GLOBAL_STYLE_ID;
  style.textContent = `
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `;
  document.head.appendChild(style);
}

function PaymentProofReceivedCardContent({
  proof,
  resident,
  onClose,
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    injectGlobalStyles();
    requestAnimationFrame(() => setShow(true));
    if (navigator.vibrate) {
      navigator.vibrate([30, 60, 30]);
    }
  }, []);

  const totalAmount = Number(proof?.amount || 0) + Number(proof?.trash_amount || 0);
  const houseNumber = resident?.house || proof?.person_house || "-";
  const periodLabel = formatPeriod(proof?.period);
  const submittedAtLabel = formatSubmittedAt(proof?.submitted_at);

  const cardStyle = {
    ...CARD_STYLE,
    opacity: show ? 1 : 0,
    transform: show ? "translateY(0) scale(1)" : "translateY(20px) scale(0.95)",
    transition: "opacity 0.4s, transform 0.4s cubic-bezier(0.34,1.56,0.64,1)",
  };

  return (
    <div style={cardStyle} role="status" aria-live="polite" aria-modal="true">
      <div style={HEADER_STYLE}>
        <CheckmarkCircle size={56} color="#10b981" />
        <h2 style={TITLE_STYLE}>Bukti Pembayaran Diterima</h2>
        <p style={SUBTITLE_STYLE}>
          Nomor referensi: <strong>{proof?.id || "-"}</strong>
        </p>
      </div>

      <div style={RECEIPT_STYLE}>
        <div style={ROW_STYLE}>
          <span style={LABEL_STYLE}>Rumah</span>
          <span style={VALUE_STYLE}>{houseNumber}</span>
        </div>
        <div style={ROW_STYLE}>
          <span style={LABEL_STYLE}>Periode</span>
          <span style={VALUE_STYLE}>{periodLabel}</span>
        </div>
        <div style={ROW_STYLE}>
          <span style={LABEL_STYLE}>Kas Bulanan</span>
          <span style={VALUE_STYLE}>{formatRupiah(proof?.amount)}</span>
        </div>
        {Number(proof?.trash_amount || 0) > 0 && (
          <div style={ROW_STYLE}>
            <span style={LABEL_STYLE}>Sampah</span>
            <span style={VALUE_STYLE}>{formatRupiah(proof?.trash_amount)}</span>
          </div>
        )}
        <div style={TOTAL_ROW_STYLE}>
          <span style={TOTAL_LABEL_STYLE}>Total Dikirim</span>
          <span style={TOTAL_VALUE_STYLE}>{formatRupiah(totalAmount)}</span>
        </div>
        <div style={ROW_STYLE}>
          <span style={LABEL_STYLE}>Waktu Submit</span>
          <span style={VALUE_STYLE}>{submittedAtLabel} WIB</span>
        </div>
        <div style={ROW_STYLE}>
          <span style={LABEL_STYLE}>Status</span>
          <span style={STATUS_VALUE_STYLE}>
            ⏳ Menunggu Verifikasi Admin
          </span>
        </div>
      </div>

      <div style={INFO_BOX_STYLE}>
        <div style={INFO_ICON_STYLE} aria-hidden="true">ℹ️</div>
        <div style={INFO_TEXT_STYLE}>
          <strong>Yang terjadi selanjutnya:</strong>
          <ul style={INFO_LIST_STYLE}>
            <li>Admin akan memverifikasi bukti transfer Anda</li>
            <li>Proses verifikasi biasanya 1×24 jam kerja</li>
            <li>Status akan berubah jadi <strong>Disetujui</strong> atau <strong>Ditolak</strong></li>
            <li>Cek riwayat di menu <strong>Riwayat Pembayaran</strong></li>
          </ul>
        </div>
      </div>

      <button
        onClick={onClose}
        style={CLOSE_BTN_STYLE}
        onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
        onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        autoFocus
      >
        Kembali
      </button>
    </div>
  );
}

export default function PaymentProofReceivedCard({
  proof,
  resident,
  onClose,
}) {
  const content = (
    <PaymentProofReceivedCardContent
      proof={proof}
      resident={resident}
      onClose={onClose}
    />
  );

  if (typeof window !== "undefined") {
    return createPortal(
      <div style={OVERLAY_STYLE} onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()}>{content}</div>
      </div>,
      document.body
    );
  }

  return null; // SSR: render nothing, will mount on client
}