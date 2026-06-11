"use client";

import { useEffect, useMemo, useState } from "react";

function money(value) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
}

function getStatusClass(status) {
  if (status === "completed") return "admin-deposit-status-paid";
  if (status === "rejected") return "admin-deposit-status-missed";
  if (["waiting_payment_validation", "waiting_approval", "submitted"].includes(status)) return "admin-deposit-status-pending";
  return "admin-deposit-status-waiting";
}

function StatusBadge({ status }) {
  return <span className={`admin-deposit-status ${getStatusClass(status)}`}>{status || "-"}</span>;
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
    setTimeout(() => setMessage(null), 3000);
  }

  async function loadMasters() {
    try {
      const res = await fetch("/api/approval", { cache: "no-store" });
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
      const res = await fetch("/api/approval", {
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
      const res = await fetch(`/api/approval?${params.toString()}`, { cache: "no-store" });
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
    <main className="dashboard-container" style={styles.page}>
      {message && <div className={message.type === "error" ? "admin-error-box" : "admin-success-box"} style={styles.message}>{message.text}</div>}
      <section className="admin-card" style={styles.hero}>
        <div className="activity-kicker">Amarta Residence • Blok E</div>
        <h1 className="activity-title" style={styles.title}>Pengajuan Warga</h1>
        <p className="activity-subtitle">Ajukan request mandiri dan cek status pengajuan secara berkala.</p>
      </section>

      <section className="admin-card" style={styles.section}>
        <div className="activity-header">
          <div>
            <div className="activity-kicker">Buat Pengajuan</div>
            <h3 className="activity-title">Pengajuan Baru</h3>
          </div>
        </div>

        <form onSubmit={submitRequest} style={styles.grid}>
          <label style={styles.label}>Jenis Pengajuan
            <select className="admin-input" value={selectedCode} onChange={(e) => { setSelectedCode(e.target.value); setFormData({}); setSubmitResult(null); }}>
              {masters.map((master) => <option key={master.code} value={master.code}>{master.name}</option>)}
            </select>
          </label>

          {selectedMaster?.description && <div className="admin-empty-state" style={styles.info}>{selectedMaster.description}</div>}
          {selectedMaster?.payment_required && <div className="admin-error-box" style={styles.info}>Biaya: <strong>{money(selectedMaster.payment_amount)}</strong><br />{selectedMaster.payment_instruction}</div>}

          {(selectedMaster?.fields_schema || []).map((field) => <label key={field.key} style={styles.label}>{field.label}{field.required ? " *" : ""}{field.type === "textarea" ? <textarea className="admin-input" rows={3} value={formData[field.key] || ""} onChange={(e) => updateForm(field.key, e.target.value)} /> : <input className="admin-input" value={formData[field.key] || ""} onChange={(e) => updateForm(field.key, e.target.value)} />}</label>)}

          <button type="submit" className="admin-small-btn" disabled={submitting || !selectedMaster}>{submitting ? "Submitting..." : "Submit Pengajuan"}</button>
        </form>

        {submitResult?.request && <div className="admin-success-box" style={styles.result}>
          <strong>Pengajuan berhasil dibuat.</strong><br />
          Nomor pengajuan: <strong>{submitResult.request.request_no}</strong><br />
          Status: <StatusBadge status={submitResult.request.status} /><br />
          {submitResult.request.amount > 0 && <>Nominal: <strong>{money(submitResult.request.amount)}</strong><br /></>}
          {submitResult.payment_instruction && <span>{submitResult.payment_instruction}</span>}
        </div>}
      </section>

      <section className="admin-card" style={styles.section}>
        <div className="activity-header">
          <div>
            <div className="activity-kicker">Cek Status</div>
            <h3 className="activity-title">Status Pengajuan</h3>
            <p className="activity-subtitle">Masukkan nomor pengajuan dan nomor rumah / WhatsApp sebagai verifikasi.</p>
          </div>
        </div>

        <form onSubmit={checkStatus} style={styles.checkGrid}>
          <input className="admin-input" placeholder="APR-202606-0001" value={checkForm.request_no} onChange={(e) => setCheckForm((prev) => ({ ...prev, request_no: e.target.value }))} />
          <input className="admin-input" placeholder="Nomor rumah / WhatsApp" value={checkForm.key} onChange={(e) => setCheckForm((prev) => ({ ...prev, key: e.target.value }))} />
          <button type="submit" className="admin-small-btn">Cek Status</button>
        </form>

        {statusResult?.request && <div className="admin-status-card" style={styles.result}>
          <div className="admin-status-label">{statusResult.request.request_no}</div>
          <h3 style={{ marginTop: 6 }}>{statusResult.request.master_name}</h3>
          <StatusBadge status={statusResult.request.status} />
          <div className="admin-status-meta" style={{ marginTop: 10 }}>Current role: {statusResult.request.current_role || "-"}</div>
          <div className="admin-status-meta">Submitted: {formatTime(statusResult.request.submitted_at)}</div>
          <div style={styles.timeline}>{(statusResult.actions || []).map((action) => <div key={action.id} className="admin-empty-state" style={{ margin: 0 }}><strong>{action.action}</strong> • {action.role} • {formatTime(action.created_at)}{action.note ? <div>{action.note}</div> : null}</div>)}</div>
        </div>}
      </section>
    </main>
  );
}

const styles = {
  page: { maxWidth: 980, margin: "0 auto", padding: "22px 14px" },
  hero: { marginBottom: 14 },
  title: { fontSize: 32, marginBottom: 6 },
  section: { marginBottom: 14 },
  grid: { display: "grid", gap: 12 },
  checkGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 },
  label: { display: "grid", gap: 6, color: "var(--admin-muted)", fontSize: 13, fontWeight: 700 },
  info: { margin: 0 },
  result: { marginTop: 14, lineHeight: 1.7 },
  timeline: { display: "grid", gap: 8, marginTop: 12 },
  message: { position: "sticky", top: 10, zIndex: 5 },
};
