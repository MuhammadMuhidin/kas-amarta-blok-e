"use client";

import Toast from "@/components/Toast";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";
import AdminDataSkeleton from "@/components/admin/AdminDataSkeleton";
import LoadingButtonContent from "@/components/admin/LoadingButtonContent";
import MasterVersionHistoryDiff from "@/components/admin/MasterVersionHistoryDiff";
import { readJson, sendJson } from "@/components/admin/adminClientApi";
import { ADMIN_ACCESS_ROLES } from "@/lib/adminRoles";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const APPROVAL_MASTERS_API = "/api/admin/approval-masters";
const WIZARD_STEPS = ["Information", "Form", "Approval", "Payment", "Preview", "Publish"];

const ROLE_LABELS = {
  admin: "Administrator",
  ketua: "Chairperson",
  sekretaris: "Secretary",
  bendahara: "Treasurer",
  sapras: "Facilities",
};

const ROLE_OPTIONS = ADMIN_ACCESS_ROLES.map((role) => ({
  ...role,
  label: ROLE_LABELS[role.value] || role.label,
}));

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "money", label: "Currency amount" },
  { value: "date", label: "Date" },
  { value: "tel", label: "WhatsApp number" },
  { value: "select", label: "Dropdown" },
  { value: "radio", label: "Radio buttons" },
  { value: "checkbox", label: "Yes / No" },
  { value: "image", label: "Image upload" },
  { value: "file", label: "Document upload" },
];

const FIELD_TYPE_LABELS = Object.fromEntries(FIELD_TYPES.map((item) => [item.value, item.label]));

const ACTION_OPTIONS = [
  { value: "approve", label: "Approval" },
  { value: "final_approval", label: "Final approval" },
  { value: "validate_payment", label: "Payment validation" },
  { value: "validate_document", label: "Document review" },
  { value: "confirm_execution", label: "Execution confirmation" },
];

// These values are resident-facing defaults, so they remain Indonesian.
const DEFAULT_FIELDS = [
  { key: "requester_name", label: "Nama Warga", type: "text", required: true, placeholder: "Nama lengkap", show_summary: true },
  { key: "requester_house", label: "Nomor Rumah", type: "text", required: true, placeholder: "Contoh: E3-3", show_summary: true },
  { key: "requester_phone", label: "Nomor WhatsApp", type: "tel", required: true, placeholder: "08xxxxxxxxxx", show_summary: false },
  { key: "reason", label: "Alasan Pengajuan", type: "textarea", required: true, placeholder: "Jelaskan kebutuhan pengajuan", show_summary: true },
];

const DEFAULT_FLOW = [
  { step: 1, role: "bendahara", label: "Validasi Pembayaran", action: "validate_payment" },
  { step: 2, role: "ketua", label: "Approval Ketua", action: "final_approval" },
];

const FLOW_TEMPLATES = [
  { id: "simple", label: "Simple approval", description: "The chairperson gives final approval.", paymentRequired: false, flow: [{ role: "ketua", label: "Approval Ketua", action: "final_approval" }] },
  { id: "paid", label: "Paid request", description: "The treasurer validates payment, then the chairperson approves.", paymentRequired: true, flow: DEFAULT_FLOW },
  { id: "administration", label: "Administration", description: "The secretary reviews the document, then the chairperson approves.", paymentRequired: false, flow: [{ role: "sekretaris", label: "Pemeriksaan Dokumen", action: "validate_document" }, { role: "ketua", label: "Approval Ketua", action: "final_approval" }] },
  { id: "facility", label: "Facilities", description: "Facilities reviews the request, then the chairperson approves.", paymentRequired: false, flow: [{ role: "sapras", label: "Pemeriksaan Sarana", action: "approve" }, { role: "ketua", label: "Approval Ketua", action: "final_approval" }] },
  { id: "direct", label: "No approval", description: "The request is completed immediately after submission.", paymentRequired: false, flow: [] },
];

const ICON_OPTIONS = ["📄", "🔑", "🏠", "🛠️", "📅", "🧾", "🚧", "💡", "📢", "✅"];
const money = (value) => `Rp${Number(value || 0).toLocaleString("id-ID")}`;
const clean = (value) => String(value || "").trim();

function normalizeCode(value) {
  return clean(value).toUpperCase().replace(/[^A-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}

function normalizeKey(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function renumberFlow(flow = []) {
  return flow.map((step, index) => ({ ...step, step: index + 1 }));
}

function roleLabel(value) {
  return ROLE_LABELS[value] || value || "Administrator";
}

function actionLabel(value) {
  return ACTION_OPTIONS.find((action) => action.value === value)?.label || value || "Approval";
}

function automaticStepLabel(action, role) {
  return `${actionLabel(action)} by ${roleLabel(role)}`;
}

function formatDate(value) {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime())
    ? date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "-";
}

function makeEmptyForm() {
  return {
    id: "",
    code: "",
    name: "",
    category: "General",
    description: "",
    lifecycle_status: "draft",
    icon: "📄",
    color: "#2563eb",
    payment_required: false,
    payment_amount: 0,
    payment_instruction: "",
    fields_schema: clone(DEFAULT_FIELDS),
    flow_schema: [{ step: 1, role: "ketua", label: "Approval Ketua", action: "final_approval" }],
    published_revision: 0,
    draft_revision: 0,
    has_draft: false,
    version_history: [],
    published_config: null,
  };
}

function masterToForm(master = {}) {
  return {
    id: master.id || "",
    code: master.code || "",
    name: master.name || "",
    category: master.category || "General",
    description: master.description || "",
    lifecycle_status: master.lifecycle_status || (master.active ? "active" : "draft"),
    icon: master.icon || "📄",
    color: master.color || "#2563eb",
    payment_required: Boolean(master.payment_required),
    payment_amount: Number(master.payment_amount || 0),
    payment_instruction: master.payment_instruction || "",
    fields_schema: clone(Array.isArray(master.fields_schema) ? master.fields_schema : DEFAULT_FIELDS),
    flow_schema: renumberFlow(clone(Array.isArray(master.flow_schema) ? master.flow_schema : DEFAULT_FLOW)),
    published_revision: Number(master.published_revision || 0),
    draft_revision: Number(master.draft_revision || 0),
    has_draft: Boolean(master.has_draft),
    version_history: clone(Array.isArray(master.version_history) ? master.version_history : []),
    published_config: master.published_config ? clone(master.published_config) : null,
  };
}

function lifecycleMeta(status) {
  if (status === "active") return { label: "Active", className: "mm-status-active" };
  if (status === "archived") return { label: "Archived", className: "mm-status-archived" };
  return { label: "Draft", className: "mm-status-draft" };
}

function validateMaster(value, full = true) {
  const errors = [];
  if (!clean(value.name)) errors.push({ step: 0, message: "Request name is required" });
  if (!normalizeCode(value.code || value.name)) errors.push({ step: 0, message: "System code is required" });
  if (!full) return errors;

  const fields = Array.isArray(value.fields_schema) ? value.fields_schema : [];
  if (!fields.length) errors.push({ step: 1, message: "At least one request field is required" });
  const keys = fields.map((field) => normalizeKey(field.key));
  if (keys.some((key) => !key)) errors.push({ step: 1, message: "Every field must have a system name" });
  if (new Set(keys).size !== keys.length) errors.push({ step: 1, message: "Field system names must be unique" });
  fields.forEach((field, index) => {
    if (!clean(field.label)) errors.push({ step: 1, message: `Field ${index + 1} does not have a label` });
    if (["select", "radio"].includes(field.type) && !(field.options || []).filter(clean).length) errors.push({ step: 1, message: `Options for ${field.label || `field ${index + 1}`} are required` });
    if (["image", "file"].includes(field.type)) {
      const max = Number(field.max_size_mb || 0);
      if (!max || max < 1 || max > 20) errors.push({ step: 1, message: `${field.label || `Field ${index + 1}`} must have a 1–20 MB size limit` });
      if (!clean(field.accept)) errors.push({ step: 1, message: `${field.label || `Field ${index + 1}`} does not have allowed file types` });
    }
  });

  const flow = Array.isArray(value.flow_schema) ? value.flow_schema : [];
  flow.forEach((step, index) => {
    if (!clean(step.role)) errors.push({ step: 2, message: `Step ${index + 1} does not have a responsible role` });
    if (!clean(step.action)) errors.push({ step: 2, message: `Step ${index + 1} does not have an action` });
    if (!clean(step.label)) errors.push({ step: 2, message: `Step ${index + 1} does not have a name` });
  });

  if (value.payment_required) {
    if (Number(value.payment_amount || 0) <= 0) errors.push({ step: 3, message: "Payment amount must be greater than 0" });
    if (!flow.some((step) => step.action === "validate_payment")) errors.push({ step: 3, message: "A paid request must include a payment validation step" });
  }
  return errors;
}

function PreviewField({ field }) {
  const options = (field.options || []).filter(clean);
  if (field.type === "textarea") return <textarea className="admin-input" rows={3} placeholder={field.placeholder || field.label} disabled />;
  if (field.type === "select") return <select className="admin-input" disabled><option>{field.placeholder || "Select one"}</option>{options.map((option) => <option key={option}>{option}</option>)}</select>;
  if (field.type === "radio") return <div className="mm-preview-options">{options.map((option) => <label key={option}><input type="radio" disabled /> {option}</label>)}</div>;
  if (field.type === "checkbox") return <label className="mm-check"><input type="checkbox" disabled /> Yes</label>;
  if (["image", "file"].includes(field.type)) return <div className="mm-file-preview"><span>{field.type === "image" ? "🖼️" : "📎"}</span><div><strong>Select {field.type === "image" ? "image" : "document"}</strong><small>Maximum {field.max_size_mb || (field.type === "image" ? 5 : 10)} MB</small></div></div>;
  const inputType = field.type === "money" ? "number" : ["number", "date", "tel"].includes(field.type) ? field.type : "text";
  return <input className="admin-input" type={inputType} placeholder={field.placeholder || field.label} disabled />;
}

function MasterPreview({ value }) {
  return (
    <div className="mm-preview-layout">
      <section className="mm-preview-card">
        <div className="mm-preview-title"><span style={{ background: value.color }}>{value.icon}</span><div><small>{value.category || "General"}</small><h3>{value.name || "Request name"}</h3></div></div>
        {value.description ? <p className="mm-muted">{value.description}</p> : null}
        {value.payment_required ? <div className="mm-payment-preview"><small>Request Fee</small><strong>{money(value.payment_amount)}</strong></div> : <div className="mm-free-preview">Free</div>}
        <div className="mm-preview-form">
          {(value.fields_schema || []).map((field, index) => <label key={`${field.key}-${index}`}><strong>{field.label || `Field ${index + 1}`}{field.required ? " *" : ""}</strong><PreviewField field={field} /></label>)}
          <button type="button" className="admin-btn" disabled>Submit Request</button>
        </div>
      </section>
      <section className="mm-preview-card">
        <div className="mm-section-kicker">Flow Preview</div>
        <div className="mm-flow-preview">
          <div className="mm-flow-node"><span>✓</span><div><strong>Request created</strong><small>Data received by the system</small></div></div>
          {(value.flow_schema || []).map((step, index) => <div className="mm-flow-node" key={`${step.role}-${index}`}><span>{index + 1}</span><div><strong>{step.label || actionLabel(step.action)}</strong><small>{roleLabel(step.role)}</small></div></div>)}
          <div className="mm-flow-node"><span>✓</span><div><strong>Completed</strong><small>{value.flow_schema?.length ? "After all steps are processed" : "Completed immediately"}</small></div></div>
        </div>
      </section>
    </div>
  );
}

function FieldBuilder({ value, onChange }) {
  const fields = value.fields_schema || [];
  const update = (index, patch) => onChange((prev) => ({ ...prev, fields_schema: prev.fields_schema.map((field, fieldIndex) => fieldIndex === index ? { ...field, ...patch } : field) }));
  const remove = (index) => onChange((prev) => ({ ...prev, fields_schema: prev.fields_schema.filter((_, fieldIndex) => fieldIndex !== index) }));
  const move = (index, direction) => onChange((prev) => {
    const next = [...prev.fields_schema];
    const target = index + direction;
    if (target < 0 || target >= next.length) return prev;
    [next[index], next[target]] = [next[target], next[index]];
    return { ...prev, fields_schema: next };
  });
  const duplicate = (index) => onChange((prev) => {
    const source = prev.fields_schema[index];
    const copy = { ...clone(source), key: `${source.key || "field"}_copy`, label: `${source.label || "Field"} (Copy)` };
    const next = [...prev.fields_schema];
    next.splice(index + 1, 0, copy);
    return { ...prev, fields_schema: next };
  });
  const add = () => onChange((prev) => ({ ...prev, fields_schema: [...prev.fields_schema, { key: `field_${prev.fields_schema.length + 1}`, label: "New Field", type: "text", required: false, placeholder: "", show_summary: true }] }));

  return (
    <div className="mm-builder">
      <div className="mm-section-head"><div><div className="mm-section-kicker">Visual Form Builder</div><h3>Request Form Fields</h3><p>Arrange fields without writing JSON. System names are generated automatically and can still be adjusted.</p></div><button type="button" className="admin-small-btn" onClick={add}>+ Add Field</button></div>
      {!fields.length ? <div className="admin-empty-state">No fields yet. Add at least one field before publishing.</div> : null}
      <div className="mm-builder-list">
        {fields.map((field, index) => {
          const hasOptions = ["select", "radio"].includes(field.type);
          const isUpload = ["image", "file"].includes(field.type);
          return (
            <article className="mm-builder-card" key={`${field.key}-${index}`}>
              <div className="mm-builder-card-head"><div><span>Field {index + 1}</span><strong>{field.label || "No label"}</strong></div><div className="mm-card-actions"><button type="button" onClick={() => move(index, -1)} disabled={index === 0} title="Move up">↑</button><button type="button" onClick={() => move(index, 1)} disabled={index === fields.length - 1} title="Move down">↓</button><button type="button" onClick={() => duplicate(index)} title="Duplicate">⧉</button><button type="button" onClick={() => remove(index)} title="Delete">×</button></div></div>
              <div className="mm-grid-2">
                <label>Label<input className="admin-input" value={field.label || ""} onChange={(event) => { const label = event.target.value; const oldAutoKey = normalizeKey(field.label) === field.key || !field.key; update(index, { label, ...(oldAutoKey ? { key: normalizeKey(label) } : {}) }); }} /></label>
                <label>System name<input className="admin-input" value={field.key || ""} onChange={(event) => update(index, { key: normalizeKey(event.target.value) })} /></label>
                <label>Field type<select className="admin-input" value={field.type || "text"} onChange={(event) => { const type = event.target.value; update(index, { type, ...(["select", "radio"].includes(type) && !field.options ? { options: ["Option 1"] } : {}), ...(type === "image" ? { accept: "image/jpeg,image/png,image/webp", max_size_mb: 5 } : {}), ...(type === "file" ? { accept: "application/pdf,image/jpeg,image/png,image/webp", max_size_mb: 10 } : {}) }); }}>{FIELD_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
                {!isUpload ? <label>Placeholder<input className="admin-input" value={field.placeholder || ""} onChange={(event) => update(index, { placeholder: event.target.value })} /></label> : <label>Size limit (MB)<input className="admin-input" type="number" min="1" max="20" value={field.max_size_mb || (field.type === "image" ? 5 : 10)} onChange={(event) => update(index, { max_size_mb: event.target.value })} /></label>}
              </div>
              {hasOptions ? <label>Options<textarea className="admin-input" rows={3} value={(field.options || []).join("\n")} onChange={(event) => update(index, { options: event.target.value.split("\n") })} placeholder="One option per line" /></label> : null}
              {isUpload ? <label>Allowed MIME types<input className="admin-input" value={field.accept || ""} onChange={(event) => update(index, { accept: event.target.value })} placeholder="application/pdf,image/jpeg" /><small className="mm-inline-help">Separate values with commas. Safe image types: image/jpeg,image/png,image/webp.</small></label> : null}
              <div className="mm-toggle-row"><label className="mm-check"><input type="checkbox" checked={Boolean(field.required)} onChange={(event) => update(index, { required: event.target.checked })} /> Required</label><label className="mm-check"><input type="checkbox" checked={field.show_summary !== false} onChange={(event) => update(index, { show_summary: event.target.checked })} /> Show in summary</label></div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function FlowBuilder({ value, onChange }) {
  const flow = value.flow_schema || [];
  const update = (index, patch) => onChange((prev) => ({ ...prev, flow_schema: renumberFlow(prev.flow_schema.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step)) }));
  const remove = (index) => onChange((prev) => ({ ...prev, flow_schema: renumberFlow(prev.flow_schema.filter((_, stepIndex) => stepIndex !== index)) }));
  const move = (index, direction) => onChange((prev) => {
    const next = [...prev.flow_schema];
    const target = index + direction;
    if (target < 0 || target >= next.length) return prev;
    [next[index], next[target]] = [next[target], next[index]];
    return { ...prev, flow_schema: renumberFlow(next) };
  });
  const duplicate = (index) => onChange((prev) => { const next = [...prev.flow_schema]; next.splice(index + 1, 0, { ...clone(next[index]), label: `${next[index].label || "Approval"} (Copy)` }); return { ...prev, flow_schema: renumberFlow(next) }; });
  const add = () => onChange((prev) => ({ ...prev, flow_schema: renumberFlow([...prev.flow_schema, { role: "ketua", label: "Approval Ketua", action: "approve" }]) }));
  const applyTemplate = (template) => onChange((prev) => ({ ...prev, payment_required: template.paymentRequired, flow_schema: renumberFlow(clone(template.flow)) }));

  return (
    <div className="mm-builder">
      <div className="mm-section-head"><div><div className="mm-section-kicker">Visual Flow Builder</div><h3>Approval Flow</h3><p>Choose a template or arrange the steps manually using the up and down buttons.</p></div><button type="button" className="admin-small-btn" onClick={add}>+ Add Step</button></div>
      <div className="mm-template-grid">{FLOW_TEMPLATES.map((template) => <button type="button" key={template.id} className="mm-template" onClick={() => applyTemplate(template)}><strong>{template.label}</strong><small>{template.description}</small></button>)}</div>
      {!flow.length ? <div className="mm-direct-info">No approval steps: the request will be completed immediately after submission.</div> : null}
      <div className="mm-builder-list">
        {flow.map((step, index) => (
          <article className="mm-builder-card" key={`${step.role}-${step.action}-${index}`}>
            <div className="mm-builder-card-head"><div><span>Step {index + 1}</span><strong>{step.label || "Unnamed step"}</strong></div><div className="mm-card-actions"><button type="button" onClick={() => move(index, -1)} disabled={index === 0} title="Move up">↑</button><button type="button" onClick={() => move(index, 1)} disabled={index === flow.length - 1} title="Move down">↓</button><button type="button" onClick={() => duplicate(index)} title="Duplicate">⧉</button><button type="button" onClick={() => remove(index)} title="Delete">×</button></div></div>
            <div className="mm-grid-2">
              <label>Responsible role<select className="admin-input" value={step.role || ""} onChange={(event) => { const role = event.target.value; const action = step.action || "approve"; update(index, { role, label: automaticStepLabel(action, role) }); }}>{ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
              <label>Action<select className="admin-input" value={step.action || "approve"} onChange={(event) => { const action = event.target.value; update(index, { action, label: automaticStepLabel(action, step.role) }); }}>{ACTION_OPTIONS.map((action) => <option key={action.value} value={action.value}>{action.label}</option>)}</select></label>
            </div>
            <label>Step name<input className="admin-input" value={step.label || ""} onChange={(event) => update(index, { label: event.target.value })} /></label>
          </article>
        ))}
      </div>
    </div>
  );
}

function BasicInformation({ value, onChange, autoCode, setAutoCode }) {
  const set = (key, nextValue) => onChange((prev) => ({ ...prev, [key]: nextValue }));
  return (
    <div className="mm-panel-grid">
      <div className="mm-section-head"><div><div className="mm-section-kicker">Basic Information</div><h3>Request Identity</h3><p>This information appears in the master list and resident page.</p></div></div>
      <div className="mm-grid-2">
        <label>Request name<input className="admin-input" value={value.name} onChange={(event) => { const name = event.target.value; onChange((prev) => ({ ...prev, name, ...(autoCode ? { code: normalizeCode(name) } : {}) })); }} placeholder="Example: Home Renovation Permit" /></label>
        <label>System code<input className="admin-input" value={value.code} onChange={(event) => { setAutoCode(false); set("code", normalizeCode(event.target.value)); }} placeholder="HOME_RENOVATION_PERMIT" /><small className="mm-help"><button type="button" onClick={() => { setAutoCode(true); set("code", normalizeCode(value.name)); }}>Generate automatically</button></small></label>
        <label>Category<input className="admin-input" value={value.category} onChange={(event) => set("category", event.target.value)} placeholder="Permits" /></label>
        <label>Icon<select className="admin-input" value={value.icon} onChange={(event) => set("icon", event.target.value)}>{ICON_OPTIONS.map((icon) => <option key={icon} value={icon}>{icon}</option>)}</select></label>
        <label>Color<input className="admin-input mm-color-input" type="color" value={value.color || "#2563eb"} onChange={(event) => set("color", event.target.value)} /></label>
      </div>
      <label>Description<textarea className="admin-input" rows={3} value={value.description} onChange={(event) => set("description", event.target.value)} placeholder="Briefly explain the purpose and requirements of this request." /></label>
    </div>
  );
}

function PaymentSettings({ value, onChange }) {
  const set = (key, nextValue) => onChange((prev) => ({ ...prev, [key]: nextValue }));
  const hasPaymentValidation = (value.flow_schema || []).some((step) => step.action === "validate_payment");
  const [validatorRole, setValidatorRole] = useState("bendahara");
  function addValidation() {
    onChange((prev) => ({ ...prev, payment_required: true, flow_schema: renumberFlow([...prev.flow_schema.filter((step) => step.action !== "validate_payment"), { role: validatorRole, label: `Validasi Pembayaran oleh ${roleLabel(validatorRole)}`, action: "validate_payment" }]) }));
  }
  return (
    <div className="mm-panel-grid">
      <div className="mm-section-head"><div><div className="mm-section-kicker">Payment</div><h3>Payment Rules</h3><p>Connect payment to a validation step without editing JSON.</p></div></div>
      <label className="mm-switch"><input type="checkbox" checked={value.payment_required} onChange={(event) => set("payment_required", event.target.checked)} /><span>This request requires payment</span></label>
      {value.payment_required ? <>
        <div className="mm-grid-2"><label>Payment amount<input className="admin-input" type="number" min="0" value={value.payment_amount} onChange={(event) => set("payment_amount", event.target.value)} /></label><label>Payment validator<select className="admin-input" value={validatorRole} onChange={(event) => setValidatorRole(event.target.value)}>{ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label></div>
        <label>Payment instructions<textarea className="admin-input" rows={3} value={value.payment_instruction} onChange={(event) => set("payment_instruction", event.target.value)} placeholder="Transfer to the residents' fund account and wait for validation." /></label>
        {!hasPaymentValidation ? <div className="mm-warning"><div><strong>Payment validation step is missing</strong><p>Add a payment validation step to any position in the flow.</p></div><button type="button" className="admin-small-btn" onClick={addValidation}>Add Automatically</button></div> : <div className="mm-success-note">✓ Payment validation step is present.</div>}
      </> : <div className="mm-direct-info">The request will be displayed as free of charge.</div>}
    </div>
  );
}

function AdvancedEditor({ value, editable, setEditable, fieldsText, setFieldsText, flowText, setFlowText, onApply, error }) {
  return (
    <details className="mm-advanced">
      <summary>Advanced Settings · JSON</summary>
      <div className="mm-warning"><div><strong>Use only for technical needs</strong><p>The visual builder remains the primary method. Invalid JSON can damage the configuration.</p></div><button type="button" className="admin-small-btn" onClick={() => setEditable((prev) => !prev)}>{editable ? "Lock JSON" : "Enable JSON Editing"}</button></div>
      <label>Fields Schema<textarea className="admin-input mm-json" rows={10} readOnly={!editable} value={editable ? fieldsText : JSON.stringify(value.fields_schema || [], null, 2)} onChange={(event) => setFieldsText(event.target.value)} /></label>
      <label>Flow Schema<textarea className="admin-input mm-json" rows={10} readOnly={!editable} value={editable ? flowText : JSON.stringify(value.flow_schema || [], null, 2)} onChange={(event) => setFlowText(event.target.value)} /></label>
      {error ? <div className="mm-error-note">{error}</div> : null}
      {editable ? <button type="button" className="admin-small-btn" onClick={onApply}>Apply JSON to Builder</button> : null}
    </details>
  );
}

function VersionHistory({ value, onRestore }) {
  const versions = value.version_history || [];
  if (!versions.length) return <div className="mm-direct-info">No version has been published yet.</div>;
  const ascending = [...versions].sort((left, right) => Number(left.revision || 0) - Number(right.revision || 0));
  return (
    <details className="mm-history">
      <summary>Version history · {versions.length} versions</summary>
      <div className="mm-history-list">
        {versions.map((version) => {
          const previous = [...ascending].reverse().find((candidate) => Number(candidate.revision || 0) < Number(version.revision || 0)) || null;
          return (
            <div className="mm-history-item mm-history-item-with-diff" key={`${version.revision}-${version.published_at}`}>
              <div><strong>Version {version.revision}</strong><small>{formatDate(version.published_at || version.updated_at)} · {version.name}</small></div>
              <button type="button" className="admin-small-btn" onClick={() => onRestore(version)}>Restore as Draft</button>
              <div className="mm-version-diff-slot"><MasterVersionHistoryDiff previous={previous} version={version} /></div>
            </div>
          );
        })}
      </div>
    </details>
  );
}

function ReadOnlyPreviewModal({ preview, onClose, onEdit }) {
  useEffect(() => {
    if (!preview) return undefined;
    const onKeyDown = (event) => event.key === "Escape" && onClose();
    document.body.classList.add("mm-ro-modal-open");
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("mm-ro-modal-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [preview, onClose]);

  if (!preview || typeof document === "undefined") return null;
  const config = { ...preview.master, ...preview.config };
  const badge = preview.kind === "draft"
    ? `Draft v${preview.master.draft_revision || preview.config.revision || "-"} · Not published`
    : `Active Version v${preview.master.published_revision || preview.config.revision || "-"}`;

  return createPortal(
    <div className="mm-ro-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="mm-ro-modal" role="dialog" aria-modal="true" aria-label={`Preview ${preview.master.name}`}>
        <header className="mm-ro-header">
          <div><span className={preview.kind === "draft" ? "is-draft" : "is-active"}>{badge}</span><h2>Read-only Preview</h2><p>Review the resident view and approval flow without changing the configuration.</p></div>
          <button type="button" className="mm-ro-close" onClick={onClose} aria-label="Close preview">×</button>
        </header>
        <div className="mm-ro-body"><MasterPreview value={config} /></div>
        <footer className="mm-ro-footer">
          <button type="button" className="admin-small-btn" onClick={onClose}>Close</button>
          <button type="button" className="admin-btn" onClick={onEdit}>{preview.master.has_draft ? "Edit Draft" : "Edit"}</button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

export default function MasterManagementTab() {
  const [data, setData] = useState({ masters: [] });
  const [loading, setLoading] = useState(true);
  const [savingAction, setSavingAction] = useState("");
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState(null);
  const [editorMode, setEditorMode] = useState("create");
  const [wizardStep, setWizardStep] = useState(0);
  const [autoCode, setAutoCode] = useState(true);
  const [advancedEditable, setAdvancedEditable] = useState(false);
  const [fieldsText, setFieldsText] = useState("[]");
  const [flowText, setFlowText] = useState("[]");
  const [advancedError, setAdvancedError] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const [preview, setPreview] = useState(null);
  const saving = Boolean(savingAction);

  const errors = useMemo(() => editor ? validateMaster(editor, true) : [], [editor]);
  const filteredMasters = useMemo(() => {
    const term = clean(search).toLowerCase();
    if (!term) return data.masters || [];
    return (data.masters || []).filter((master) => [master.code, master.name, master.category, master.lifecycle_status, ...(master.flow_schema || []).map((step) => step.role)].join(" ").toLowerCase().includes(term));
  }, [data.masters, search]);

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
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

  function openEditor(nextEditor, mode = "edit", step = 0) {
    setEditor(nextEditor);
    setEditorMode(mode);
    setWizardStep(step);
    setAutoCode(mode === "create");
    setAdvancedEditable(false);
    setAdvancedError("");
    setFieldsText(JSON.stringify(nextEditor.fields_schema || [], null, 2));
    setFlowText(JSON.stringify(nextEditor.flow_schema || [], null, 2));
  }

  function createMaster() {
    openEditor(makeEmptyForm(), "create", 0);
  }

  function editMaster(master, step = 0) {
    openEditor(masterToForm(master), "edit", step);
  }

  function duplicateMaster(master) {
    const copy = masterToForm(master);
    copy.id = "";
    copy.code = `${normalizeCode(copy.code)}_COPY`;
    copy.name = `${copy.name} (Copy)`;
    copy.lifecycle_status = "draft";
    copy.published_revision = 0;
    copy.draft_revision = 0;
    copy.has_draft = false;
    copy.version_history = [];
    copy.published_config = null;
    openEditor(copy, "duplicate", 0);
  }

  function restoreVersion(version) {
    setEditor((previous) => ({
      ...previous,
      ...clone(version),
      id: previous.id,
      lifecycle_status: "draft",
      published_revision: previous.published_revision,
      draft_revision: Math.max(previous.published_revision + 1, previous.draft_revision || 0),
      has_draft: true,
      version_history: previous.version_history,
      published_config: previous.published_config,
    }));
    setWizardStep(4);
    showToast(`Version ${version.revision} was restored to the editor as a draft`);
  }

  function applyAdvancedJson() {
    try {
      const nextFields = JSON.parse(fieldsText || "[]");
      const nextFlow = JSON.parse(flowText || "[]");
      if (!Array.isArray(nextFields) || !Array.isArray(nextFlow)) throw new Error("Fields and flow must be JSON arrays");
      setEditor((prev) => ({ ...prev, fields_schema: nextFields, flow_schema: renumberFlow(nextFlow) }));
      setAdvancedError("");
      setAdvancedEditable(false);
      showToast("JSON was applied to the visual builder");
    } catch (err) {
      setAdvancedError(err.message || "Invalid JSON format");
    }
  }

  async function persist(nextLifecycle) {
    if (!editor || saving) return;
    const next = { ...editor, lifecycle_status: nextLifecycle, active: nextLifecycle === "active", fields_schema: clone(editor.fields_schema || []), flow_schema: renumberFlow(clone(editor.flow_schema || [])) };
    const validation = validateMaster(next, nextLifecycle === "active");
    if (validation.length) {
      setWizardStep(validation[0].step);
      showToast(validation[0].message, "error");
      return;
    }
    try {
      setSavingAction(nextLifecycle);
      await sendJson(APPROVAL_MASTERS_API, "POST", next);
      showToast(nextLifecycle === "active" ? "A new version was published" : nextLifecycle === "archived" ? "The master was archived" : editor.published_revision ? "Draft saved. The active version remains available to residents." : "Draft saved");
      setEditor(null);
      await loadData();
    } catch (err) {
      showToast(err.message || "Failed to save approval master", "error");
    } finally {
      setSavingAction("");
    }
  }

  async function executePendingAction() {
    if (!pendingAction) return;
    const { type, master } = pendingAction;
    try {
      setSavingAction(type);
      if (type === "discard") {
        await sendJson(APPROVAL_MASTERS_API, "POST", { id: master.id, operation: "discard_draft" });
        showToast("Draft discarded. The active version was not changed.");
      } else {
        await sendJson(APPROVAL_MASTERS_API, "POST", { ...masterToForm(master), lifecycle_status: "archived", active: false });
        showToast("The master was archived");
      }
      setPendingAction(null);
      await loadData();
    } catch (err) {
      showToast(err.message || "Failed to process approval master", "error");
    } finally {
      setSavingAction("");
    }
  }

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    if (!editor || advancedEditable) return;
    setFieldsText(JSON.stringify(editor.fields_schema || [], null, 2));
    setFlowText(JSON.stringify(editor.flow_schema || [], null, 2));
  }, [editor, advancedEditable]);

  if (loading && !(data.masters || []).length) return <div className="admin-card"><AdminDataSkeleton showSummary={false} rows={6} /></div>;

  const pendingIsDiscard = pendingAction?.type === "discard";

  return (
    <>
      <Toast show={!!toast} type={toast?.type} message={toast?.message} />
      <style jsx global>{CSS}</style>
      <AdminConfirmModal open={!!pendingAction} title={pendingIsDiscard ? "Discard Draft Changes" : "Archive Approval Master"} description={pendingAction ? (pendingIsDiscard ? `The draft for ${pendingAction.master.name} will be deleted, while the active version remains available.` : `${pendingAction.master.name} will no longer appear on the resident request page.`) : ""} confirmText={pendingIsDiscard ? "Discard Draft" : "Archive"} cancelText="Cancel" loading={saving} loadingText="Processing..." onCancel={() => !saving && setPendingAction(null)} onConfirm={executePendingAction} />
      <ReadOnlyPreviewModal preview={preview} onClose={() => setPreview(null)} onEdit={() => { const master = preview?.master; setPreview(null); if (master) editMaster(master); }} />
      <div className="admin-card mm-root">
        {!editor ? (
          <>
            <div className="mm-list-head"><div><div className="activity-kicker">No-code Configuration</div><h3 className="activity-title">Master Management</h3><p className="activity-subtitle">Build forms, attachments, approval flows, and configuration versions without writing JSON.</p></div><button type="button" className="admin-btn" onClick={createMaster}>+ Create Request</button></div>
            <input className="admin-search-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, code, category, status, or role..." />
            <div className="mm-master-list">
              {filteredMasters.map((master) => {
                const status = lifecycleMeta(master.lifecycle_status);
                const activeConfig = master.published_config || (master.lifecycle_status === "active" && !master.has_draft ? master : null);
                const draftConfig = master.has_draft || !master.published_revision ? master : null;
                return (
                  <article className="mm-master-card" key={master.id}>
                    <div className="mm-master-main"><span className="mm-master-icon" style={{ background: master.color || "#2563eb" }}>{master.icon || "📄"}</span><div><div className="mm-master-title-row"><h4>{master.name}</h4><span className={`mm-status ${status.className}`}>{status.label}</span>{master.has_draft ? <span className="mm-status mm-status-draft">Draft v{master.draft_revision} available</span> : null}</div><p>{master.category || "General"} · {(master.fields_schema || []).length} fields · {(master.flow_schema || []).length} steps · Active version {master.published_revision || "-"}</p><small>{(master.flow_schema || []).map((step) => roleLabel(step.role)).join(" → ") || "No approval"}</small></div></div>
                    <div className="mm-master-payment">{master.payment_required ? money(master.payment_amount) : "Free"}</div>
                    <div className="mm-master-actions">
                      <button type="button" className="admin-small-btn" onClick={() => editMaster(master)}>Edit{master.has_draft ? " Draft" : ""}</button>
                      <button type="button" className="admin-small-btn" onClick={() => duplicateMaster(master)}>Duplicate</button>
                      {draftConfig ? <button type="button" className="admin-small-btn" onClick={() => setPreview({ master, kind: "draft", config: draftConfig })}>Preview Draft</button> : null}
                      {activeConfig ? <button type="button" className="admin-small-btn" onClick={() => setPreview({ master, kind: "active", config: activeConfig })}>View Active Version</button> : null}
                      {master.has_draft && master.published_revision ? <button type="button" className="admin-small-btn mm-warning-btn" onClick={() => setPendingAction({ type: "discard", master })}>Discard Draft</button> : null}
                      {master.lifecycle_status !== "archived" ? <button type="button" className="admin-small-btn mm-danger-btn" onClick={() => setPendingAction({ type: "archive", master })}>Archive</button> : null}
                    </div>
                  </article>
                );
              })}
              {!filteredMasters.length ? <div className="admin-empty-state">No approval master found.</div> : null}
            </div>
          </>
        ) : (
          <div className="mm-editor">
            <div className="mm-editor-head"><div><div className="activity-kicker">{editorMode === "create" ? "New Master" : editorMode === "duplicate" ? "Duplicate Master" : editor.has_draft ? "Edit Draft" : "Edit Master"}</div><h3 className="activity-title">{editor.name || "New Request"}</h3><p className="activity-subtitle">{editor.published_revision ? `Active version ${editor.published_revision}${editor.has_draft ? ` · Draft ${editor.draft_revision}` : ""}. Saving a draft does not affect residents.` : "Never published."}</p></div><button type="button" className="admin-small-btn" onClick={() => !saving && setEditor(null)}>Close</button></div>
            <div className="mm-wizard">{WIZARD_STEPS.map((step, index) => <button type="button" key={step} className={wizardStep === index ? "is-active" : errors.some((error) => error.step === index) ? "has-error" : ""} onClick={() => setWizardStep(index)}><span>{index + 1}</span>{step}</button>)}</div>
            <div className="mm-editor-body">
              {wizardStep === 0 ? <BasicInformation value={editor} onChange={setEditor} autoCode={autoCode} setAutoCode={setAutoCode} /> : null}
              {wizardStep === 1 ? <FieldBuilder value={editor} onChange={setEditor} /> : null}
              {wizardStep === 2 ? <FlowBuilder value={editor} onChange={setEditor} /> : null}
              {wizardStep === 3 ? <PaymentSettings value={editor} onChange={setEditor} /> : null}
              {wizardStep === 4 ? <><div className="mm-section-head"><div><div className="mm-section-kicker">Live Preview</div><h3>Resident View and Flow</h3><p>Preview standard fields, options, attachments, and approval steps before publishing.</p></div></div><MasterPreview value={editor} /></> : null}
              {wizardStep === 5 ? <div className="mm-panel-grid"><div className="mm-section-head"><div><div className="mm-section-kicker">Validation and Publishing</div><h3>Ready to Publish?</h3><p>Publishing creates a new revision. The previous active version is added to history and can still be restored.</p></div></div><div className="mm-version-summary"><div><span>Active Version</span><strong>{editor.published_revision || "None"}</strong></div><div><span>Draft</span><strong>{editor.has_draft ? editor.draft_revision : "Not saved"}</strong></div><div><span>Next Version</span><strong>{Math.max(editor.published_revision || 0, editor.draft_revision || 0) + 1}</strong></div></div><div className="mm-checklist">{errors.length ? errors.map((error, index) => <button type="button" key={`${error.step}-${index}`} className="mm-check-error" onClick={() => setWizardStep(error.step)}>× {error.message}</button>) : <div className="mm-check-success">✓ All configuration is valid and ready to publish.</div>}</div><div className="mm-publication-actions"><button type="button" className="admin-small-btn" disabled={saving} onClick={() => persist("draft")}><LoadingButtonContent loading={savingAction === "draft"} loadingText="Saving...">Save Draft</LoadingButtonContent></button><button type="button" className="admin-btn" disabled={saving || errors.length > 0} onClick={() => persist("active")}><LoadingButtonContent loading={savingAction === "active"} loadingText="Publishing...">Publish New Version</LoadingButtonContent></button>{editor.id ? <button type="button" className="admin-small-btn mm-danger-btn" disabled={saving} onClick={() => persist("archived")}><LoadingButtonContent loading={savingAction === "archived"} loadingText="Archiving...">Archive</LoadingButtonContent></button> : null}</div><VersionHistory value={editor} onRestore={restoreVersion} /><AdvancedEditor value={editor} editable={advancedEditable} setEditable={setAdvancedEditable} fieldsText={fieldsText} setFieldsText={setFieldsText} flowText={flowText} setFlowText={setFlowText} onApply={applyAdvancedJson} error={advancedError} /></div> : null}
            </div>
            <div className={`mm-footer ${wizardStep === WIZARD_STEPS.length - 1 ? "is-single" : ""}`}><button type="button" className="admin-small-btn" disabled={wizardStep === 0 || saving} onClick={() => setWizardStep((prev) => Math.max(0, prev - 1))}>Back</button>{wizardStep < WIZARD_STEPS.length - 1 ? <button type="button" className="admin-btn" disabled={saving} onClick={() => setWizardStep((prev) => Math.min(WIZARD_STEPS.length - 1, prev + 1))}>Next</button> : null}</div>
          </div>
        )}
      </div>
    </>
  );
}

const CSS = `
.mm-root{height:auto!important;overflow:visible!important}.mm-list-head,.mm-editor-head,.mm-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:16px}.mm-list-head .admin-btn{flex:0 0 auto}.mm-master-list{display:grid;gap:12px;margin-top:14px}.mm-master-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:14px;border:1px solid var(--admin-border);border-radius:16px;background:var(--admin-card)}.mm-master-main{display:grid;grid-template-columns:46px minmax(0,1fr);gap:12px;align-items:start}.mm-master-icon{display:grid;place-items:center;width:46px;height:46px;border-radius:14px;color:#fff;font-size:22px}.mm-master-title-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.mm-master-title-row h4{margin:0;font-size:16px}.mm-master-main p{margin:4px 0;color:var(--admin-muted);font-size:13px;font-weight:700}.mm-master-main small{color:var(--admin-muted);font-size:12px;font-weight:700}.mm-master-payment{align-self:start;font-size:13px;font-weight:900}.mm-master-actions{grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap}.mm-master-actions .admin-small-btn{flex:1 1 110px}.mm-status{display:inline-flex;padding:4px 8px;border-radius:999px;font-size:10px;font-weight:900;text-transform:uppercase}.mm-status-active{background:#dcfce7;color:#166534}.mm-status-draft{background:#fef3c7;color:#92400e}.mm-status-archived{background:var(--admin-row);color:var(--admin-muted)}.mm-danger-btn{background:#fee2e2!important;color:#991b1b!important;border-color:#fca5a5!important}.mm-warning-btn{background:#fffbeb!important;color:#92400e!important;border-color:#fcd34d!important}.mm-editor{display:grid;gap:14px}.mm-wizard{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px}.mm-wizard button{min-height:48px;padding:7px;border:1px solid var(--admin-border);border-radius:12px;background:var(--admin-row);color:var(--admin-muted);font:inherit;font-size:11px;font-weight:900;cursor:pointer}.mm-wizard button span{display:block;margin-bottom:2px}.mm-wizard button.is-active{border-color:var(--admin-primary);background:color-mix(in srgb,var(--admin-primary) 12%,var(--admin-card));color:var(--admin-text)}.mm-wizard button.has-error{border-color:#fca5a5;color:#991b1b}.mm-editor-body{padding:16px;border:1px solid var(--admin-border);border-radius:16px;background:var(--admin-row)}.mm-panel-grid,.mm-builder{display:grid;gap:14px}.mm-section-head{margin-bottom:0}.mm-section-head h3{margin:2px 0 4px}.mm-section-head p,.mm-muted{margin:0;color:var(--admin-muted);font-size:13px;line-height:1.45}.mm-section-kicker{color:var(--admin-primary);font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.mm-grid-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.mm-panel-grid label,.mm-builder-card label,.mm-advanced label{display:grid;gap:6px;color:var(--admin-muted);font-size:12px;font-weight:900}.mm-color-input{padding:4px!important}.mm-help{display:block}.mm-help button{padding:0;border:0;background:transparent;color:var(--admin-primary);font-size:11px;font-weight:900;cursor:pointer}.mm-inline-help{color:var(--admin-muted);font-size:10px;font-weight:700}.mm-builder-list{display:grid;gap:10px}.mm-builder-card{display:grid;gap:12px;padding:13px;border:1px solid var(--admin-border);border-radius:14px;background:var(--admin-card)}.mm-builder-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.mm-builder-card-head span{display:block;color:var(--admin-muted);font-size:10px;font-weight:900;text-transform:uppercase}.mm-builder-card-head strong{display:block;margin-top:2px;font-size:14px}.mm-card-actions{display:flex;gap:5px}.mm-card-actions button{display:grid;place-items:center;width:32px;height:32px;border:1px solid var(--admin-border);border-radius:9px;background:var(--admin-row);color:var(--admin-text);font-weight:900;cursor:pointer}.mm-card-actions button:disabled{opacity:.35;cursor:not-allowed}.mm-toggle-row{display:flex;gap:18px;flex-wrap:wrap}.mm-check{display:flex!important;grid-template-columns:auto 1fr!important;align-items:center;gap:7px!important}.mm-check input{width:auto!important;margin:0!important}.mm-template-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}.mm-template{display:grid;gap:4px;padding:11px;border:1px solid var(--admin-border);border-radius:12px;background:var(--admin-card);color:var(--admin-text);text-align:left;cursor:pointer}.mm-template:hover{border-color:var(--admin-primary)}.mm-template small{color:var(--admin-muted);line-height:1.35}.mm-direct-info,.mm-success-note,.mm-error-note{padding:11px 12px;border:1px solid var(--admin-border);border-radius:12px;background:var(--admin-card);color:var(--admin-muted);font-size:12px;font-weight:800}.mm-success-note{border-color:#86efac;background:#f0fdf4;color:#166534}.mm-error-note{border-color:#fca5a5;background:#fef2f2;color:#991b1b}.mm-switch{display:flex!important;grid-template-columns:auto 1fr!important;align-items:center;gap:9px!important;padding:12px;border:1px solid var(--admin-border);border-radius:12px;background:var(--admin-card);color:var(--admin-text)!important}.mm-switch input{width:auto!important;margin:0!important}.mm-warning{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border:1px solid #fcd34d;border-radius:12px;background:#fffbeb;color:#92400e}.mm-warning p{margin:3px 0 0;font-size:12px}.mm-preview-layout{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(260px,.7fr);gap:12px}.mm-preview-card{position:relative;display:grid;gap:12px;padding:14px;border:1px solid var(--admin-border);border-radius:16px;background:var(--admin-card)}.mm-preview-title{display:flex;align-items:center;gap:10px}.mm-preview-title>span{display:grid;place-items:center;width:44px;height:44px;border-radius:13px;color:#fff;font-size:21px}.mm-preview-title small{color:var(--admin-muted);font-size:10px;font-weight:900;text-transform:uppercase}.mm-preview-title h3{margin:2px 0 0}.mm-payment-preview,.mm-free-preview{display:grid;justify-self:start;padding:8px 10px;border:1px solid var(--admin-border);border-radius:10px;background:var(--admin-row)}.mm-payment-preview small{color:var(--admin-muted);font-size:10px;font-weight:900}.mm-payment-preview strong{color:#15803d}.mm-free-preview{color:var(--admin-muted);font-size:12px;font-weight:900}.mm-preview-form{display:grid;gap:11px}.mm-preview-form label{display:grid;gap:6px;color:var(--admin-muted);font-size:12px}.mm-preview-options{display:flex;gap:12px;flex-wrap:wrap}.mm-file-preview{display:flex;align-items:center;gap:10px;min-height:48px;padding:9px 11px;border:1px dashed var(--admin-border);border-radius:10px;background:var(--admin-row)}.mm-file-preview>span{font-size:22px}.mm-file-preview strong,.mm-file-preview small{display:block}.mm-file-preview small{margin-top:2px;color:var(--admin-muted)}.mm-flow-preview{display:grid;gap:0}.mm-flow-node{position:relative;display:grid;grid-template-columns:32px minmax(0,1fr);gap:9px;min-height:60px}.mm-flow-node>span{z-index:1;display:grid;place-items:center;width:28px;height:28px;border-radius:999px;background:var(--admin-primary);color:#fff;font-size:11px;font-weight:900}.mm-flow-node:not(:last-child)::after{content:"";position:absolute;left:13px;top:28px;bottom:0;width:2px;background:var(--admin-border)}.mm-flow-node strong,.mm-flow-node small{display:block}.mm-flow-node small{margin-top:3px;color:var(--admin-muted);font-size:11px}.mm-version-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.mm-version-summary>div{display:grid;gap:3px;padding:11px;border:1px solid var(--admin-border);border-radius:12px;background:var(--admin-card)}.mm-version-summary span{color:var(--admin-muted);font-size:10px;font-weight:900;text-transform:uppercase}.mm-version-summary strong{font-size:16px}.mm-checklist{display:grid;gap:7px}.mm-check-error{padding:10px 12px;border:1px solid #fca5a5;border-radius:10px;background:#fef2f2;color:#991b1b;text-align:left;font-weight:800;cursor:pointer}.mm-check-success{padding:12px;border:1px solid #86efac;border-radius:12px;background:#f0fdf4;color:#166534;font-weight:900}.mm-publication-actions,.mm-footer{display:flex;gap:9px;flex-wrap:wrap}.mm-publication-actions>*{flex:1 1 150px}.mm-advanced,.mm-history{display:grid;gap:12px;padding:12px;border:1px solid var(--admin-border);border-radius:12px;background:var(--admin-card)}.mm-advanced summary,.mm-history summary{cursor:pointer;font-weight:900}.mm-advanced[open],.mm-history[open]{display:grid}.mm-history-list{display:grid;gap:8px;margin-top:10px}.mm-history-item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px;border:1px solid var(--admin-border);border-radius:10px;background:var(--admin-row)}.mm-history-item strong,.mm-history-item small{display:block}.mm-history-item small{margin-top:3px;color:var(--admin-muted);font-size:10px}.mm-json{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace!important;font-size:11px!important;line-height:1.45!important}.mm-footer{align-items:center;justify-content:space-between;padding-top:4px}.mm-footer .admin-btn,.mm-footer .admin-small-btn{min-width:120px}
@media(max-width:760px){.mm-list-head,.mm-editor-head,.mm-section-head{align-items:stretch;flex-direction:column}.mm-list-head .admin-btn{width:100%}.mm-wizard{grid-template-columns:repeat(3,minmax(0,1fr))}.mm-grid-2,.mm-preview-layout{grid-template-columns:1fr}.mm-master-card{grid-template-columns:1fr}.mm-master-payment{grid-row:auto}.mm-warning{align-items:stretch;flex-direction:column}.mm-version-summary{grid-template-columns:1fr}.mm-history-item{align-items:stretch;flex-direction:column}.mm-history-item button{width:100%}}
`;
