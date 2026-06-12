"use client";

import { useEffect, useMemo, useState } from "react";
import Toast from "@/components/Toast";
import "@/app/page.css";
import "@/app/public-theme.css";

const APPROVAL_REQUESTS_API = "/api/approval-requests";

function money(value) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
}

function prettyStatus(status = "") {
  const map = {
    submitted: "Terkirim",
    waiting_payment_validation: "Menunggu Validasi",
    waiting_approval: "Dalam Proses",
    completed: "Selesai",
    rejected: "Ditolak",
    cancelled: "Dibatalkan",
  };
  return map[status] || status || "-";
}

function prettyAction(action = "") {
  const map = {
    submit: "Dikirim",
    approve: "Disetujui",
    final_approval: "Disetujui",
    reject: "Ditolak",
    cancel: "Dibatalkan",
    validate_payment: "Divalidasi",
    payment_validated: "Divalidasi",
  };
  return map[action] || action || "-";
}

function getStatusClass(status) {
  if (status === "completed") return "is-success";
  if (["rejected", "cancelled"].includes(status)) return "is-danger";
  if (["waiting_payment_validation", "waiting_approval", "submitted"].includes(status)) return "is-warning";
  return "is-muted";
}

function StatusBadge({ status }) {
  return <span className={`request-status ${getStatusClass(status)}`}>{prettyStatus(status)}</span>;
}

function formatTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function currentApprovalPosition(request = {}) {
  const role = String(request.current_approver_role || "").trim();
  if (role) return `Ada di ${role}`;
  if (request.status === "completed") return "Sudah selesai / full approved";
  if (request.status === "rejected") return "Sudah ditolak";
  if (request.status === "cancelled") return "Dibatalkan";
  return "-";
}

function StatusDetailModal({ result, onClose }) {
  if (!result?.request) return null;
  const request = result.request;
  const actions = result.actions || [];

  return (
    <div className="request-modal-overlay" onClick={onClose}>
      <div className="request-modal-box" onClick={(event) => event.stopPropagation()}>
        <div className="request-modal-header">
          <div>
            <span className="request-kicker">{request.request_no}</span>
            <h3>{request.master_name || "Detail Pengajuan"}</h3>
          </div>
          <div className="request-modal-actions">
            <StatusBadge status={request.status} />
            <button type="button" className="request-modal-close" onClick={onClose} aria-label="Close status detail">×</button>
          </div>
        </div>

        <div className="request-meta-grid">
          <div><span>Nomor Pengajuan</span><strong>{request.request_no || "-"}</strong></div>
          <div><span>Status</span><strong>{prettyStatus(request.status)}</strong></div>
          <div><span>Approval Saat Ini Ada Di</span><strong>{currentApprovalPosition(request)}</strong></div>
          <div><span>Nominal</span><strong>{Number(request.amount || 0) > 0 ? money(request.amount) : "-"}</strong></div>
          <div><span>Nama Pemohon</span><strong>{request.requester_name || "-"}</strong></div>
          <div><span>Nomor Rumah</span><strong>{request.requester_house || "-"}</strong></div>
          <div><span>Diajukan Pada</span><strong>{formatTime(request.submitted_at)}</strong></div>
          <div><span>Update Terakhir</span><strong>{formatTime(request.updated_at)}</strong></div>
        </div>

        <div className="request-modal-section-title">Riwayat Pengajuan</div>
        <div className="request-timeline">
          {actions.length ? actions.map((action) => (
            <div key={action.id} className="request-timeline-item">
              <span />
              <div>
                <strong>{prettyAction(action.action)}</strong>
                <small>{action.role || "-"} • {formatTime(action.created_at)}</small>
                {action.note ? <p>{action.note}</p> : null}
              </div>
            </div>
          )) : <div className="request-empty-state">Belum ada riwayat approval.</div>}
        </div>
      </div>
    </div>
  );
}

export default function PengajuanPage() {
  const [masters, setMasters] = useState([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [checkForm, setCheckForm] = useState({ request_no: "" });
  const [statusResult, setStatusResult] = useState(null);
  const [message, setMessage] = useState(null);

  const selectedMaster = useMemo(() => masters.find((item) => item.code === selectedCode) || null, [masters, selectedCode]);

  function showMessage(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3200);
  }

  async function loadMasters() {
    try {
      const res = await fetch(APPROVAL_REQUESTS_API, { cache: "no-store" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal membaca master pengajuan");
      setMasters(result.masters || []);
      if (result.masters?.[0]?.code) setSelectedCode(result.masters[0].code);
    } catch (err) {
      showMessage(err.message, "error");
    }
  }

  function updateForm(key, value) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  async function submitRequest(event) {
    event.preventDefault();
    if (!selectedMaster) return;

    try {
      setSubmitting(true);
      setSubmitResult(null);
      const res = await fetch(APPROVAL_REQUESTS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ master_code: selectedMaster.code, form_data: formData }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal membuat pengajuan");
      setSubmitResult(result);
      setCheckForm((prev) => ({ ...prev, request_no: result.request?.request_no || prev.request_no }));
      showMessage("Pengajuan berhasil dibuat");
    } catch (err) {
      showMessage(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function checkStatus(event) {
    event.preventDefault();
    try {
      setStatusResult(null);
      const params = new URLSearchParams({ request_no: checkForm.request_no });
      const res = await fetch(`${APPROVAL_REQUESTS_API}?${params.toString()}`, { cache: "no-store" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal cek status");
      setStatusResult(result);
    } catch (err) {
      showMessage(err.message, "error");
    }
  }

  useEffect(() => {
    loadMasters();
  }, []);

  useEffect(() => {
    if (!statusResult?.request) return undefined;

    const body = document.body;
    const html = document.documentElement;
    const scrollY = window.scrollY;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyPosition = body.style.position;
    const previousBodyTop = body.style.top;
    const previousBodyWidth = body.style.width;
    const previousBodyTouchAction = body.style.touchAction;
    const previousHtmlOverflow = html.style.overflow;

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.touchAction = "none";
    html.style.overflow = "hidden";

    return () => {
      body.style.overflow = previousBodyOverflow;
      body.style.position = previousBodyPosition;
      body.style.top = previousBodyTop;
      body.style.width = previousBodyWidth;
      body.style.touchAction = previousBodyTouchAction;
      html.style.overflow = previousHtmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [statusResult]);

  return (
    <main className="request-page">
      <style jsx global>{requestPageCss}</style>
      <Toast show={!!message} type={message?.type} message={message?.text} />
      <StatusDetailModal result={statusResult} onClose={() => setStatusResult(null)} />

      <section className="request-card request-check-card">
        <div className="request-card-header">
          <div>
            <span className="request-kicker">Cek Status</span>
            <h2>Cek Status Pengajuan</h2>
          </div>
        </div>
        <p className="request-muted">Gunakan nomor pengajuan untuk melihat status dan riwayat proses.</p>
        <form onSubmit={checkStatus} className="request-check-grid request-check-grid-single">
          <input className="request-input" placeholder="Contoh: APR-202606-0001" value={checkForm.request_no} onChange={(e) => setCheckForm((prev) => ({ ...prev, request_no: e.target.value }))} />
          <button type="submit" className="request-secondary-btn">Cek Status</button>
        </form>
      </section>

      <section className="request-card request-master-card">
        <div className="request-card-header">
          <div>
            <span className="request-kicker">Pengajuan Baru</span>
            <h2>Buat Pengajuan Baru</h2>
          </div>
          {selectedMaster?.payment_required ? (
            <span className="request-price" aria-label={`Biaya pengajuan ${money(selectedMaster.payment_amount)}`}>
              <small>Biaya Pengajuan</small>
              <strong>{money(selectedMaster.payment_amount)}</strong>
            </span>
          ) : <span className="request-price muted">Gratis</span>}
        </div>

        <form onSubmit={submitRequest} className="request-form">
          <label className="request-label">Jenis Pengajuan
            <select className="request-input" value={selectedCode} onChange={(e) => { setSelectedCode(e.target.value); setFormData({}); setSubmitResult(null); }}>
              {masters.map((master) => <option key={master.code} value={master.code}>{master.name}</option>)}
            </select>
          </label>

          {selectedMaster?.description ? <div className="request-info">{selectedMaster.description}</div> : null}
          {selectedMaster?.payment_required ? <div className="request-payment"><strong>Perlu Pembayaran</strong><span>{selectedMaster.payment_instruction}</span></div> : null}

          {(selectedMaster?.fields_schema || []).map((field) => (
            <label key={field.key} className="request-label">
              {field.label}{field.required ? " *" : ""}
              {field.type === "textarea" ? (
                <textarea className="request-input" rows={3} value={formData[field.key] || ""} onChange={(e) => updateForm(field.key, e.target.value)} />
              ) : (
                <input className="request-input" value={formData[field.key] || ""} onChange={(e) => updateForm(field.key, e.target.value)} />
              )}
            </label>
          ))}

          <button type="submit" className="request-primary-btn" disabled={submitting || !selectedMaster}>{submitting ? "Mengirim..." : "Kirim Pengajuan"}</button>
        </form>

        {submitResult?.request ? (
          <div className="request-success-panel">
            <div className="request-success-icon">✓</div>
            <div>
              <strong>Pengajuan berhasil dibuat</strong>
              <p>Nomor pengajuan: <b>{submitResult.request.request_no}</b></p>
              <StatusBadge status={submitResult.request.status} />
              {submitResult.request.amount > 0 ? <p>Nominal: <b>{money(submitResult.request.amount)}</b></p> : null}
              {submitResult.payment_instruction ? <small>{submitResult.payment_instruction}</small> : null}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

const requestPageCss = `
  body:has(.request-page) {
    background: var(--bg) !important;
    color: var(--text);
    font-family: Inter, Arial, sans-serif;
    font-size: var(--font-base);
  }

  .request-page {
    width: 100%;
    max-width: 1060px;
    margin: 0 auto;
    padding: 12px 10px calc(104px + env(safe-area-inset-bottom, 0px));
    font-family: Inter, Arial, sans-serif;
    font-size: var(--font-base);
    color: var(--text);
  }

  .request-card {
    position: relative;
    overflow: hidden;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    border-radius: var(--radius);
    box-shadow: var(--shadow-soft);
    padding: 12px 14px;
    margin-bottom: 10px;
  }

  .request-master-card { border-color: color-mix(in srgb, var(--success) 18%, var(--border)); }
  .request-check-card { border-color: color-mix(in srgb, var(--primary) 22%, var(--border)); }

  .request-kicker { color: var(--primary); font-size: var(--font-small); font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }

  .request-card-header,
  .request-status-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 12px; }

  .request-card h2,
  .request-status-top h3,
  .request-modal-header h3 { margin: 3px 0 0; color: var(--text); line-height: 1.2; font-weight: 800; }

  .request-card h2 { font-size: 19px; }
  .request-status-top h3,
  .request-modal-header h3 { font-size: 19px; }

  .request-muted { margin: 0; color: var(--muted); font-size: var(--font-base); font-weight: 500; line-height: 1.45; }

  .request-price { flex: 0 0 auto; min-width: 124px; max-width: min(44vw, 170px); padding: 7px 10px; border-radius: var(--radius-sm); border: 1px solid color-mix(in srgb, var(--success) 38%, var(--border)); background: color-mix(in srgb, var(--success) 11%, var(--surface)); color: var(--text); display: inline-flex; flex-direction: column; align-items: flex-end; justify-content: center; gap: 2px; text-align: right; line-height: 1.15; }
  .request-price small { color: var(--muted); font-size: 10.5px; font-weight: 800; letter-spacing: .02em; text-transform: uppercase; white-space: nowrap; }
  .request-price strong { color: var(--success); font-size: var(--font-base); font-weight: 800; white-space: nowrap; }
  .request-price.muted { min-width: auto; border-color: var(--border); background: var(--surface-soft); color: var(--muted); font-size: var(--font-base); font-weight: 800; }

  .request-form,
  .request-check-grid { display: grid; gap: 12px; }

  .request-check-grid { grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); margin-top: 14px; }
  .request-check-grid-single { grid-template-columns: minmax(0, 1fr) auto; }

  .request-label { display: grid; gap: 6px; color: var(--muted); font-size: var(--font-small); font-weight: 700; }

  .request-input { width: 100%; min-height: 44px; box-sizing: border-box; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); padding: 0 12px; outline: none; font-family: Inter, Arial, sans-serif; font-size: var(--font-base); font-weight: 500; }
  textarea.request-input { min-height: 92px; padding-top: 10px; padding-bottom: 10px; resize: vertical; }
  .request-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 13%, transparent); }

  .request-info,
  .request-payment,
  .request-success-panel,
  .request-status-panel { border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface-soft); padding: 12px 14px; color: var(--text); font-size: var(--font-base); }

  .request-payment { display: grid; gap: 4px; border-color: color-mix(in srgb, var(--primary) 24%, var(--border)); }
  .request-payment span { color: var(--muted); font-size: var(--font-base); font-weight: 500; line-height: 1.45; }

  .request-primary-btn,
  .request-secondary-btn { min-height: 44px; border: 1px solid var(--primary); border-radius: var(--radius-sm); background: var(--primary); color: var(--tab-active-text); font-family: Inter, Arial, sans-serif; font-size: var(--font-base); font-weight: 700; cursor: pointer; box-shadow: var(--shadow-soft); white-space: nowrap; }
  .request-secondary-btn { border-color: var(--border); background: var(--surface); color: var(--text); box-shadow: var(--shadow-soft); padding: 0 16px; }
  .request-primary-btn:disabled { opacity: .6; cursor: not-allowed; }

  .request-success-panel { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 12px; margin-top: 14px; border-color: color-mix(in srgb, var(--success) 34%, var(--border)); }
  .request-success-icon { width: 34px; height: 34px; border-radius: 999px; display: grid; place-items: center; background: var(--success); color: var(--tab-active-text); font-weight: 800; }
  .request-success-panel p { margin: 5px 0; color: var(--muted); font-size: var(--font-base); font-weight: 500; }
  .request-success-panel small { display: block; margin-top: 8px; color: var(--muted); line-height: 1.45; font-size: var(--font-small); }

  .request-status { display: inline-flex; width: fit-content; min-height: 34px; align-items: center; justify-content: center; padding: 0 12px; border-radius: 999px; font-size: var(--font-small); font-weight: 700; line-height: 1; text-align: center; white-space: nowrap; }
  .request-status.is-success { background: color-mix(in srgb, var(--success) 15%, var(--surface)); color: var(--text); border: 1px solid color-mix(in srgb, var(--success) 36%, var(--border)); }
  .request-status.is-warning { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
  .request-status.is-danger { background: color-mix(in srgb, var(--danger) 13%, var(--surface)); color: var(--text); border: 1px solid color-mix(in srgb, var(--danger) 36%, var(--border)); }
  .request-status.is-muted { background: var(--surface-soft); color: var(--muted); border: 1px solid var(--border); }

  .request-meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; margin: 12px 0; }
  .request-meta-grid div { padding: 10px 12px; border-radius: var(--radius-sm); background: var(--surface); border: 1px solid var(--border); display: grid; gap: 4px; }
  .request-meta-grid span { color: var(--muted); font-size: var(--font-small); font-weight: 700; text-transform: uppercase; }
  .request-meta-grid strong { color: var(--text); font-size: var(--font-base); }

  .request-timeline { display: grid; gap: 10px; margin-top: 12px; }
  .request-timeline-item { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px; align-items: start; }
  .request-timeline-item > span { width: 11px; height: 11px; margin-top: 6px; border-radius: 999px; background: var(--primary); box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 12%, transparent); }
  .request-timeline-item div { padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); }
  .request-timeline-item strong { display: block; color: var(--text); text-transform: capitalize; font-size: var(--font-base); }
  .request-timeline-item small { display: block; color: var(--muted); margin-top: 3px; font-size: var(--font-small); }
  .request-timeline-item p { margin: 6px 0 0; color: var(--muted); font-size: var(--font-base); }

  .request-modal-overlay { position: fixed; inset: 0; z-index: 9999; display: grid; place-items: start center; overflow-y: auto; overscroll-behavior: contain; padding: 14px 14px calc(110px + env(safe-area-inset-bottom, 0px)); background: rgba(15, 23, 42, .55); backdrop-filter: blur(4px); }
  .request-modal-box { width: min(720px, 100%); max-height: calc(100dvh - 28px); overflow: auto; overscroll-behavior: contain; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow-soft); padding: 14px; }
  .request-modal-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
  .request-modal-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex: 0 0 auto; }
  .request-modal-close { width: 34px; height: 34px; border-radius: 999px; border: 1px solid var(--border); background: var(--surface-soft); color: var(--text); font-size: 24px; line-height: 1; cursor: pointer; }
  .request-modal-section-title { margin-top: 12px; color: var(--text); font-size: var(--font-base); font-weight: 800; }
  .request-empty-state { padding: 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-soft); color: var(--muted); font-weight: 700; }

  @media (max-width: 700px) {
    .request-page { padding: 12px 10px calc(104px + env(safe-area-inset-bottom, 0px)); }
    .request-card { padding: 12px 14px; border-radius: var(--radius); }
    .request-card h2 { font-size: 17px; }
    .request-status-top h3,
    .request-modal-header h3 { font-size: 17px; }
    .request-card-header { align-items: flex-start; }
    .request-price { min-width: 116px; max-width: 142px; padding: 7px 9px; }
    .request-price small { font-size: 10px; }
    .request-check-grid-single { grid-template-columns: 1fr; }
    .request-modal-overlay { padding: 10px 10px calc(116px + env(safe-area-inset-bottom, 0px)); }
    .request-modal-box { max-height: calc(100dvh - 20px); }
    .request-modal-header { align-items: flex-start; }
  }
`;
