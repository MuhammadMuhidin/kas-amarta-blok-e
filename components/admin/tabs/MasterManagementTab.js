"use client";

import Toast from "@/components/Toast";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";
import AdminDataSkeleton from "@/components/admin/AdminDataSkeleton";
import LoadingButtonContent from "@/components/admin/LoadingButtonContent";
import { readJson, sendJson } from "@/components/admin/adminClientApi";
import { ADMIN_ACCESS_ROLES } from "@/lib/adminRoles";
import { useEffect, useMemo, useState } from "react";

const APPROVAL_MASTERS_API = "/api/admin/approval-masters";
const WIZARD_STEPS = ["Informasi", "Form", "Approval", "Pembayaran", "Preview", "Publikasi"];

const FIELD_TYPES = [
  { value: "text", label: "Teks" },
  { value: "textarea", label: "Teks panjang" },
  { value: "number", label: "Nomor" },
  { value: "money", label: "Nominal uang" },
  { value: "date", label: "Tanggal" },
  { value: "tel", label: "Nomor WhatsApp" },
  { value: "select", label: "Pilihan dropdown" },
  { value: "radio", label: "Pilihan radio" },
  { value: "checkbox", label: "Ya / Tidak" },
  { value: "image", label: "Upload gambar" },
  { value: "file", label: "Upload dokumen" },
];

const ACTION_OPTIONS = [
  { value: "approve", label: "Persetujuan" },
  { value: "final_approval", label: "Persetujuan akhir" },
  { value: "validate_payment", label: "Validasi pembayaran" },
  { value: "validate_document", label: "Pemeriksaan dokumen" },
  { value: "confirm_execution", label: "Konfirmasi pelaksanaan" },
];

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
  { id: "simple", label: "Persetujuan sederhana", description: "Ketua memberi persetujuan akhir.", paymentRequired: false, flow: [{ role: "ketua", label: "Approval Ketua", action: "final_approval" }] },
  { id: "paid", label: "Pengajuan berbayar", description: "Bendahara memvalidasi pembayaran lalu Ketua menyetujui.", paymentRequired: true, flow: DEFAULT_FLOW },
  { id: "administration", label: "Administrasi", description: "Sekretaris memeriksa dokumen lalu Ketua menyetujui.", paymentRequired: false, flow: [{ role: "sekretaris", label: "Pemeriksaan Dokumen", action: "validate_document" }, { role: "ketua", label: "Approval Ketua", action: "final_approval" }] },
  { id: "facility", label: "Sarana dan prasarana", description: "Sapras memeriksa kebutuhan lalu Ketua menyetujui.", paymentRequired: false, flow: [{ role: "sapras", label: "Pemeriksaan Sarana", action: "approve" }, { role: "ketua", label: "Approval Ketua", action: "final_approval" }] },
  { id: "direct", label: "Tanpa approval", description: "Pengajuan langsung selesai setelah dikirim.", paymentRequired: false, flow: [] },
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
  return ADMIN_ACCESS_ROLES.find((role) => role.value === value)?.label || value || "Pengurus";
}

function actionLabel(value) {
  return ACTION_OPTIONS.find((action) => action.value === value)?.label || value || "Persetujuan";
}

function automaticStepLabel(action, role) {
  return `${actionLabel(action)} oleh ${roleLabel(role)}`;
}

function formatDate(value) {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime())
    ? date.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "-";
}

function makeEmptyForm() {
  return {
    id: "",
    code: "",
    name: "",
    category: "Umum",
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
    category: master.category || "Umum",
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
  if (status === "active") return { label: "Aktif", className: "mm-status-active" };
  if (status === "archived") return { label: "Diarsipkan", className: "mm-status-archived" };
  return { label: "Draft", className: "mm-status-draft" };
}

function validateMaster(value, full = true) {
  const errors = [];
  if (!clean(value.name)) errors.push({ step: 0, message: "Nama pengajuan wajib diisi" });
  if (!normalizeCode(value.code || value.name)) errors.push({ step: 0, message: "Kode pengajuan wajib diisi" });
  if (!full) return errors;

  const fields = Array.isArray(value.fields_schema) ? value.fields_schema : [];
  if (!fields.length) errors.push({ step: 1, message: "Minimal terdapat satu field pengajuan" });
  const keys = fields.map((field) => normalizeKey(field.key));
  if (keys.some((key) => !key)) errors.push({ step: 1, message: "Semua field harus memiliki nama sistem" });
  if (new Set(keys).size !== keys.length) errors.push({ step: 1, message: "Nama sistem field tidak boleh duplikat" });
  fields.forEach((field, index) => {
    if (!clean(field.label)) errors.push({ step: 1, message: `Field ${index + 1} belum memiliki label` });
    if (["select", "radio"].includes(field.type) && !(field.options || []).filter(clean).length) errors.push({ step: 1, message: `Pilihan untuk field ${field.label || index + 1} belum diisi` });
    if (["image", "file"].includes(field.type)) {
      const max = Number(field.max_size_mb || 0);
      if (!max || max < 1 || max > 20) errors.push({ step: 1, message: `${field.label || `Field ${index + 1}`} harus memiliki batas ukuran 1–20 MB` });
      if (!clean(field.accept)) errors.push({ step: 1, message: `${field.label || `Field ${index + 1}`} belum memiliki format file yang diizinkan` });
    }
  });

  const flow = Array.isArray(value.flow_schema) ? value.flow_schema : [];
  flow.forEach((step, index) => {
    if (!clean(step.role)) errors.push({ step: 2, message: `Tahap ${index + 1} belum memiliki penanggung jawab` });
    if (!clean(step.action)) errors.push({ step: 2, message: `Tahap ${index + 1} belum memiliki tindakan` });
    if (!clean(step.label)) errors.push({ step: 2, message: `Tahap ${index + 1} belum memiliki nama tahap` });
  });

  if (value.payment_required) {
    if (Number(value.payment_amount || 0) <= 0) errors.push({ step: 3, message: "Nominal pembayaran wajib lebih dari 0" });
    if (flow[0]?.action !== "validate_payment") errors.push({ step: 3, message: "Pengajuan berbayar harus diawali validasi pembayaran" });
  }
  return errors;
}

function PreviewField({ field }) {
  const options = (field.options || []).filter(clean);
  if (field.type === "textarea") return <textarea className="admin-input" rows={3} placeholder={field.placeholder || field.label} disabled />;
  if (field.type === "select") return <select className="admin-input" disabled><option>{field.placeholder || "Pilih salah satu"}</option>{options.map((option) => <option key={option}>{option}</option>)}</select>;
  if (field.type === "radio") return <div className="mm-preview-options">{options.map((option) => <label key={option}><input type="radio" disabled /> {option}</label>)}</div>;
  if (field.type === "checkbox") return <label className="mm-check"><input type="checkbox" disabled /> Ya</label>;
  if (["image", "file"].includes(field.type)) return <div className="mm-file-preview"><span>{field.type === "image" ? "🖼️" : "📎"}</span><div><strong>Pilih {field.type === "image" ? "gambar" : "dokumen"}</strong><small>Maksimal {field.max_size_mb || (field.type === "image" ? 5 : 10)} MB</small></div></div>;
  const inputType = field.type === "money" ? "number" : ["number", "date", "tel"].includes(field.type) ? field.type : "text";
  return <input className="admin-input" type={inputType} placeholder={field.placeholder || field.label} disabled />;
}

function MasterPreview({ value }) {
  return (
    <div className="mm-preview-layout">
      <section className="mm-preview-card">
        <div className="mm-preview-title"><span style={{ background: value.color }}>{value.icon}</span><div><small>{value.category || "Umum"}</small><h3>{value.name || "Nama Pengajuan"}</h3></div></div>
        {value.description ? <p className="mm-muted">{value.description}</p> : null}
        {value.payment_required ? <div className="mm-payment-preview"><small>Biaya Pengajuan</small><strong>{money(value.payment_amount)}</strong></div> : <div className="mm-free-preview">Tanpa biaya</div>}
        <div className="mm-preview-form">
          {(value.fields_schema || []).map((field, index) => <label key={`${field.key}-${index}`}><strong>{field.label || `Field ${index + 1}`}{field.required ? " *" : ""}</strong><PreviewField field={field} /></label>)}
          <button type="button" className="admin-btn" disabled>Kirim Pengajuan</button>
        </div>
      </section>
      <section className="mm-preview-card">
        <div className="mm-section-kicker">Preview Alur</div>
        <div className="mm-flow-preview">
          <div className="mm-flow-node"><span>✓</span><div><strong>Pengajuan dibuat</strong><small>Data diterima sistem</small></div></div>
          {(value.flow_schema || []).map((step, index) => <div className="mm-flow-node" key={`${step.role}-${index}`}><span>{index + 1}</span><div><strong>{step.label || actionLabel(step.action)}</strong><small>{roleLabel(step.role)}</small></div></div>)}
          <div className="mm-flow-node"><span>✓</span><div><strong>Selesai</strong><small>{value.flow_schema?.length ? "Setelah seluruh tahap diproses" : "Langsung selesai"}</small></div></div>
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
    const copy = { ...clone(source), key: `${source.key || "field"}_copy`, label: `${source.label || "Field"} (Salinan)` };
    const next = [...prev.fields_schema];
    next.splice(index + 1, 0, copy);
    return { ...prev, fields_schema: next };
  });
  const add = () => onChange((prev) => ({ ...prev, fields_schema: [...prev.fields_schema, { key: `field_${prev.fields_schema.length + 1}`, label: "Field Baru", type: "text", required: false, placeholder: "", show_summary: true }] }));

  return (
    <div className="mm-builder">
      <div className="mm-section-head"><div><div className="mm-section-kicker">Visual Form Builder</div><h3>Field Form Pengajuan</h3><p>Susun field tanpa mengetik JSON. Nama sistem dibuat otomatis dan masih dapat disesuaikan.</p></div><button type="button" className="admin-small-btn" onClick={add}>+ Tambah Field</button></div>
      {!fields.length ? <div className="admin-empty-state">Belum ada field. Tambahkan minimal satu field sebelum dipublikasikan.</div> : null}
      <div className="mm-builder-list">
        {fields.map((field, index) => {
          const hasOptions = ["select", "radio"].includes(field.type);
          const isUpload = ["image", "file"].includes(field.type);
          return (
            <article className="mm-builder-card" key={`${field.key}-${index}`}>
              <div className="mm-builder-card-head"><div><span>Field {index + 1}</span><strong>{field.label || "Tanpa label"}</strong></div><div className="mm-card-actions"><button type="button" onClick={() => move(index, -1)} disabled={index === 0} title="Naik">↑</button><button type="button" onClick={() => move(index, 1)} disabled={index === fields.length - 1} title="Turun">↓</button><button type="button" onClick={() => duplicate(index)} title="Duplikat">⧉</button><button type="button" onClick={() => remove(index)} title="Hapus">×</button></div></div>
              <div className="mm-grid-2">
                <label>Label<input className="admin-input" value={field.label || ""} onChange={(event) => { const label = event.target.value; const oldAutoKey = normalizeKey(field.label) === field.key || !field.key; update(index, { label, ...(oldAutoKey ? { key: normalizeKey(label) } : {}) }); }} /></label>
                <label>Nama sistem<input className="admin-input" value={field.key || ""} onChange={(event) => update(index, { key: normalizeKey(event.target.value) })} /></label>
                <label>Jenis field<select className="admin-input" value={field.type || "text"} onChange={(event) => { const type = event.target.value; update(index, { type, ...(["select", "radio"].includes(type) && !field.options ? { options: ["Pilihan 1"] } : {}), ...(type === "image" ? { accept: "image/jpeg,image/png,image/webp", max_size_mb: 5 } : {}), ...(type === "file" ? { accept: "application/pdf,image/jpeg,image/png,image/webp", max_size_mb: 10 } : {}) }); }}>{FIELD_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
                {!isUpload ? <label>Placeholder<input className="admin-input" value={field.placeholder || ""} onChange={(event) => update(index, { placeholder: event.target.value })} /></label> : <label>Batas ukuran (MB)<input className="admin-input" type="number" min="1" max="20" value={field.max_size_mb || (field.type === "image" ? 5 : 10)} onChange={(event) => update(index, { max_size_mb: event.target.value })} /></label>}
              </div>
              {hasOptions ? <label>Pilihan<textarea className="admin-input" rows={3} value={(field.options || []).join("\n")} onChange={(event) => update(index, { options: event.target.value.split("\n") })} placeholder="Satu pilihan per baris" /></label> : null}
              {isUpload ? <label>Format MIME yang diizinkan<input className="admin-input" value={field.accept || ""} onChange={(event) => update(index, { accept: event.target.value })} placeholder="application/pdf,image/jpeg" /><small className="mm-inline-help">Pisahkan dengan koma. Gambar aman: image/jpeg,image/png,image/webp.</small></label> : null}
              <div className="mm-toggle-row"><label className="mm-check"><input type="checkbox" checked={Boolean(field.required)} onChange={(event) => update(index, { required: event.target.checked })} /> Wajib diisi</label><label className="mm-check"><input type="checkbox" checked={field.show_summary !== false} onChange={(event) => update(index, { show_summary: event.target.checked })} /> Tampil di ringkasan</label></div>
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
  const duplicate = (index) => onChange((prev) => { const next = [...prev.flow_schema]; next.splice(index + 1, 0, { ...clone(next[index]), label: `${next[index].label || "Approval"} (Salinan)` }); return { ...prev, flow_schema: renumberFlow(next) }; });
  const add = () => onChange((prev) => ({ ...prev, flow_schema: renumberFlow([...prev.flow_schema, { role: "ketua", label: "Approval Ketua", action: "approve" }]) }));
  const applyTemplate = (template) => onChange((prev) => ({ ...prev, payment_required: template.paymentRequired, flow_schema: renumberFlow(clone(template.flow)) }));

  return (
    <div className="mm-builder">
      <div className="mm-section-head"><div><div className="mm-section-kicker">Visual Flow Builder</div><h3>Alur Persetujuan</h3><p>Pilih template atau susun tahap sendiri menggunakan tombol naik dan turun.</p></div><button type="button" className="admin-small-btn" onClick={add}>+ Tambah Tahap</button></div>
      <div className="mm-template-grid">{FLOW_TEMPLATES.map((template) => <button type="button" key={template.id} className="mm-template" onClick={() => applyTemplate(template)}><strong>{template.label}</strong><small>{template.description}</small></button>)}</div>
      {!flow.length ? <div className="mm-direct-info">Tanpa tahap approval: pengajuan akan langsung berstatus selesai setelah dikirim.</div> : null}
      <div className="mm-builder-list">
        {flow.map((step, index) => (
          <article className="mm-builder-card" key={`${step.role}-${step.action}-${index}`}>
            <div className="mm-builder-card-head"><div><span>Tahap {index + 1}</span><strong>{step.label || "Tanpa nama tahap"}</strong></div><div className="mm-card-actions"><button type="button" onClick={() => move(index, -1)} disabled={index === 0}>↑</button><button type="button" onClick={() => move(index, 1)} disabled={index === flow.length - 1}>↓</button><button type="button" onClick={() => duplicate(index)}>⧉</button><button type="button" onClick={() => remove(index)}>×</button></div></div>
            <div className="mm-grid-2">
              <label>Penanggung jawab<select className="admin-input" value={step.role || ""} onChange={(event) => { const role = event.target.value; const action = step.action || "approve"; update(index, { role, label: automaticStepLabel(action, role) }); }}>{ADMIN_ACCESS_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
              <label>Tindakan<select className="admin-input" value={step.action || "approve"} onChange={(event) => { const action = event.target.value; update(index, { action, label: automaticStepLabel(action, step.role) }); }}>{ACTION_OPTIONS.map((action) => <option key={action.value} value={action.value}>{action.label}</option>)}</select></label>
            </div>
            <label>Nama tahap<input className="admin-input" value={step.label || ""} onChange={(event) => update(index, { label: event.target.value })} /></label>
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
      <div className="mm-section-head"><div><div className="mm-section-kicker">Informasi Dasar</div><h3>Identitas Pengajuan</h3><p>Informasi ini tampil pada daftar master dan halaman warga.</p></div></div>
      <div className="mm-grid-2">
        <label>Nama pengajuan<input className="admin-input" value={value.name} onChange={(event) => { const name = event.target.value; onChange((prev) => ({ ...prev, name, ...(autoCode ? { code: normalizeCode(name) } : {}) })); }} placeholder="Contoh: Izin Renovasi Rumah" /></label>
        <label>Kode sistem<input className="admin-input" value={value.code} onChange={(event) => { setAutoCode(false); set("code", normalizeCode(event.target.value)); }} placeholder="IZIN_RENOVASI_RUMAH" /><small className="mm-help"><button type="button" onClick={() => { setAutoCode(true); set("code", normalizeCode(value.name)); }}>Buat otomatis</button></small></label>
        <label>Kategori<input className="admin-input" value={value.category} onChange={(event) => set("category", event.target.value)} placeholder="Perizinan" /></label>
        <label>Ikon<select className="admin-input" value={value.icon} onChange={(event) => set("icon", event.target.value)}>{ICON_OPTIONS.map((icon) => <option key={icon} value={icon}>{icon}</option>)}</select></label>
        <label>Warna<input className="admin-input mm-color-input" type="color" value={value.color || "#2563eb"} onChange={(event) => set("color", event.target.value)} /></label>
      </div>
      <label>Deskripsi<textarea className="admin-input" rows={3} value={value.description} onChange={(event) => set("description", event.target.value)} placeholder="Jelaskan kegunaan dan persyaratan singkat pengajuan." /></label>
    </div>
  );
}

function PaymentSettings({ value, onChange }) {
  const set = (key, nextValue) => onChange((prev) => ({ ...prev, [key]: nextValue }));
  const hasPaymentValidation = value.flow_schema?.[0]?.action === "validate_payment";
  const [validatorRole, setValidatorRole] = useState("bendahara");
  function addValidation() {
    onChange((prev) => ({ ...prev, payment_required: true, flow_schema: renumberFlow([{ role: validatorRole, label: `Validasi Pembayaran oleh ${roleLabel(validatorRole)}`, action: "validate_payment" }, ...prev.flow_schema.filter((step) => step.action !== "validate_payment")]) }));
  }
  return (
    <div className="mm-panel-grid">
      <div className="mm-section-head"><div><div className="mm-section-kicker">Pembayaran</div><h3>Aturan Pembayaran</h3><p>Hubungkan pembayaran dengan tahap validasi tanpa mengatur JSON.</p></div></div>
      <label className="mm-switch"><input type="checkbox" checked={value.payment_required} onChange={(event) => set("payment_required", event.target.checked)} /><span>Pengajuan memerlukan pembayaran</span></label>
      {value.payment_required ? <>
        <div className="mm-grid-2"><label>Nominal pembayaran<input className="admin-input" type="number" min="0" value={value.payment_amount} onChange={(event) => set("payment_amount", event.target.value)} /></label><label>Validator pembayaran<select className="admin-input" value={validatorRole} onChange={(event) => setValidatorRole(event.target.value)}>{ADMIN_ACCESS_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label></div>
        <label>Instruksi pembayaran<textarea className="admin-input" rows={3} value={value.payment_instruction} onChange={(event) => set("payment_instruction", event.target.value)} placeholder="Transfer ke rekening kas warga dan tunggu validasi." /></label>
        {!hasPaymentValidation ? <div className="mm-warning"><div><strong>Tahap validasi pembayaran belum ada</strong><p>Sistem menyarankan tahap ini berada paling awal.</p></div><button type="button" className="admin-small-btn" onClick={addValidation}>Tambahkan Otomatis</button></div> : <div className="mm-success-note">✓ Tahap pertama sudah memvalidasi pembayaran.</div>}
      </> : <div className="mm-direct-info">Pengajuan akan ditampilkan sebagai tanpa biaya.</div>}
    </div>
  );
}

function AdvancedEditor({ value, editable, setEditable, fieldsText, setFieldsText, flowText, setFlowText, onApply, error }) {
  return (
    <details className="mm-advanced">
      <summary>Pengaturan Lanjutan · JSON</summary>
      <div className="mm-warning"><div><strong>Gunakan hanya untuk kebutuhan teknis</strong><p>Builder visual tetap menjadi cara utama. JSON dapat merusak konfigurasi bila formatnya salah.</p></div><button type="button" className="admin-small-btn" onClick={() => setEditable((prev) => !prev)}>{editable ? "Kunci JSON" : "Aktifkan Edit JSON"}</button></div>
      <label>Fields Schema<textarea className="admin-input mm-json" rows={10} readOnly={!editable} value={editable ? fieldsText : JSON.stringify(value.fields_schema || [], null, 2)} onChange={(event) => setFieldsText(event.target.value)} /></label>
      <label>Flow Schema<textarea className="admin-input mm-json" rows={10} readOnly={!editable} value={editable ? flowText : JSON.stringify(value.flow_schema || [], null, 2)} onChange={(event) => setFlowText(event.target.value)} /></label>
      {error ? <div className="mm-error-note">{error}</div> : null}
      {editable ? <button type="button" className="admin-small-btn" onClick={onApply}>Terapkan JSON ke Builder</button> : null}
    </details>
  );
}

function VersionHistory({ value, onRestore }) {
  const versions = value.version_history || [];
  if (!versions.length) return <div className="mm-direct-info">Belum ada versi yang pernah dipublikasikan.</div>;
  return (
    <details className="mm-history">
      <summary>Riwayat versi · {versions.length} versi</summary>
      <div className="mm-history-list">
        {versions.map((version) => (
          <div className="mm-history-item" key={`${version.revision}-${version.published_at}`}>
            <div><strong>Versi {version.revision}</strong><small>{formatDate(version.published_at || version.updated_at)} · {version.name}</small></div>
            <button type="button" className="admin-small-btn" onClick={() => onRestore(version)}>Pulihkan sebagai Draft</button>
          </div>
        ))}
      </div>
    </details>
  );
}

export default function MasterManagementTab() {
  const [data, setData] = useState({ masters: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      showToast(err.message || "Gagal memuat approval master", "error");
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
    copy.name = `${copy.name} (Salinan)`;
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
    showToast(`Versi ${version.revision} dipulihkan ke editor sebagai draft`);
  }

  function applyAdvancedJson() {
    try {
      const nextFields = JSON.parse(fieldsText || "[]");
      const nextFlow = JSON.parse(flowText || "[]");
      if (!Array.isArray(nextFields) || !Array.isArray(nextFlow)) throw new Error("Fields dan flow harus berupa array JSON");
      setEditor((prev) => ({ ...prev, fields_schema: nextFields, flow_schema: renumberFlow(nextFlow) }));
      setAdvancedError("");
      setAdvancedEditable(false);
      showToast("JSON diterapkan ke visual builder");
    } catch (err) {
      setAdvancedError(err.message || "Format JSON tidak valid");
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
      setSaving(true);
      await sendJson(APPROVAL_MASTERS_API, "POST", next);
      showToast(nextLifecycle === "active" ? "Versi baru berhasil dipublikasikan" : nextLifecycle === "archived" ? "Master berhasil diarsipkan" : editor.published_revision ? "Draft tersimpan. Versi aktif tetap berjalan." : "Draft berhasil disimpan");
      setEditor(null);
      await loadData();
    } catch (err) {
      showToast(err.message || "Gagal menyimpan approval master", "error");
    } finally {
      setSaving(false);
    }
  }

  async function executePendingAction() {
    if (!pendingAction) return;
    const { type, master } = pendingAction;
    try {
      setSaving(true);
      if (type === "discard") {
        await sendJson(APPROVAL_MASTERS_API, "POST", { id: master.id, operation: "discard_draft" });
        showToast("Draft dibuang. Versi aktif tidak berubah.");
      } else {
        await sendJson(APPROVAL_MASTERS_API, "POST", { ...masterToForm(master), lifecycle_status: "archived", active: false });
        showToast("Master berhasil diarsipkan");
      }
      setPendingAction(null);
      await loadData();
    } catch (err) {
      showToast(err.message || "Gagal memproses master", "error");
    } finally {
      setSaving(false);
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
      <AdminConfirmModal open={!!pendingAction} title={pendingIsDiscard ? "Buang Draft Perubahan" : "Arsipkan Approval Master"} description={pendingAction ? (pendingIsDiscard ? `Draft ${pendingAction.master.name} akan dihapus, tetapi versi aktif tetap berjalan.` : `${pendingAction.master.name} tidak akan tampil pada halaman pengajuan warga.`) : ""} confirmText={pendingIsDiscard ? "Buang Draft" : "Arsipkan"} cancelText="Batal" loading={saving} loadingText="Memproses..." onCancel={() => !saving && setPendingAction(null)} onConfirm={executePendingAction} />
      <div className="admin-card mm-root">
        {!editor ? (
          <>
            <div className="mm-list-head"><div><div className="activity-kicker">No-code Configuration</div><h3 className="activity-title">Master Management</h3><p className="activity-subtitle">Buat form, lampiran, alur approval, dan versi konfigurasi tanpa mengetik JSON.</p></div><button type="button" className="admin-btn" onClick={createMaster}>+ Buat Pengajuan</button></div>
            <input className="admin-search-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, kode, kategori, status, atau role..." />
            <div className="mm-master-list">
              {filteredMasters.map((master) => {
                const status = lifecycleMeta(master.lifecycle_status);
                return (
                  <article className="mm-master-card" key={master.id}>
                    <div className="mm-master-main"><span className="mm-master-icon" style={{ background: master.color || "#2563eb" }}>{master.icon || "📄"}</span><div><div className="mm-master-title-row"><h4>{master.name}</h4><span className={`mm-status ${status.className}`}>{status.label}</span>{master.has_draft ? <span className="mm-status mm-status-draft">Ada Draft v{master.draft_revision}</span> : null}</div><p>{master.category || "Umum"} · {(master.fields_schema || []).length} field · {(master.flow_schema || []).length} tahap · Versi aktif {master.published_revision || "-"}</p><small>{(master.flow_schema || []).map((step) => roleLabel(step.role)).join(" → ") || "Tanpa approval"}</small></div></div>
                    <div className="mm-master-payment">{master.payment_required ? money(master.payment_amount) : "Gratis"}</div>
                    <div className="mm-master-actions"><button type="button" className="admin-small-btn" onClick={() => editMaster(master)}>Edit{master.has_draft ? " Draft" : ""}</button><button type="button" className="admin-small-btn" onClick={() => duplicateMaster(master)}>Duplikat</button><button type="button" className="admin-small-btn" onClick={() => editMaster(master, 4)}>Preview</button>{master.has_draft && master.published_revision ? <button type="button" className="admin-small-btn mm-warning-btn" onClick={() => setPendingAction({ type: "discard", master })}>Buang Draft</button> : null}{master.lifecycle_status !== "archived" ? <button type="button" className="admin-small-btn mm-danger-btn" onClick={() => setPendingAction({ type: "archive", master })}>Arsipkan</button> : null}</div>
                  </article>
                );
              })}
              {!filteredMasters.length ? <div className="admin-empty-state">Approval master tidak ditemukan.</div> : null}
            </div>
          </>
        ) : (
          <div className="mm-editor">
            <div className="mm-editor-head"><div><div className="activity-kicker">{editorMode === "create" ? "Master Baru" : editorMode === "duplicate" ? "Duplikasi Master" : editor.has_draft ? "Edit Draft" : "Edit Master"}</div><h3 className="activity-title">{editor.name || "Pengajuan Baru"}</h3><p className="activity-subtitle">{editor.published_revision ? `Versi aktif ${editor.published_revision}${editor.has_draft ? ` · Draft ${editor.draft_revision}` : ""}. Menyimpan draft tidak mengganggu warga.` : "Belum pernah dipublikasikan."}</p></div><button type="button" className="admin-small-btn" onClick={() => !saving && setEditor(null)}>Tutup</button></div>
            <div className="mm-wizard">{WIZARD_STEPS.map((step, index) => <button type="button" key={step} className={wizardStep === index ? "is-active" : errors.some((error) => error.step === index) ? "has-error" : ""} onClick={() => setWizardStep(index)}><span>{index + 1}</span>{step}</button>)}</div>
            <div className="mm-editor-body">
              {wizardStep === 0 ? <BasicInformation value={editor} onChange={setEditor} autoCode={autoCode} setAutoCode={setAutoCode} /> : null}
              {wizardStep === 1 ? <FieldBuilder value={editor} onChange={setEditor} /> : null}
              {wizardStep === 2 ? <FlowBuilder value={editor} onChange={setEditor} /> : null}
              {wizardStep === 3 ? <PaymentSettings value={editor} onChange={setEditor} /> : null}
              {wizardStep === 4 ? <><div className="mm-section-head"><div><div className="mm-section-kicker">Preview Langsung</div><h3>Tampilan Warga dan Alur</h3><p>Preview memperlihatkan field biasa, pilihan, lampiran, dan tahapan sebelum dipublikasikan.</p></div></div><MasterPreview value={editor} /></> : null}
              {wizardStep === 5 ? <div className="mm-panel-grid"><div className="mm-section-head"><div><div className="mm-section-kicker">Validasi dan Publikasi</div><h3>Siap Dipublikasikan?</h3><p>Publish membuat revisi baru. Versi aktif sebelumnya otomatis masuk histori dan tetap dapat dipulihkan.</p></div></div><div className="mm-version-summary"><div><span>Versi Aktif</span><strong>{editor.published_revision || "Belum ada"}</strong></div><div><span>Draft</span><strong>{editor.has_draft ? editor.draft_revision : "Belum disimpan"}</strong></div><div><span>Versi Berikutnya</span><strong>{Math.max(editor.published_revision || 0, editor.draft_revision || 0) + 1}</strong></div></div><div className="mm-checklist">{errors.length ? errors.map((error, index) => <button type="button" key={`${error.step}-${index}`} className="mm-check-error" onClick={() => setWizardStep(error.step)}>× {error.message}</button>) : <div className="mm-check-success">✓ Seluruh konfigurasi valid dan siap dipublikasikan.</div>}</div><div className="mm-publication-actions"><button type="button" className="admin-small-btn" disabled={saving} onClick={() => persist("draft")}><LoadingButtonContent loading={saving} loadingText="Menyimpan...">Simpan Draft</LoadingButtonContent></button><button type="button" className="admin-btn" disabled={saving || errors.length > 0} onClick={() => persist("active")}><LoadingButtonContent loading={saving} loadingText="Mempublikasikan...">Publikasikan Versi Baru</LoadingButtonContent></button>{editor.id ? <button type="button" className="admin-small-btn mm-danger-btn" disabled={saving} onClick={() => persist("archived")}>Arsipkan</button> : null}</div><VersionHistory value={editor} onRestore={restoreVersion} /><AdvancedEditor value={editor} editable={advancedEditable} setEditable={setAdvancedEditable} fieldsText={fieldsText} setFieldsText={setFieldsText} flowText={flowText} setFlowText={setFlowText} onApply={applyAdvancedJson} error={advancedError} /></div> : null}
            </div>
            <div className="mm-footer"><button type="button" className="admin-small-btn" disabled={wizardStep === 0 || saving} onClick={() => setWizardStep((prev) => Math.max(0, prev - 1))}>Kembali</button><div><button type="button" className="admin-small-btn" disabled={saving} onClick={() => persist("draft")}>Simpan Draft</button>{wizardStep < WIZARD_STEPS.length - 1 ? <button type="button" className="admin-btn" disabled={saving} onClick={() => setWizardStep((prev) => Math.min(WIZARD_STEPS.length - 1, prev + 1))}>Lanjut</button> : null}</div></div>
          </div>
        )}
      </div>
    </>
  );
}

const CSS = `
.mm-root{height:auto!important;overflow:visible!important}.mm-list-head,.mm-editor-head,.mm-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:16px}.mm-list-head .admin-btn{flex:0 0 auto}.mm-master-list{display:grid;gap:12px;margin-top:14px}.mm-master-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:14px;border:1px solid var(--admin-border);border-radius:16px;background:var(--admin-card)}.mm-master-main{display:grid;grid-template-columns:46px minmax(0,1fr);gap:12px;align-items:start}.mm-master-icon{display:grid;place-items:center;width:46px;height:46px;border-radius:14px;color:#fff;font-size:22px}.mm-master-title-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.mm-master-title-row h4{margin:0;font-size:16px}.mm-master-main p{margin:4px 0;color:var(--admin-muted);font-size:13px;font-weight:700}.mm-master-main small{color:var(--admin-muted);font-size:12px;font-weight:700}.mm-master-payment{align-self:start;font-size:13px;font-weight:900}.mm-master-actions{grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap}.mm-master-actions .admin-small-btn{flex:1 1 110px}.mm-status{display:inline-flex;padding:4px 8px;border-radius:999px;font-size:10px;font-weight:900;text-transform:uppercase}.mm-status-active{background:#dcfce7;color:#166534}.mm-status-draft{background:#fef3c7;color:#92400e}.mm-status-archived{background:var(--admin-row);color:var(--admin-muted)}.mm-danger-btn{background:#fee2e2!important;color:#991b1b!important;border-color:#fca5a5!important}.mm-warning-btn{background:#fffbeb!important;color:#92400e!important;border-color:#fcd34d!important}.mm-editor{display:grid;gap:14px}.mm-wizard{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px}.mm-wizard button{min-height:48px;padding:7px;border:1px solid var(--admin-border);border-radius:12px;background:var(--admin-row);color:var(--admin-muted);font:inherit;font-size:11px;font-weight:900;cursor:pointer}.mm-wizard button span{display:block;margin-bottom:2px}.mm-wizard button.is-active{border-color:var(--admin-primary);background:color-mix(in srgb,var(--admin-primary) 12%,var(--admin-card));color:var(--admin-text)}.mm-wizard button.has-error{border-color:#fca5a5;color:#991b1b}.mm-editor-body{padding:16px;border:1px solid var(--admin-border);border-radius:16px;background:var(--admin-row)}.mm-panel-grid,.mm-builder{display:grid;gap:14px}.mm-section-head{margin-bottom:0}.mm-section-head h3{margin:2px 0 4px}.mm-section-head p,.mm-muted{margin:0;color:var(--admin-muted);font-size:13px;line-height:1.45}.mm-section-kicker{color:var(--admin-primary);font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.mm-grid-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.mm-panel-grid label,.mm-builder-card label,.mm-advanced label{display:grid;gap:6px;color:var(--admin-muted);font-size:12px;font-weight:900}.mm-color-input{padding:4px!important}.mm-help{display:block}.mm-help button{padding:0;border:0;background:transparent;color:var(--admin-primary);font-size:11px;font-weight:900;cursor:pointer}.mm-inline-help{color:var(--admin-muted);font-size:10px;font-weight:700}.mm-builder-list{display:grid;gap:10px}.mm-builder-card{display:grid;gap:12px;padding:13px;border:1px solid var(--admin-border);border-radius:14px;background:var(--admin-card)}.mm-builder-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.mm-builder-card-head span{display:block;color:var(--admin-muted);font-size:10px;font-weight:900;text-transform:uppercase}.mm-builder-card-head strong{display:block;margin-top:2px;font-size:14px}.mm-card-actions{display:flex;gap:5px}.mm-card-actions button{display:grid;place-items:center;width:32px;height:32px;border:1px solid var(--admin-border);border-radius:9px;background:var(--admin-row);color:var(--admin-text);font-weight:900;cursor:pointer}.mm-card-actions button:disabled{opacity:.35;cursor:not-allowed}.mm-toggle-row{display:flex;gap:18px;flex-wrap:wrap}.mm-check{display:flex!important;grid-template-columns:auto 1fr!important;align-items:center;gap:7px!important}.mm-check input{width:auto!important;margin:0!important}.mm-template-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}.mm-template{display:grid;gap:4px;padding:11px;border:1px solid var(--admin-border);border-radius:12px;background:var(--admin-card);color:var(--admin-text);text-align:left;cursor:pointer}.mm-template:hover{border-color:var(--admin-primary)}.mm-template small{color:var(--admin-muted);line-height:1.35}.mm-direct-info,.mm-success-note,.mm-error-note{padding:11px 12px;border:1px solid var(--admin-border);border-radius:12px;background:var(--admin-card);color:var(--admin-muted);font-size:12px;font-weight:800}.mm-success-note{border-color:#86efac;background:#f0fdf4;color:#166534}.mm-error-note{border-color:#fca5a5;background:#fef2f2;color:#991b1b}.mm-switch{display:flex!important;grid-template-columns:auto 1fr!important;align-items:center;gap:9px!important;padding:12px;border:1px solid var(--admin-border);border-radius:12px;background:var(--admin-card);color:var(--admin-text)!important}.mm-switch input{width:auto!important;margin:0!important}.mm-warning{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border:1px solid #fcd34d;border-radius:12px;background:#fffbeb;color:#92400e}.mm-warning p{margin:3px 0 0;font-size:12px}.mm-preview-layout{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(260px,.7fr);gap:12px}.mm-preview-card{position:relative;display:grid;gap:12px;padding:14px;border:1px solid var(--admin-border);border-radius:16px;background:var(--admin-card)}.mm-preview-title{display:flex;align-items:center;gap:10px}.mm-preview-title>span{display:grid;place-items:center;width:44px;height:44px;border-radius:13px;color:#fff;font-size:21px}.mm-preview-title small{color:var(--admin-muted);font-size:10px;font-weight:900;text-transform:uppercase}.mm-preview-title h3{margin:2px 0 0}.mm-payment-preview,.mm-free-preview{display:grid;justify-self:start;padding:8px 10px;border:1px solid var(--admin-border);border-radius:10px;background:var(--admin-row)}.mm-payment-preview small{color:var(--admin-muted);font-size:10px;font-weight:900}.mm-payment-preview strong{color:#15803d}.mm-free-preview{color:var(--admin-muted);font-size:12px;font-weight:900}.mm-preview-form{display:grid;gap:11px}.mm-preview-form label{display:grid;gap:6px;color:var(--admin-muted);font-size:12px}.mm-preview-options{display:flex;gap:12px;flex-wrap:wrap}.mm-file-preview{display:flex;align-items:center;gap:10px;min-height:48px;padding:9px 11px;border:1px dashed var(--admin-border);border-radius:10px;background:var(--admin-row)}.mm-file-preview>span{font-size:22px}.mm-file-preview strong,.mm-file-preview small{display:block}.mm-file-preview small{margin-top:2px;color:var(--admin-muted)}.mm-flow-preview{display:grid;gap:0}.mm-flow-node{position:relative;display:grid;grid-template-columns:32px minmax(0,1fr);gap:9px;min-height:60px}.mm-flow-node>span{z-index:1;display:grid;place-items:center;width:28px;height:28px;border-radius:999px;background:var(--admin-primary);color:#fff;font-size:11px;font-weight:900}.mm-flow-node:not(:last-child)::after{content:"";position:absolute;left:13px;top:28px;bottom:0;width:2px;background:var(--admin-border)}.mm-flow-node strong,.mm-flow-node small{display:block}.mm-flow-node small{margin-top:3px;color:var(--admin-muted);font-size:11px}.mm-version-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.mm-version-summary>div{display:grid;gap:3px;padding:11px;border:1px solid var(--admin-border);border-radius:12px;background:var(--admin-card)}.mm-version-summary span{color:var(--admin-muted);font-size:10px;font-weight:900;text-transform:uppercase}.mm-version-summary strong{font-size:16px}.mm-checklist{display:grid;gap:7px}.mm-check-error{padding:10px 12px;border:1px solid #fca5a5;border-radius:10px;background:#fef2f2;color:#991b1b;text-align:left;font-weight:800;cursor:pointer}.mm-check-success{padding:12px;border:1px solid #86efac;border-radius:12px;background:#f0fdf4;color:#166534;font-weight:900}.mm-publication-actions,.mm-footer,.mm-footer>div{display:flex;gap:9px;flex-wrap:wrap}.mm-publication-actions>*{flex:1 1 150px}.mm-advanced,.mm-history{display:grid;gap:12px;padding:12px;border:1px solid var(--admin-border);border-radius:12px;background:var(--admin-card)}.mm-advanced summary,.mm-history summary{cursor:pointer;font-weight:900}.mm-advanced[open],.mm-history[open]{display:grid}.mm-history-list{display:grid;gap:8px;margin-top:10px}.mm-history-item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px;border:1px solid var(--admin-border);border-radius:10px;background:var(--admin-row)}.mm-history-item strong,.mm-history-item small{display:block}.mm-history-item small{margin-top:3px;color:var(--admin-muted);font-size:10px}.mm-json{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace!important;font-size:11px!important;line-height:1.45!important}.mm-footer{align-items:center;justify-content:space-between;padding-top:4px}.mm-footer .admin-btn,.mm-footer .admin-small-btn{min-width:120px}
@media(max-width:760px){.mm-list-head,.mm-editor-head,.mm-section-head{align-items:stretch;flex-direction:column}.mm-list-head .admin-btn{width:100%}.mm-wizard{grid-template-columns:repeat(3,minmax(0,1fr))}.mm-grid-2,.mm-preview-layout{grid-template-columns:1fr}.mm-master-card{grid-template-columns:1fr}.mm-master-payment{grid-row:auto}.mm-warning{align-items:stretch;flex-direction:column}.mm-footer{align-items:stretch;flex-direction:column-reverse}.mm-footer>div{display:grid;grid-template-columns:1fr 1fr}.mm-footer>button{width:100%}.mm-version-summary{grid-template-columns:1fr}.mm-history-item{align-items:stretch;flex-direction:column}.mm-history-item button{width:100%}}
`;
