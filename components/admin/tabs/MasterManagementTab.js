"use client";

import Toast from "@/components/Toast";
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

function money(value) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
}

function Badge({ active }) {
  return <span className={`admin-deposit-status ${active ? "admin-deposit-status-paid" : "admin-deposit-status-missed"}`}>{active ? "Active" : "Inactive"}</span>;
}

export default function MasterManagementTab() {
  const [data, setData] = useState({ masters: [] });
  const [form, setForm] = useState(emptyForm);
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

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
  }

  function toggleAddMaster() {
    setShowAddMaster((prev) => {
      if (prev) resetForm();
      return !prev;
    });
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
    setShowAddMaster(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event) {
    event.preventDefault();
    try {
      setSaving(true);
      JSON.parse(form.fields_schema || "[]");
      JSON.parse(form.flow_schema || "[]");
      await sendJson(APPROVAL_MASTERS_API, "POST", form);
      showToast(form.id ? "Approval master updated" : "Approval master created");
      resetForm();
      setShowAddMaster(false);
      await loadData();
    } catch (err) {
      showToast(err.message || "Failed to save approval master", "error");
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
        <div style={styles.sectionHeader}>
          <div>
            <h3 style={styles.sectionTitle}>Approval Master List</h3>
            <p className="activity-subtitle" style={styles.subtitle}>Create reusable approval templates, payment rules, required fields, and approval flows.</p>
          </div>

          <button
            type="button"
            className={showAddMaster ? "admin-collapse-toggle admin-collapse-toggle-open" : "admin-collapse-toggle"}
            style={styles.collapseButton}
            aria-label={showAddMaster ? "Collapse add master form" : "Expand add master form"}
            aria-expanded={showAddMaster}
            onClick={toggleAddMaster}
          >
            {showAddMaster ? "▴" : "▾"}
          </button>
        </div>

        {showAddMaster && (
          <form onSubmit={save} className="admin-form admin-collapsible-panel">
            <input className="admin-input" placeholder="Code" value={form.code} onChange={(e) => setField("code", e.target.value)} />
            <input className="admin-input" placeholder="Name" value={form.name} onChange={(e) => setField("name", e.target.value)} />
            <input className="admin-input" placeholder="Category" value={form.category} onChange={(e) => setField("category", e.target.value)} />
            <textarea className="admin-input" placeholder="Description" rows={2} value={form.description} onChange={(e) => setField("description", e.target.value)} />

            <label style={styles.checkboxLabel}>
              <input type="checkbox" checked={form.active} onChange={(e) => setField("active", e.target.checked)} />
              Active master
            </label>

            <div style={styles.formGroupTitle}>Payment Rule</div>

            <label style={styles.checkboxLabel}>
              <input type="checkbox" checked={form.payment_required} onChange={(e) => setField("payment_required", e.target.checked)} />
              Payment required
            </label>

            <input className="admin-input" type="number" placeholder="Payment Amount" value={form.payment_amount} onChange={(e) => setField("payment_amount", e.target.value)} />
            <textarea className="admin-input" placeholder="Payment Instruction" rows={2} value={form.payment_instruction} onChange={(e) => setField("payment_instruction", e.target.value)} />

            <div style={styles.formGroupTitle}>Fields Schema JSON</div>
            <textarea className="admin-input" rows={8} value={form.fields_schema} onChange={(e) => setField("fields_schema", e.target.value)} spellCheck={false} />

            <div style={styles.formGroupTitle}>Flow Schema JSON</div>
            <textarea className="admin-input" rows={8} value={form.flow_schema} onChange={(e) => setField("flow_schema", e.target.value)} spellCheck={false} />

            <div style={styles.formActions}>
              <button type="button" className="admin-small-btn" onClick={resetForm} disabled={saving}>Reset</button>
              <button className="admin-btn" disabled={saving}>
                <LoadingButtonContent loading={saving} loadingText="Saving...">
                  {form.id ? "Update Master" : "Add Master"}
                </LoadingButtonContent>
              </button>
            </div>
          </form>
        )}

        <section className="admin-status-card" style={styles.listSection}>
          <div className="admin-status-label">Approval Master List</div>
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="admin-th">Code</th>
                  <th className="admin-th">Name</th>
                  <th className="admin-th">Payment</th>
                  <th className="admin-th">Flow</th>
                  <th className="admin-th">Status</th>
                  <th className="admin-th">Action</th>
                </tr>
              </thead>
              <tbody>
                {(data.masters || []).map((master, index) => (
                  <tr key={master.id} className={index % 2 ? "admin-row-alt" : ""}>
                    <td className="admin-td">{master.code}</td>
                    <td className="admin-td">{master.name}</td>
                    <td className="admin-td">{master.payment_required ? money(master.payment_amount) : "No"}</td>
                    <td className="admin-td">{(master.flow_schema || []).map((step) => step.role).join(" → ") || "-"}</td>
                    <td className="admin-td"><Badge active={master.active} /></td>
                    <td className="admin-td"><button type="button" className="admin-small-btn" onClick={() => edit(master)}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

const styles = {
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 },
  sectionTitle: { margin: 0 },
  subtitle: { marginTop: 6, maxWidth: 620 },
  collapseButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, padding: 0, border: "none", borderRadius: 8, background: "transparent", color: "inherit", cursor: "pointer", font: "inherit", fontSize: 18, fontWeight: 900, lineHeight: 1 },
  checkboxLabel: { display: "flex", alignItems: "center", gap: 8, color: "var(--admin-muted)", fontSize: 13, fontWeight: 800 },
  formGroupTitle: { marginTop: 4, color: "var(--admin-muted)", fontSize: 12, fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase" },
  formActions: { display: "grid", gridTemplateColumns: "auto minmax(160px, 1fr)", gap: 10 },
  listSection: { marginTop: 14, marginBottom: 0 },
};
