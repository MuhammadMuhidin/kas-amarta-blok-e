"use client";

import { isImageReceipt } from "@/lib/public/publicFormatters";

export default function ReceiptPreviewModal({
  receipt,
  hasError,
  onError,
  onClose,
}) {
  if (!receipt) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Preview Nota</div>
        </div>

        <div style={{ marginBottom: 12, color: "var(--muted)", fontSize: 13, fontWeight: 600 }}>
          {receipt.note}
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {hasError ? (
            <div
              style={{
                padding: 16,
                borderRadius: 14,
                border: "1px solid rgba(220, 53, 69, 0.35)",
                background: "rgba(220, 53, 69, 0.08)",
                color: "#dc3545",
                fontWeight: 700,
                lineHeight: 1.6,
              }}
            >
              Sistem gambar sedang gangguan, mohon dicoba berkala.
            </div>
          ) : isImageReceipt(receipt.url) ? (
            <img
              src={receipt.url}
              alt="Preview nota pengeluaran"
              onError={onError}
              style={{
                width: "100%",
                maxHeight: "70vh",
                objectFit: "contain",
                borderRadius: 14,
                background: "#f8f9fa",
              }}
            />
          ) : (
            <iframe
              src={receipt.url}
              title="Preview nota pengeluaran"
              style={{
                width: "100%",
                minHeight: "70vh",
                border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: 14,
                background: "#fff",
              }}
            />
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <a
              href={receipt.url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.12)",
                color: "inherit",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              Buka asli
            </a>

            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: 0,
                background: "var(--btn-primary)",
                color: "var(--btn-text)",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
