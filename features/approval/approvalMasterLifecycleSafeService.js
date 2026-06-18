import { dbTable } from "@/lib/dbTable";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { recordAdminActivity } from "@/lib/adminActivity";

const MASTERS = dbTable("approval_masters");
const MAX_HISTORY = 10;
const clean = (value) => String(value || "").trim();
const now = () => new Date().toISOString();
const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

function conflict() {
  const error = new Error("Approval master telah berubah di tab atau perangkat lain. Muat ulang data lalu coba kembali.");
  error.status = 409;
  return error;
}

function parse(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string" || !clean(value)) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeFlow(value = []) {
  return (Array.isArray(value) ? value : []).map((step, index) => ({
    ...step,
    step: index + 1,
    role: clean(step?.role).toLowerCase(),
    label: clean(step?.label) || `Approval Step ${index + 1}`,
    action: clean(step?.action).toLowerCase() || "approve",
  })).filter((step) => step.role);
}

function normalizeFields(value = []) {
  return (Array.isArray(value) ? value : []).map((field) => ({
    ...field,
    key: clean(field?.key).toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60),
    label: clean(field?.label),
    type: clean(field?.type).toLowerCase() || "text",
    required: Boolean(field?.required),
    placeholder: clean(field?.placeholder),
    show_summary: field?.show_summary !== false,
  })).filter((field) => field.key && field.label);
}

function fallbackConfig(row = {}) {
  const parsed = parse(row.fields_schema);
  const legacyFields = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.fields) ? parsed.fields : [];
  return {
    code: clean(row.code),
    name: clean(row.name),
    category: clean(row.category) || "General",
    description: clean(row.description),
    icon: clean(parsed?.meta?.icon) || "📄",
    color: clean(parsed?.meta?.color) || "#2563eb",
    payment_required: Boolean(row.payment_required),
    payment_amount: number(row.payment_amount),
    payment_instruction: clean(row.payment_instruction),
    fields_schema: normalizeFields(legacyFields),
    flow_schema: normalizeFlow(row.flow_schema),
    revision: 1,
    updated_at: clean(row.updated_at || row.created_at) || now(),
    published_at: row.active ? clean(row.updated_at || row.created_at) || now() : "",
  };
}

function normalizeConfig(value = {}, fallback = {}) {
  const merged = { ...fallback, ...(value && typeof value === "object" ? value : {}) };
  return {
    code: clean(merged.code || merged.name).toUpperCase().replace(/[^A-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40),
    name: clean(merged.name),
    category: clean(merged.category) || "General",
    description: clean(merged.description),
    icon: clean(merged.icon) || "📄",
    color: clean(merged.color) || "#2563eb",
    payment_required: Boolean(merged.payment_required),
    payment_amount: number(merged.payment_amount),
    payment_instruction: clean(merged.payment_instruction),
    fields_schema: normalizeFields(merged.fields_schema || fallback.fields_schema || []),
    flow_schema: normalizeFlow(merged.flow_schema || fallback.flow_schema || []),
    revision: Math.max(1, Math.floor(number(merged.revision) || number(fallback.revision) || 1)),
    updated_at: clean(merged.updated_at) || now(),
    published_at: clean(merged.published_at),
  };
}

function envelopeFrom(row = {}) {
  const parsed = parse(row.fields_schema);
  const fallback = fallbackConfig(row);
  if (parsed?.schema_version === 2) {
    const published = parsed.published ? normalizeConfig(parsed.published, fallback) : null;
    const draft = parsed.draft ? normalizeConfig(parsed.draft, published || fallback) : null;
    const history = Array.isArray(parsed.history)
      ? parsed.history.map((item) => normalizeConfig(item, published || draft || fallback)).slice(-MAX_HISTORY)
      : [];
    const lifecycle = clean(parsed.meta?.lifecycle_status).toLowerCase() || (row.active ? "active" : published ? "archived" : "draft");
    return { lifecycle, published, draft, history };
  }
  return row.active
    ? { lifecycle: "active", published: fallback, draft: null, history: [] }
    : { lifecycle: "draft", published: null, draft: fallback, history: [] };
}

function incomingConfig(payload = {}, fallback = {}) {
  return normalizeConfig({
    ...fallback,
    code: payload.code || payload.name || fallback.code,
    name: payload.name ?? fallback.name,
    category: payload.category ?? fallback.category,
    description: payload.description ?? fallback.description,
    icon: payload.icon ?? fallback.icon,
    color: payload.color ?? fallback.color,
    payment_required: payload.payment_required ?? fallback.payment_required,
    payment_amount: payload.payment_amount ?? fallback.payment_amount,
    payment_instruction: payload.payment_instruction ?? fallback.payment_instruction,
    fields_schema: Array.isArray(payload.fields_schema) ? payload.fields_schema : fallback.fields_schema,
    flow_schema: Array.isArray(payload.flow_schema) ? payload.flow_schema : fallback.flow_schema,
    updated_at: now(),
  }, fallback);
}

function validate(config) {
  if (!config.code) throw new Error("Kode approval wajib diisi");
  if (!config.name) throw new Error("Nama approval wajib diisi");
  if (!config.fields_schema.length) throw new Error("Master aktif minimal memiliki satu field pengajuan");
  if (new Set(config.fields_schema.map((field) => field.key)).size !== config.fields_schema.length) throw new Error("Nama sistem field tidak boleh duplikat");
  const empty = config.fields_schema.find((field) => ["select", "radio"].includes(field.type) && !(field.options || []).length);
  if (empty) throw new Error(`Pilihan untuk field ${empty.label} belum diisi`);
  if (config.payment_required && config.payment_amount <= 0) throw new Error("Nominal pembayaran wajib lebih dari 0");
  if (config.payment_required && !config.flow_schema.some((step) => step.action === "validate_payment")) throw new Error("Master berbayar wajib memiliki tahap validasi pembayaran");
}

function pack({ lifecycle, published, draft, history }) {
  const effective = draft || published || normalizeConfig({});
  return {
    schema_version: 2,
    meta: {
      lifecycle_status: lifecycle,
      published_revision: published?.revision || 0,
      draft_revision: draft?.revision || 0,
      published_at: published?.published_at || "",
      updated_at: now(),
    },
    fields: effective.fields_schema,
    published: published || null,
    draft: draft || null,
    history: (history || []).slice(-MAX_HISTORY),
  };
}

function rowPayload(config, active, fieldsEnvelope) {
  return {
    code: config.code,
    name: config.name,
    category: config.category,
    description: config.description,
    active,
    payment_required: config.payment_required,
    payment_amount: config.payment_amount,
    payment_instruction: config.payment_instruction,
    fields_schema: fieldsEnvelope,
    flow_schema: config.flow_schema,
    updated_at: now(),
  };
}

async function readMaster(supabase, id) {
  const { data, error } = await supabase.from(MASTERS).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message || "Gagal membaca approval master");
  if (!data) throw new Error("Approval master tidak ditemukan");
  return data;
}

async function updateLocked(supabase, row, payload) {
  let query = supabase.from(MASTERS).update(payload).eq("id", row.id);
  query = row.updated_at == null ? query.is("updated_at", null) : query.eq("updated_at", row.updated_at);
  const { data, error } = await query.select("*").maybeSingle();
  if (error) throw new Error(error.message || "Gagal memperbarui approval master");
  if (!data) throw conflict();
  return data;
}

async function record(req, message, metadata, severity = "success") {
  await recordAdminActivity(req, { type: "update", module: "master-management", severity, message, metadata });
}

export async function saveLifecycleDraft({ req, payload = {} }) {
  const supabase = getSupabaseAdmin();
  const row = await readMaster(supabase, clean(payload.id));
  const current = envelopeFrom(row);
  const fallback = current.draft || current.published || fallbackConfig(row);
  const revision = current.draft?.revision || (current.published?.revision || 0) + 1 || 1;
  const draft = { ...incomingConfig(payload, fallback), revision, updated_at: now(), published_at: "" };
  if (!draft.code || !draft.name) throw new Error("Nama dan kode approval wajib diisi");
  const lifecycle = current.published ? (current.lifecycle === "archived" || !row.active ? "archived" : "active") : "draft";
  const fieldsEnvelope = pack({ lifecycle, published: clone(current.published), draft, history: clone(current.history) });
  const effective = lifecycle === "active" && current.published ? current.published : draft;
  const updated = await updateLocked(supabase, row, rowPayload(effective, lifecycle === "active", fieldsEnvelope));
  await record(req, `Save draft approval master ${draft.code} sebagai draft versi ${revision}`, { id: row.id, code: draft.code, lifecycle_status: lifecycle, published_revision: current.published?.revision || 0, draft_revision: revision });
  return { ok: true, master: updated, lifecycle_status: lifecycle, draft_revision: revision };
}

export async function publishLifecycleMaster({ req, payload = {} }) {
  const supabase = getSupabaseAdmin();
  const row = await readMaster(supabase, clean(payload.id));
  const current = envelopeFrom(row);
  const fallback = current.draft || current.published || fallbackConfig(row);
  const incoming = incomingConfig(payload, fallback);
  validate(incoming);
  const revision = current.draft?.revision || (current.published?.revision || 0) + 1 || 1;
  const published = { ...incoming, revision, updated_at: now(), published_at: now() };
  const history = current.published ? [...current.history, clone(current.published)].slice(-MAX_HISTORY) : clone(current.history);
  const fieldsEnvelope = pack({ lifecycle: "active", published, draft: null, history });
  const updated = await updateLocked(supabase, row, rowPayload(published, true, fieldsEnvelope));
  await record(req, `Publish approval master ${published.code} sebagai versi ${revision}`, { id: row.id, code: published.code, lifecycle_status: "active", published_revision: revision, draft_revision: 0 });
  return { ok: true, master: updated, lifecycle_status: "active", published_revision: revision };
}

export async function archiveLifecycleMaster({ req, payload = {} }) {
  const supabase = getSupabaseAdmin();
  const row = await readMaster(supabase, clean(payload.id));
  const current = envelopeFrom(row);
  if (!current.published) throw new Error("Draft yang belum pernah dipublikasikan tidak dapat diarsipkan");
  const published = clone(current.published);
  const draft = clone(current.draft);
  const fieldsEnvelope = pack({ lifecycle: "archived", published, draft, history: clone(current.history) });
  const updated = await updateLocked(supabase, row, rowPayload(draft || published, false, fieldsEnvelope));
  await record(req, `Archive approval master ${(draft || published).code}`, { id: row.id, code: (draft || published).code, lifecycle_status: "archived", published_revision: published.revision, draft_revision: draft?.revision || 0, draft_preserved: Boolean(draft) }, "warning");
  return { ok: true, master: updated, lifecycle_status: "archived", draft_preserved: Boolean(draft) };
}

export async function reactivateLifecycleMaster({ req, payload = {} }) {
  const supabase = getSupabaseAdmin();
  const row = await readMaster(supabase, clean(payload.id));
  const current = envelopeFrom(row);
  if (current.lifecycle !== "archived" || !current.published) throw new Error("Hanya approval master Archived yang dapat diaktifkan kembali");
  const published = clone(current.published);
  const draft = clone(current.draft);
  const fieldsEnvelope = pack({ lifecycle: "active", published, draft, history: clone(current.history) });
  const updated = await updateLocked(supabase, row, rowPayload(published, true, fieldsEnvelope));
  await record(req, `Reactivate approval master ${published.code} menggunakan versi ${published.revision}`, { id: row.id, code: published.code, lifecycle_status: "active", published_revision: published.revision, draft_revision: draft?.revision || 0, revision_changed: false });
  return { ok: true, master: updated, lifecycle_status: "active", published_revision: published.revision, message: `Versi ${published.revision} berhasil diaktifkan kembali tanpa membuat versi baru.` };
}

export async function discardLifecycleDraft({ req, payload = {} }) {
  const supabase = getSupabaseAdmin();
  const row = await readMaster(supabase, clean(payload.id));
  const current = envelopeFrom(row);
  if (!current.draft) throw new Error("Draft tidak ditemukan");
  if (!current.published) throw new Error("Draft pertama harus dihapus menggunakan Delete Draft");
  const lifecycle = current.lifecycle === "archived" || !row.active ? "archived" : "active";
  const published = clone(current.published);
  const fieldsEnvelope = pack({ lifecycle, published, draft: null, history: clone(current.history) });
  const updated = await updateLocked(supabase, row, rowPayload(published, lifecycle === "active", fieldsEnvelope));
  await record(req, `Discard draft approval master ${published.code}; kembali ke ${lifecycle}`, { id: row.id, code: published.code, lifecycle_status: lifecycle, published_revision: published.revision, draft_revision: 0 }, "warning");
  return { ok: true, master: updated, lifecycle_status: lifecycle };
}

export async function deleteInitialDraft({ req, payload = {} }) {
  const supabase = getSupabaseAdmin();
  const row = await readMaster(supabase, clean(payload.id));
  const current = envelopeFrom(row);
  if (current.published || row.active || current.lifecycle !== "draft") throw new Error("Hanya draft yang belum pernah dipublikasikan yang dapat dihapus");
  let query = supabase.from(MASTERS).delete().eq("id", row.id);
  query = row.updated_at == null ? query.is("updated_at", null) : query.eq("updated_at", row.updated_at);
  const { data, error } = await query.select("id").maybeSingle();
  if (error) throw new Error(error.message || "Gagal menghapus draft approval master");
  if (!data) throw conflict();
  const draft = current.draft || fallbackConfig(row);
  await recordAdminActivity(req, { type: "delete", module: "master-management", severity: "warning", message: `Delete initial draft approval master ${draft.code}`, metadata: { id: row.id, code: draft.code, lifecycle_status: "draft" } });
  return { ok: true, deleted: true, id: row.id };
}
