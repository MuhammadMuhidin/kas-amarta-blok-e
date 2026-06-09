"use client";

import { readJson, sendJson } from "@/components/admin/adminClientApi";
import LoadingButtonContent from "@/components/admin/LoadingButtonContent";
import { useEffect, useState } from "react";

function money(value) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPeriod(period) {
  if (!period || !/^\d{4}-\d{2}$/.test(String(period).slice(0, 7))) return period || "-";

  return new Date(`${String(period).slice(0, 7)}-01`).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

function isImageProof(proof) {
  return String(proof?.proof_mime_type || "").startsWith("image/");
}

function getTrashLabel(proof) {
  return proof?.is_trash_user ? "Ikut sampah" : "Tidak ikut sampah";
}

function useModalScrollLock(open) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;

    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [open]);
}

function ProofAmountBreakdown({ proof }) {
  const cashAmount = Number(proof?.cash_amount ?? proof?.amount ?? 0);
  const trashAmount = Number(proof?.trash_amount || 0);
  const totalAmount = Number(proof?.total_amount || cashAmount + trashAmount);

  return (
    <div style={styles.breakdownCard}>
      <div style={styles.breakdownHeader}>
        <span>Nominal untuk dicocokkan</span>
        <strong>{money(totalAmount)}</strong>
      </div>
      <div style={styles.breakdownRows}>
        <div style={styles.breakdownRow}>
          <span>Kas</span>
          <strong>{money(cashAmount)}</strong>
        </div>
        <div style={styles.breakdownRow}>
          <span>Sampah</span>
          <strong>{proof?.is_trash_user ? money(trashAmount) : "-"}</strong>
        </div>
        <div style={styles.breakdownRow}>
          <span>Status sampah</span>
          <strong>{getTrashLabel(proof)}</strong>
        </div>
      </div>
    </div>
  );
}

function ProofPreview({ proof }) {
  if (!proof?.proof_url) return <div className="admin-empty-state">Bukti pembayaran tidak tersedia.</div>;

  if (isImageProof(proof)) {
    return (
      <div style={styles.previewFrame}>
        <img
          src={proof.proof_url}
          alt={`Bukti pembayaran ${proof.person_house}`}
          style={styles.previewImage}
        />
      </div>
    );
  }

  return (
    <a className="admin-small-btn" href={proof.proof_url} target="_blank" rel="noreferrer">
      Buka Bukti PDF
    </a>
  );
}

function ProofDetailModal({ proof, onClose }) {
  useModalScrollLock(Boolean(proof));

  if (!proof) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div style={styles.modalTitleGroup}>
            <div className="modal-title">Bukti Pembayaran {proof.person_house}</div>
            <div className="modal-section">{formatPeriod(proof.period)} • {proof.person_name || "-"}</div>
          </div>
        </div>
        <ProofAmountBreakdown proof={proof} />
        <ProofPreview proof={proof} />
      </div>
    </div>
  );
}

function ProofRejectModal({ proof, reason, processing, onReasonChange, onCancel, onSubmit }) {
  useModalScrollLock(Boolean(proof));

  if (!proof) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" style={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div style={styles.modalHeaderTop}>
            <div style={styles.modalTitleGroup}>
              <div className="modal-title">Reject Bukti Pembayaran</div>
              <div className="modal-section">{proof.person_house} • {formatPeriod(proof.period)}</div>
            </div>
          </div>
        </div>
        <textarea
          className="admin-input"
          rows={4}
          placeholder="Alasan penolakan wajib diisi"
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
        />
        <div style={styles.modalActions}>
          <button type="button" className="admin-small-btn" disabled={processing} onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className="admin-btn"
            disabled={processing || !reason.trim()}
            onClick={onSubmit}
          >
            <LoadingButtonContent loading={processing} loadingText="Reject...">
              Reject Bukti
            </LoadingButtonContent>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentProofReviewCard({ onReviewed }) {
  const [proofs, setProofs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState("");
  const [selectedProof, setSelectedProof] = useState(null);
  const [rejectingProof, setRejectingProof] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState("");

  async function loadProofs() {
    setLoading(true);
    setError("");

    try {
      const data = await readJson("/api/admin/payment-proofs?status=pending");
      setProofs(Array.isArray(data?.proofs) ? data.proofs : []);
    } catch (err) {
      setError(err.message || "Gagal memuat bukti pembayaran");
      setProofs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProofs();
  }, []);

  async function reviewProof(proof, action, reason = "") {
    if (!proof?.id || processingId) return;

    setProcessingId(`${action}:${proof.id}`);
    setError("");

    try {
      await sendJson(`/api/admin/payment-proofs/${proof.id}/review`, "PATCH", { action, reason });
      setSelectedProof(null);
      setRejectingProof(null);
      setRejectReason("");
      await loadProofs();
      await onReviewed?.();
    } catch (err) {
      setError(err.message || "Gagal memproses bukti pembayaran");
    } finally {
      setProcessingId("");
    }
  }

  return (
    <div className="admin-card" style={styles.card}>
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>Konfirmasi Pembayaran Warga</h3>
          <p style={styles.description}>Bukti pembayaran dari warga menunggu verifikasi admin. Payment manual tetap bisa digunakan seperti biasa.</p>
        </div>
      </div>

      {error && <div className="admin-error-box">{error}</div>}

      {loading ? (
        <p>Loading bukti pembayaran...</p>
      ) : proofs.length === 0 ? (
        <div className="admin-empty-state">Belum ada bukti pembayaran yang menunggu verifikasi.</div>
      ) : (
        <div style={styles.list}>
          {proofs.map((proof) => (
            <div key={proof.id} style={styles.item}>
              <div>
                <strong>{proof.person_house} — {formatPeriod(proof.period)}</strong>
                <div style={styles.meta}>
                  {proof.person_name || "-"} • {getTrashLabel(proof)} • Total {money(proof.total_amount || proof.amount)} • {formatDateTime(proof.submitted_at)}
                </div>
              </div>
              <div style={styles.actions}>
                <button type="button" className="admin-small-btn" onClick={() => setSelectedProof(proof)}>Detail Bukti</button>
                <button
                  type="button"
                  className="admin-small-btn"
                  disabled={Boolean(processingId)}
                  onClick={() => reviewProof(proof, "approve")}
                >
                  <LoadingButtonContent loading={processingId === `approve:${proof.id}`} loadingText="Approve...">
                    Approve
                  </LoadingButtonContent>
                </button>
                <button
                  type="button"
                  className="admin-small-btn"
                  disabled={Boolean(processingId)}
                  onClick={() => setRejectingProof(proof)}
                  style={styles.rejectButton}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ProofDetailModal proof={selectedProof} onClose={() => setSelectedProof(null)} />
      <ProofRejectModal
        proof={rejectingProof}
        reason={rejectReason}
        processing={processingId === `reject:${rejectingProof?.id}`}
        onReasonChange={setRejectReason}
        onCancel={() => setRejectingProof(null)}
        onSubmit={() => reviewProof(rejectingProof, "reject", rejectReason)}
      />
    </div>
  );
}

const styles = {
  card: { marginBottom: 16 },
  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  title: { margin: 0 },
  description: { margin: "8px 0 0", color: "var(--admin-muted)", fontSize: 13, lineHeight: 1.5 },
  list: { display: "grid", gap: 10 },
  item: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: 12, border: "1px solid var(--admin-border)", borderRadius: 12, background: "var(--admin-row)" },
  meta: { marginTop: 4, color: "var(--admin-muted)", fontSize: 12, fontWeight: 700, lineHeight: 1.5 },
  actions: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
  rejectButton: { borderColor: "var(--admin-expense)", color: "var(--admin-expense)" },
  modal: { width: "min(100%, 760px)", maxHeight: "calc(100dvh - 24px)", display: "grid", gap: 14, overflow: "auto" },
  modalHeaderTop: { width: "100%", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 },
  modalTitleGroup: { display: "grid", gap: 6 },
  previewFrame: { display: "grid", placeItems: "center", minHeight: 240, borderRadius: 12, border: "1px solid var(--admin-border)", background: "var(--admin-row)", overflow: "hidden" },
  previewImage: { width: "100%", maxHeight: "70dvh", objectFit: "contain", display: "block" },
  breakdownCard: { display: "grid", gap: 10, padding: 12, borderRadius: 12, border: "1px solid var(--admin-border)", background: "var(--admin-row)" },
  breakdownHeader: { display: "flex", justifyContent: "space-between", gap: 12, color: "var(--admin-text)", fontWeight: 900, fontSize: 14 },
  breakdownRows: { display: "grid", gap: 6 },
  breakdownRow: { display: "flex", justifyContent: "space-between", gap: 12, color: "var(--admin-muted)", fontSize: 13, fontWeight: 800 },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" },
};
