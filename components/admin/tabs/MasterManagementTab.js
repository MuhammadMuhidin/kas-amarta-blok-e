"use client";

import Toast from "@/components/Toast";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";
import LoadingButtonContent from "@/components/admin/LoadingButtonContent";
import { readJson, sendJson } from "@/components/admin/adminClientApi";
import { useEffect, useState } from "react";

const APPROVAL_MASTERS_API = "/api/admin/approval-masters";

const fields = [
  { key: "requester_name", label: "Resident Name", type: "text", required: true },
  { key: "requester_house", label: "House Number", type: "text", required: true },
  { key: "requester_phone", label: "WhatsApp Number", type: "text", required: true },
  { key: "reason", label: "Request Reason", type: "textarea", required: true },
];

const flow = [
  { step: 1, role: "bendahara", label: "Payment Validation", action: "validate_payment" },
  { step: 2, role: "ketua", label: "Chairman Approval", action: "final_approval" },
];

const emptyForm = {
  id: "",
  code: "PORTAL_KEY",
  name: "Portal Key Request",
  category: "Facility",
  description: "Portal key request for residents.",
  active: true,
  payment_required: true,
  payment_amount: 50000,
  payment_instruction: "Transfer to the treasurer account and wait for payment validation.",
  fields_schema: JSON.stringify(fields, null, 2),
  flow_schema: JSON.stringify(flow, null, 2),
};

const money = (value) => `Rp${Number(value || 0).toLocaleString("id-ID")}`;

function Badge({ active }) {
  return <span className={`admin-deposit-status ${active ? "admin-deposit-status-paid" : "admin-deposit-status-missed"}`}>{active ? "Active" : "Inactive"}</span>;
}

function masterToForm(master) {
  return {
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
  };
}

function MasterFormFields({ value, onChange }) {
  const setField = (key, nextValue) => onChange((prev) => ({ ...prev, [key]: nextValue }));

  return (
    <div style={styles.masterFormGrid}>
      <input className="admin-input" placeholder="Code" value={value.code} onChange={(event) => setField("code", event.target.value)} />
      <input className="admin-input" placeholder="Name" value={value.name} onChange={(event) => setField("name", event.target.value)} />
      <input className="admin-input" placeholder="Category" value={value.category} onChange={(event) => setField("category", event.target.value)} />
      <textarea className="admin-input" placeholder="Description" rows={2} value={value.description} onChange={(event) => setField("description", event.target.value)} />
      <label style={styles.checkboxLabel}><input type="checkbox" checked={value.active} onChange={(event) => setField("active", event.target.checked)} />Active master</label>
      <div style={styles.formGroupTitle}>Payment Rule</div>
      <label style={styles.checkboxLabel}><input type="checkbox" checked={value.payment_required} onChange={(event) => setField("payment_required", event.target.checked)} />Payment required</label>
      <input className="admin-input" type="number" placeholder="Payment Amount" value={value.payment_amount} onChange={(event) => setField("payment_amount", event.target.value)} />
      <textarea className="admin-input" placeholder="Payment Instruction" rows={2} value={value.payment_instruction} onChange={(event) => setField("payment_instruction", event.target.value)} />
      <div style={styles.formGroupTitle}>Fields Schema JSON</div>
      <textarea className="admin-input admin-json-input" style={styles.jsonInput} rows={8} value={value.fields_schema} onChange={(event) => setField("fields_schema", event.target.value)} spellCheck={false} />
      <div style={styles.formGroupTitle}>Flow Schema JSON</div>
      <textarea className="admin-input admin-json-input" style={styles.jsonInput} rows={8} value={value.flow_schema} onChange={(event) => setField("flow_schema", event.target.value)} spellCheck={false} />
    </div>
  );
}

export default function MasterManagementTab() {
  const [data, setData] = useState({ masters: [] });
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(null);
  const [showAddMaster, setShowAddMaster] = useState(false);
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
      setData(await readJson(APPROVAL_MASTERS_API));
    } catch (err) {
      showToast(err.message || "Failed to load approval masters", "error");
    } finally {
      setLoading(false);
    }
  }

  async function persistMaster(payload, successMessage) {
    setSaving(true);
    try {
      JSON.parse(payload.fields_schema || "[]");
      JSON.parse(payload.flow_schema || "[]");
      await sendJson(APPROVAL_MASTERS_API, "POST", payload);
      showToast(successMessage);
      await loadData();
      return true;
    } catch (err) {
      showToast(err.message || "Failed to save approval master", "error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function toggleAddMaster() {
    if (saving) return;
    setShowAddMaster((prev) => {
      if (prev) setForm(emptyForm);
      return !prev;
    });
  }

  function edit(master) {
    setEditForm(masterToForm(master));
    setShowAddMaster(false);
    setForm(emptyForm);
  }

  async function saveAdd(event) {
    event.preventDefault();
    const ok = await persistMaster(form, "Approval master created");
    if (ok) {
      setForm(emptyForm);
      setShowAddMaster(false);
    }
  }

  async function saveEdit() {
    if (!editForm) return;
    const ok = await persistMaster(editForm, "Approval master updated");
    if (ok) setEditForm(null);
  }

  useEffect(() => { loadData(); }, []);

  if (loading) return <div className="admin-card">Loading Master Management...</div>;

  return (
    <>
      <Toast show={!!toast} type={toast?.type} message={toast?.message} />
      <div className="admin-card">
        <div style={styles.sectionHeader}>
          <div><h3 style={styles.sectionTitle}>Approval Master List</h3><p className="activity-subtitle" style={styles.subtitle}>Create reusable approval templates, payment rules, required fields, and approval flows.</p></div>
          <button type="button" className={showAddMaster ? "admin-collapse-toggle admin-collapse-toggle-open" : "admin-collapse-toggle"} style={styles.collapseButton} aria-label={showAddMaster ? "Collapse add master form" : "Expand add master form"} aria-expanded={showAddMaster} onClick={toggleAddMaster} disabled={saving}>{showAddMaster ? "▴" : "▾"}</button>
        </div>

        {showAddMaster && <form onSubmit={saveAdd} className="admin-form admin-collapsible-panel" style={styles.formPanel}><MasterFormFields value={form} onChange={setForm} /><div style={styles.formActions}><button className="admin-btn" disabled={saving}><LoadingButtonContent loading={saving} loadingText="Saving...">Add Master</LoadingButtonContent></button></div></form>}

        <section className="admin-status-card" style={styles.listSection}>
          <div className="admin-status-label">Approval Master List</div>
          <div className="admin-table-wrapper"><table className="admin-table"><thead><tr><th className="admin-th">Code</th><th className="admin-th">Name</th><th className="admin-th">Payment</th><th className="admin-th">Flow</th><th className="admin-th">Status</th><th className="admin-th">Action</th></tr></thead><tbody>{(data.masters || []).map((master, index) => <tr key={master.id} className={index % 2 ? "admin-row-alt" : ""}><td className="admin-td">{master.code}</td><td className="admin-td">{master.name}</td><td className="admin-td">{master.payment_required ? money(master.payment_amount) : "No"}</td><td className="admin-td">{(master.flow_schema || []).map((step) => step.role).join(" → ") || "-"}</td><td className="admin-td"><Badge active={master.active} /></td><td className="admin-td"><button type="button" className="admin-small-btn" onClick={() => edit(master)}>Edit</button></td></tr>)}</tbody></table></div>
        </section>
      </div>

      <AdminConfirmModal open={!!editForm} title="Edit Approval Master" description={editForm ? `Update value untuk ${editForm.name || editForm.code}.` : ""} confirmText="Update Master" cancelText="Cancel" loading={saving} loadingText="Saving..." onCancel={() => !saving && setEditForm(null)} onConfirm={saveEdit}>{editForm && <MasterFormFields value={editForm} onChange={setEditForm} />}</AdminConfirmModal>
    </>
  );
}

const styles = {
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 },
  sectionTitle: { margin: 0 },
  subtitle: { marginTop: 6, maxWidth: 620 },
  collapseButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", width: 32, height: 32, padding: 0, border: "none", borderRadius: 8, background: "transparent", color: "inherit", cursor: "pointer", font: "inherit", fontSize: 18, fontWeight: 900, lineHeight: 1 },
  formPanel: { marginBottom: 18 },
  masterFormGrid: { display: "grid", gap: 14 },
  checkboxLabel: { display: "flex", alignItems: "center", gap: 8, color: "var(--admin-muted)", fontSize: 13, fontWeight: 800 },
  formGroupTitle: { marginTop: 4, color: "var(--admin-muted)", fontSize: 12, fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase" },
  formActions: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 },
  jsonInput: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12, lineHeight: 1.45 },
  listSection: { marginTop: 14, marginBottom: 0 },
};
