"use client";

import PublicBottomNav from "@/components/public/PublicBottomNav";
import { useEffect, useMemo, useState } from "react";

const APPROVAL_REQUESTS_API = "/api/approval-requests";

function money(value) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
}

function prettyStatus(status = "") {
  const map = {
    submitted: "Terkirim",
    waiting_payment_validation: "Menunggu Validasi Pembayaran",
    waiting_approval: "Menunggu Persetujuan",
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
    reject: "Ditolak",
    cancel: "Dibatalkan",
    payment_validated: "Pembayaran Divalidasi",
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

export default function PengajuanPage() {
  const [masters, setMasters] = useState([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [checkForm, setCheckForm] = useState({ request_no: "", key: "" });
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
      const params = new URLSearchParams({ request_no: checkForm.request_no, key: checkForm.key });
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

  return (
    <main className="request-page">
      <style jsx global>{requestPageCss}</style>
      {message ? <div className={`request-toast ${message.type === "error" ? "is-error" : "is-success"}`}>{message.text}</div> : null}

      <section className="request-card request-check-card">
        <div className="request-card-header">
          <div>
            <span className="request-kicker">Cek Status</span>
            <h2>Cek Status Pengajuan</h2>
          </div>
        </div>
        <p className="request-muted">Gunakan nomor pengajuan dan nomor rumah / WhatsApp sebagai verifikasi.</p>
        <form onSubmit={checkStatus} className="request-check-grid">
          <input className="request-input" placeholder="Contoh: APR-202606-0001" value={checkForm.request_no} onChange={(e) => setCheckForm((prev) => ({ ...prev, request_no: e.target.value }))} />
          <input className="request-input" placeholder="Nomor rumah / WhatsApp" value={checkForm.key} onChange={(e) => setCheckForm((prev) => ({ ...prev, key: e.target.value }))} />
          <button type="submit" className="request-secondary-btn">Cek Status</button>
        </form>

        {statusResult?.request ? (
          <div className="request-status-panel">
            <div className="request-status-top">
              <div>
                <span className="request-kicker">{statusResult.request.request_no}</span>
                <h3>{statusResult.request.master_name}</h3>
              </div>
              <StatusBadge status={statusResult.request.status} />
            </div>
            <div className="request-meta-grid">
              <div><span>Persetujuan Saat Ini</span><strong>{statusResult.request.current_approver_role || "-"}</strong></div>
              <div><span>Diajukan Pada</span><strong>{formatTime(statusResult.request.submitted_at)}</strong></div>
            </div>
            <div className="request-timeline">
              {(statusResult.actions || []).map((action) => (
                <div key={action.id} className="request-timeline-item">
                  <span />
                  <div><strong>{prettyAction(action.action)}</strong><small>{action.role} • {formatTime(action.created_at)}</small>{action.note ? <p>{action.note}</p> : null}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="request-card request-master-card">
        <div className="request-card-header">
          <div>
            <span className="request-kicker">Pengajuan Baru</span>
            <h2>Buat Pengajuan Baru</h2>
          </div>
          {selectedMaster?.payment_required ? <span className="request-price">{money(selectedMaster.payment_amount)}</span> : <span className="request-price muted">Gratis</span>}
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

      <PublicBottomNav />
    </main>
  );
}

const requestPageCss = `
  body:has(.request-page) {
    background:
      radial-gradient(circle at top left, color-mix(in srgb, var(--primary) 18%, transparent), transparent 34vw),
      radial-gradient(circle at 100% 8%, color-mix(in srgb, var(--success) 14%, transparent), transparent 32vw),
      var(--bg) !important;
    color: var(--text);
  }

  .request-page {
    max-width: 980px;
    margin: 0 auto;
    padding: 12px 14px calc(104px + env(safe-area-inset-bottom, 0px));
    font-family: var(--public-font-family, Inter, system-ui, sans-serif);
    color: var(--text);
  }

  .request-toast {
    position: sticky;
    top: 10px;
    z-index: 50;
    margin-bottom: 12px;
    padding: 12px 14px;
    border-radius: 16px;
    font-weight: 900;
    box-shadow: var(--shadow-soft);
  }

  .request-toast.is-success { background: color-mix(in srgb, var(--success) 14%, var(--surface)); border: 1px solid color-mix(in srgb, var(--success) 36%, var(--border)); color: var(--text); }
  .request-toast.is-error { background: color-mix(in srgb, var(--danger) 12%, var(--surface)); border: 1px solid color-mix(in srgb, var(--danger) 34%, var(--border)); color: var(--text); }

  .request-card {
    position: relative;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--primary) 16%, var(--border));
    background: color-mix(in srgb, var(--surface) 92%, transparent);
    color: var(--text);
    border-radius: 28px;
    box-shadow: 0 18px 48px color-mix(in srgb, var(--primary) 11%, transparent), var(--shadow-soft);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    padding: 18px;
    margin-bottom: 14px;
  }

  .request-master-card { border-color: color-mix(in srgb, var(--success) 18%, var(--border)); }
  .request-check-card { border-color: color-mix(in srgb, var(--primary) 22%, var(--border)); }

  .request-kicker {
    color: var(--primary);
    font-size: 11px;
    font-weight: 950;
    letter-spacing: .11em;
    text-transform: uppercase;
  }

  .request-card-header,
  .request-status-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 14px;
  }

  .request-card h2,
  .request-status-top h3 {
    margin: 4px 0 0;
    color: var(--text);
    line-height: 1.12;
  }

  .request-card h2 { font-size: 24px; }
  .request-status-top h3 { font-size: 20px; }

  .request-muted {
    margin: 0;
    color: var(--muted);
    font-size: 15px;
    font-weight: 750;
    line-height: 1.55;
  }

  .request-price {
    flex-shrink: 0;
    padding: 7px 10px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--success) 38%, var(--border));
    background: color-mix(in srgb, var(--success) 13%, var(--surface));
    color: var(--text);
    font-size: 13px;
    font-weight: 950;
  }

  .request-price.muted { border-color: var(--border); background: var(--surface-soft); color: var(--muted); }

  .request-form,
  .request-check-grid {
    display: grid;
    gap: 12px;
  }

  .request-check-grid {
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    margin-top: 14px;
  }

  .request-label {
    display: grid;
    gap: 7px;
    color: var(--muted);
    font-size: 13px;
    font-weight: 900;
  }

  .request-input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: color-mix(in srgb, var(--surface) 94%, transparent);
    color: var(--text);
    padding: 13px 14px;
    outline: none;
    font: inherit;
    font-weight: 800;
  }

  .request-input:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 13%, transparent);
  }

  .request-info,
  .request-payment,
  .request-success-panel,
  .request-status-panel {
    border: 1px solid var(--border);
    border-radius: 20px;
    background: color-mix(in srgb, var(--surface-soft) 82%, transparent);
    padding: 14px;
    color: var(--text);
  }

  .request-payment {
    display: grid;
    gap: 4px;
    border-color: color-mix(in srgb, var(--primary) 24%, var(--border));
  }

  .request-payment span { color: var(--muted); font-size: 13px; font-weight: 750; line-height: 1.5; }

  .request-primary-btn,
  .request-secondary-btn {
    min-height: 46px;
    border: 0;
    border-radius: 16px;
    background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 70%, var(--success)));
    color: var(--tab-active-text);
    font: inherit;
    font-weight: 950;
    cursor: pointer;
    box-shadow: 0 12px 24px color-mix(in srgb, var(--primary) 18%, transparent);
  }

  .request-secondary-btn {
    background: var(--text);
    color: var(--surface);
    box-shadow: none;
  }

  .request-primary-btn:disabled { opacity: .6; cursor: not-allowed; }

  .request-success-panel {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 12px;
    margin-top: 14px;
    border-color: color-mix(in srgb, var(--success) 34%, var(--border));
  }

  .request-success-icon {
    width: 34px;
    height: 34px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    background: var(--success);
    color: var(--tab-active-text);
    font-weight: 950;
  }

  .request-success-panel p { margin: 5px 0; color: var(--muted); font-size: 13px; font-weight: 800; }
  .request-success-panel small { display: block; margin-top: 8px; color: var(--muted); line-height: 1.5; }

  .request-status {
    display: inline-flex;
    width: fit-content;
    align-items: center;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 950;
  }

  .request-status.is-success { background: color-mix(in srgb, var(--success) 15%, var(--surface)); color: var(--text); border: 1px solid color-mix(in srgb, var(--success) 36%, var(--border)); }
  .request-status.is-warning { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
  .request-status.is-danger { background: color-mix(in srgb, var(--danger) 13%, var(--surface)); color: var(--text); border: 1px solid color-mix(in srgb, var(--danger) 36%, var(--border)); }
  .request-status.is-muted { background: var(--surface-soft); color: var(--muted); border: 1px solid var(--border); }

  .request-status-panel { margin-top: 14px; }

  .request-meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 10px;
    margin: 12px 0;
  }

  .request-meta-grid div {
    padding: 11px;
    border-radius: 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    display: grid;
    gap: 4px;
  }

  .request-meta-grid span { color: var(--muted); font-size: 11px; font-weight: 900; text-transform: uppercase; }
  .request-meta-grid strong { color: var(--text); font-size: 13px; }

  .request-timeline {
    display: grid;
    gap: 10px;
    margin-top: 12px;
  }

  .request-timeline-item {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 10px;
    align-items: start;
  }

  .request-timeline-item > span {
    width: 11px;
    height: 11px;
    margin-top: 6px;
    border-radius: 999px;
    background: var(--primary);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 12%, transparent);
  }

  .request-timeline-item div {
    padding: 10px 12px;
    border-radius: 16px;
    border: 1px solid var(--border);
    background: var(--surface);
  }

  .request-timeline-item strong { display: block; color: var(--text); text-transform: capitalize; }
  .request-timeline-item small { display: block; color: var(--muted); margin-top: 3px; }
  .request-timeline-item p { margin: 6px 0 0; color: var(--muted); }

  @media (max-width: 700px) {
    .request-page { padding: 10px 10px calc(104px + env(safe-area-inset-bottom, 0px)); }
    .request-card { padding: 15px; border-radius: 22px; }
    .request-card-header { align-items: stretch; }
  }
`;
