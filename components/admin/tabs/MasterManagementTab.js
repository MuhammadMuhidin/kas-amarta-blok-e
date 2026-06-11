"use client";

import Toast from "@/components/Toast";
import { readJson, sendJson } from "@/components/admin/adminClientApi";
import { useEffect, useState } from "react";

const fields = [
  { key: "requester_name", label: "Nama Warga", type: "text", required: true },
  { key: "requester_house", label: "Nomor Rumah", type: "text", required: true },
  { key: "requester_phone", label: "Nomor WhatsApp", type: "text", required: true },
  { key: "reason", label: "Alasan Pengajuan", type: "textarea", required: true },
];

const flow = [
  { step: 1, role: "bendahara", label: "Validasi Pembayaran", action: "validate_payment" },
  { step: 2, role: "ketua", label: "Approval Ketua", action: "final_approval" },
];

const emptyForm = {
  id: "",
  code: "PORTAL_KEY",
  name: "Request Kunci Portal",
  category: "Fasilitas",
  description: "Pengajuan kunci portal untuk warga.",
  active: true,
  payment_required: true,
  payment_amount: 50000,
  payment_instruction: "Transfer ke rekening Bendahara dan tunggu validasi pembayaran.",
  fields_schema: JSON.stringify(fields, null, 2),
  flow_schema: JSON.stringify(flow, null, 2),
};

function money(value) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
}

function Badge({ active }) {
  return <span className={`admin-deposit-status ${active ? "admin-deposit-status-paid" : "admin-deposit-status-missed"}`}>{active ? "Active" : "Inactive"}</span>;
}

export default function MasterManagementTab() {
  const [data, setData] = useState({ masters: [] });
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }

  async function loadData() {
    try {
      setLoading(true);
      setData(await readJson("/api/admin/master-management"));
    } catch (err) {
      showToast(err.message || "Gagal membaca master", "error");
    } finally {
      setLoading(false);
    }
  }

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function edit(master) {
    setForm({
      id: master.id,
      code: master.code || "",
      name: master.name || "",
      category: master.category || "",
      description: master.description || "",
      active: master.active !== false,
      payment_required: Boolean(master.payment_required),
      payment_amount: master.payment_amount || 0,
      payment_instruction: master.payment_instruction || "",
      fields_schema: JSON.stringify(master.fields_schema || fields, null, 2),
      flow_schema: JSON.stringify(master.flow_schema || flow, null, 2),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event) {
    event.preventDefault();
    try {
      setSaving(true);
      JSON.parse(form.fields_schema || "[]");
      JSON.parse(form.flow_schema || "[]");
      await sendJson("/api/admin/master-management", "POST", form);
      showToast("Master approval berhasil disimpan");
      setForm(emptyForm);
      await loadData();
    } catch (err) {
      showToast(err.message || "Gagal menyimpan master", "error");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  if (loading) return <div className="admin-card">Loading Master Management...</div>;

  return (
    <>
      <Toast show={!!toast} type={toast?.type} message={toast?.message} />
      <div className="admin-card">
        <div className="activity-header">
          <div>
            <div className="activity-kicker">Master Data</div>
            <h3 className="activity-title">Master Management</h3>
            <p className="activity-subtitle">Template approval: field warga, aturan pembayaran, dan flow pengurus.</p>
          </div>
          <button type="button" className="admin-small-btn admin-refresh-btn" onClick={loadData}>Refresh</button>
        </div>

        <form onSubmit={save} style={styles.grid}>
          <section className="admin-status-card" style={styles.section}>
            <div className="admin-status-label">Approval Master</div>
            <div style={styles.inputs}>
              <label style={styles.label}>Code<input className="admin-input" value={form.code} onChange={(e) => setField("code", e.target.value)} /></label>
              <label style={styles.label}>Name<input className="admin-input" value={form.name} onChange={(e) => setField("name", e.target.value)} /></label>
              <label style={styles.label}>Category<input className="admin-input" value={form.category} onChange={(e) => setField("category", e.target.value)} /></label>
              <label style={styles.check}><input type="checkbox" checked={form.active} onChange={(e) => setField("active", e.target.checked)} /> Active</label>
            </div>
            <label style={styles.label}>Description<textarea className="admin-input" rows={2} value={form.description} onChange={(e) => setField("description", e.target.value)} /></label>
          </section>

          <section className="admin-status-card" style={styles.section}>
            <div className="admin-status-label">Payment Rule</div>
            <div style={styles.inputs}>
              <label style={styles.check}><input type="checkbox" checked={form.payment_required} onChange={(e) => setField("payment_required", e.target.checked)} /> Perlu pembayaran</label>
              <label style={styles.label}>Amount<input className="admin-input" type="number" value={form.payment_amount} onChange={(e) => setField("payment_amount", e.target.value)} /></label>
            </div>
            <label style={styles.label}>Payment Instruction<textarea className="admin-input" rows={2} value={form.payment_instruction} onChange={(e) => setField("payment_instruction", e.target.value)} /></label>
          </section>

          <section className="admin-status-card" style={styles.section}>
            <div className="admin-status-label">Fields Schema JSON</div>
            <textarea className="admin-input" rows={9} value={form.fields_schema} onChange={(e) => setField("fields_schema", e.target.value)} spellCheck={false} />
          </section>

          <section className="admin-status-card" style={styles.section}>
            <div className="admin-status-label">Flow Schema JSON</div>
            <textarea className="admin-input" rows={9} value={form.flow_schema} onChange={(e) => setField("flow_schema", e.target.value)} spellCheck={false} />
          </section>

          <div style={styles.actions}>
            <button type="button" className="admin-small-btn" onClick={() => setForm(emptyForm)}>Reset</button>
            <button type="submit" className="admin-small-btn" disabled={saving}>{saving ? "Saving..." : form.id ? "Update Master" : "Create Master"}</button>
          </div>
        </form>

        <section className="admin-status-card" style={styles.section}>
          <div className="admin-status-label">Approval Master List</div>
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead><tr><th className="admin-th">Code</th><th className="admin-th">Name</th><th className="admin-th">Payment</th><th className="admin-th">Flow</th><th className="admin-th">Status</th><th className="admin-th">Action</th></tr></thead>
              <tbody>{(data.masters || []).map((master) => <tr key={master.id}><td className="admin-td">{master.code}</td><td className="admin-td">{master.name}</td><td className="admin-td">{master.payment_required ? money(master.payment_amount) : "Tidak"}</td><td className="admin-td">{(master.flow_schema || []).map((step) => step.role).join(" → ")}</td><td className="admin-td"><Badge active={master.active} /></td><td className="admin-td"><button type="button" className="admin-small-btn" onClick={() => edit(master)}>Edit</button></td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

const styles = {
  grid: { display: "grid", gap: 14, marginBottom: 16 },
  section: { marginBottom: 0 },
  inputs: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 10 },
  label: { display: "grid", gap: 6, color: "var(--admin-muted)", fontSize: 13, fontWeight: 700 },
  check: { display: "flex", alignItems: "center", gap: 8, color: "var(--admin-muted)", fontSize: 13, fontWeight: 700 },
  actions: { display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" },
};
