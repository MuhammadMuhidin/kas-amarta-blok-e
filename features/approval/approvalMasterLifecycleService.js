import { dbTable } from "@/lib/dbTable";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { recordAdminActivity } from "@/lib/adminActivity";

const MASTERS = dbTable("approval_masters");
const MAX_HISTORY = 10;

const clean = (value) => String(value || "").trim();
const now = () => new Date().toISOString();
const clone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));
const number = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

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
    key: clean(field?.key).toLowerCase(),
    label: clean(field?.label),
    type: clean(field?.type).toLowerCase() || "text",
    required: Boolean(field?.required),
    placeholder: clean(field?.placeholder),
    show_summary: field?.show_summary !== false,
  })).filter((field) => field.key && field.label);
}

function rowFallback(row = {}) {
  const parsed = parse(row.fields_schema);
  const legacyFields = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.fields)
      ? parsed.fields
      : [];

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

function readEnvelope(row = {}) {
  const parsed = parse(row.fields_schema);
  const fallback = rowFallback(row);

  if (parsed?.schema_version === 2) {
    const published = parsed.published ? normalizeConfig(parsed.published, fallback) : null;
    const draft = parsed.draft ? normalizeConfig(parsed.draft, published || fallback) : null;
    const history = Array.isArray(parsed.history)
      ? parsed.history.map((item) => normalizeConfig(item, published || draft || fallback)).slice(-MAX_HISTORY)
      : [];
    const lifecycle = clean(parsed.meta?.lifecycle_status).toLowerCase() || (row.active ? "active" : published ? "archived" : "draft");
    return { lifecycle, published, draft, history };
  }

  if (row.active) return { lifecycle: "active", published: fallback, draft: null, history: [] };
  return { lifecycle: "draft", published: null, draft: fallback, history: [] };
}

function incomingConfig(payload, fallback = {}) {
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

function packEnvelope({ lifecycle, published, draft, history }) {
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

function rowPayload(config, active, envelope) {
  return {
    code: config.code,
    name: config.name,
    category: config.category,
    description: config.description,
    active,
    payment_required: config.payment_required,
    payment_amount: config.payment_amount,
    payment_instruction: config.payment_instruction,
    fields_schema: envelope,
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

async function updateMaster(supabase, id, payload) {
  const { data, error } = await supabase.from(MASTERS).update(payload).eq("id", id).select("*").single();
  if (error) throw new Error(error.message || "Gagal memperbarui approval master");
  return data;
}

export async function saveLifecycleDraft({ req, payload }) {
  const id = clean(payload.id);
  if (!id) return null;

  const supabase = getSupabaseAdmin();
  const row = await readMaster(supabase, id);
  const envelope = readEnvelope(row);
  const fallback = envelope.draft || envelope.published || rowFallback(row);
  const revision = envelope.draft?.revision || (envelope.published?.revision || 0) + 1 || 1;
  const draft = {
    ...incomingConfig(payload, fallback),
    revision,
    updated_at: now(),
    published_at: "",
  };

  const lifecycle = envelope.published
    ? envelope.lifecycle === "archived" || !row.active
      ? "archived"
      : "active"
    : "draft";
  const active = lifecycle === "active";
  const published = clone(envelope.published);
  const history = clone(envelope.history || []);
  const packed = packEnvelope({ lifecycle, published, draft, history });
  const effective = active && published ? published : draft;
  const updated = await updateMaster(supabase, id, rowPayload(effective, active, packed));

  await recordAdminActivity(req, {
    type: "update",
    module: "master-management",
    severity: "success",
    message: `Save draft approval master ${draft.code} sebagai draft versi ${draft.revision}`,
    metadata: {
      id,
      code: draft.code,
      lifecycle_status: lifecycle,
      published_revision: published?.revision || 0,
      draft_revision: draft.revision,
    },
  });

  return { ok: true, master: updated, lifecycle_status: lifecycle, draft_revision: draft.revision };
}

export async function archiveLifecycleMaster({ req, payload }) {
  const id = clean(payload.id);
  if (!id) throw new Error("ID approval master wajib diisi");

  const supabase = getSupabaseAdmin();
  const row = await readMaster(supabase, id);
  const envelope = readEnvelope(row);
  if (!envelope.published) throw new Error("Draft yang belum pernah dipublikasikan tidak dapat diarsipkan");

  const published = clone(envelope.published);
  const draft = clone(envelope.draft);
  const history = clone(envelope.history || []);
  const packed = packEnvelope({ lifecycle: "archived", published, draft, history });
  const effective = draft || published;
  const updated = await updateMaster(supabase, id, rowPayload(effective, false, packed));

  await recordAdminActivity(req, {
    type: "update",
    module: "master-management",
    severity: "warning",
    message: `Archive approval master ${effective.code}${draft ? ` dengan draft versi ${draft.revision} tetap tersimpan` : ""}`,
    metadata: {
      id,
      code: effective.code,
      lifecycle_status: "archived",
      published_revision: published.revision,
      draft_revision: draft?.revision || 0,
      draft_preserved: Boolean(draft),
    },
  });

  return { ok: true, master: updated, lifecycle_status: "archived", draft_preserved: Boolean(draft) };
}

export async function discardLifecycleDraft({ req, payload }) {
  const id = clean(payload.id);
  if (!id) throw new Error("ID approval master wajib diisi");

  const supabase = getSupabaseAdmin();
  const row = await readMaster(supabase, id);
  const envelope = readEnvelope(row);
  if (!envelope.draft) throw new Error("Draft tidak ditemukan");

  const published = clone(envelope.published);
  const history = clone(envelope.history || []);
  const lifecycle = published
    ? envelope.lifecycle === "archived" || !row.active
      ? "archived"
      : "active"
    : "draft";

  if (!published) throw new Error("Draft pertama harus dihapus menggunakan Delete Draft");

  const packed = packEnvelope({ lifecycle, published, draft: null, history });
  const updated = await updateMaster(supabase, id, rowPayload(published, lifecycle === "active", packed));

  await recordAdminActivity(req, {
    type: "update",
    module: "master-management",
    severity: "warning",
    message: `Discard draft approval master ${published.code}; kembali ke ${lifecycle}`,
    metadata: {
      id,
      code: published.code,
      lifecycle_status: lifecycle,
      published_revision: published.revision,
      draft_revision: 0,
    },
  });

  return { ok: true, master: updated, lifecycle_status: lifecycle };
}

export async function deleteInitialDraft({ req, payload }) {
  const id = clean(payload.id);
  if (!id) throw new Error("ID approval master wajib diisi");

  const supabase = getSupabaseAdmin();
  const row = await readMaster(supabase, id);
  const envelope = readEnvelope(row);
  if (envelope.published || row.active || envelope.lifecycle !== "draft") {
    throw new Error("Hanya draft yang belum pernah dipublikasikan yang dapat dihapus");
  }

  const draft = envelope.draft || rowFallback(row);
  const { error } = await supabase.from(MASTERS).delete().eq("id", id);
  if (error) throw new Error(error.message || "Gagal menghapus draft approval master");

  await recordAdminActivity(req, {
    type: "delete",
    module: "master-management",
    severity: "warning",
    message: `Delete initial draft approval master ${draft.code}`,
    metadata: { id, code: draft.code, lifecycle_status: "draft" },
  });

  return { ok: true, deleted: true, id };
}
