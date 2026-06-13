import { randomInt } from "crypto";
import { dbTable } from "@/lib/dbTable";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { recordAdminActivity } from "@/lib/adminActivity";
import { resolveAdminAccessRole } from "@/lib/adminRoles";

const MASTERS = dbTable("approval_masters");
const REQUESTS = dbTable("approval_requests");
const ACTIONS = dbTable("approval_actions");
const TERMINAL = ["completed", "rejected", "cancelled"];
const LIFECYCLES = new Set(["draft", "active", "archived"]);
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 60;
const MAX_HISTORY = 10;

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

const clean = (value) => String(value || "").trim();
const now = () => new Date().toISOString();
const clone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));
const number = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const code = (value) => clean(value).toUpperCase().replace(/[^A-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
const fieldKey = (value) => clean(value).toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
const isTerminal = (status) => TERMINAL.includes(clean(status).toLowerCase());
const lifecycle = (value, active = false) => LIFECYCLES.has(clean(value).toLowerCase()) ? clean(value).toLowerCase() : active ? "active" : "draft";
const safeOffset = (value) => Math.max(0, Math.floor(number(value)));
const safeLimit = (value) => {
  const parsed = Math.floor(number(value));
  return parsed ? Math.min(Math.max(1, parsed), MAX_LIMIT) : DEFAULT_LIMIT;
};
const safeSearch = (value) => clean(value).replace(/[%,()]/g, " ").replace(/\s+/g, " ").slice(0, 80);

function parse(value) {
  if (typeof value !== "string") return value;
  if (!clean(value)) return null;
  try { return JSON.parse(value); } catch { return null; }
}

function arraySchema(value, fallback = []) {
  const parsed = parse(value);
  return Array.isArray(parsed) ? parsed : fallback;
}

function normalizeFields(value = []) {
  return (Array.isArray(value) ? value : []).map((field, index) => {
    const label = clean(field?.label) || `Field ${index + 1}`;
    const type = clean(field?.type).toLowerCase() || "text";
    const options = Array.isArray(field?.options) ? field.options.map(clean).filter(Boolean) : [];
    const fallbackSize = type === "image" ? 5 : type === "file" ? 10 : 0;
    return {
      ...field,
      key: fieldKey(field?.key || label || `field_${index + 1}`),
      label,
      type,
      required: Boolean(field?.required),
      placeholder: clean(field?.placeholder),
      show_summary: field?.show_summary !== false,
      ...(options.length ? { options } : {}),
      ...(["image", "file"].includes(type) ? {
        accept: clean(field?.accept) || (type === "image" ? "image/jpeg,image/png,image/webp" : "application/pdf,image/jpeg,image/png,image/webp"),
        max_size_mb: Math.min(Math.max(number(field?.max_size_mb) || fallbackSize, 1), 20),
      } : {}),
    };
  }).filter((field) => field.key && field.label);
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

function rowConfig(row = {}, fields = DEFAULT_FIELDS, flow = DEFAULT_FLOW) {
  return {
    code: code(row.code || row.name),
    name: clean(row.name),
    category: clean(row.category) || "Umum",
    description: clean(row.description),
    icon: "📄",
    color: "#2563eb",
    payment_required: Boolean(row.payment_required),
    payment_amount: number(row.payment_amount),
    payment_instruction: clean(row.payment_instruction),
    fields_schema: normalizeFields(fields),
    flow_schema: normalizeFlow(flow),
    revision: 1,
    updated_at: clean(row.updated_at || row.created_at) || now(),
    published_at: row.active !== false ? clean(row.updated_at || row.created_at) || now() : "",
  };
}

function normalizeConfig(value = {}, fallback = {}) {
  const merged = { ...fallback, ...(value && typeof value === "object" ? value : {}) };
  return {
    code: code(merged.code || merged.name),
    name: clean(merged.name),
    category: clean(merged.category) || "Umum",
    description: clean(merged.description),
    icon: clean(merged.icon) || "📄",
    color: clean(merged.color) || "#2563eb",
    payment_required: Boolean(merged.payment_required),
    payment_amount: number(merged.payment_amount),
    payment_instruction: clean(merged.payment_instruction),
    fields_schema: normalizeFields(merged.fields_schema || fallback.fields_schema || DEFAULT_FIELDS),
    flow_schema: normalizeFlow(merged.flow_schema || fallback.flow_schema || []),
    revision: Math.max(1, Math.floor(number(merged.revision) || number(fallback.revision) || 1)),
    updated_at: clean(merged.updated_at) || now(),
    published_at: clean(merged.published_at),
  };
}

function readEnvelope(row = {}) {
  const parsed = parse(row.fields_schema);
  const rowFlow = Array.isArray(row.flow_schema) ? row.flow_schema : DEFAULT_FLOW;

  if (parsed?.schema_version === 2) {
    const base = rowConfig(row, parsed.fields || DEFAULT_FIELDS, rowFlow);
    const published = parsed.published ? normalizeConfig(parsed.published, base) : null;
    const draft = parsed.draft ? normalizeConfig(parsed.draft, published || base) : null;
    const history = Array.isArray(parsed.history)
      ? parsed.history.map((item) => normalizeConfig(item, published || draft || base)).slice(-MAX_HISTORY)
      : [];
    return { lifecycle: lifecycle(parsed.meta?.lifecycle_status, row.active !== false), published, draft, history };
  }

  const legacyFields = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.fields) ? parsed.fields : DEFAULT_FIELDS;
  const meta = parsed && !Array.isArray(parsed) && parsed.meta ? parsed.meta : {};
  const legacy = normalizeConfig({ ...rowConfig(row, legacyFields, rowFlow), icon: meta.icon, color: meta.color });
  const state = lifecycle(meta.lifecycle_status, row.active !== false);
  return state === "draft" && row.active === false
    ? { lifecycle: "draft", published: null, draft: legacy, history: [] }
    : { lifecycle: state, published: legacy, draft: null, history: [] };
}

function packEnvelope({ state, published, draft, history = [] }) {
  const effective = draft || published || normalizeConfig({});
  return {
    schema_version: 2,
    meta: {
      lifecycle_status: state,
      published_revision: published?.revision || 0,
      draft_revision: draft?.revision || 0,
      published_at: published?.published_at || "",
      updated_at: now(),
    },
    fields: effective.fields_schema,
    published: published || null,
    draft: draft || null,
    history: history.slice(-MAX_HISTORY),
  };
}

function configToRow(config, active, envelope) {
  return {
    code: config.code,
    name: config.name,
    description: config.description,
    category: config.category,
    active,
    payment_required: config.payment_required,
    payment_amount: config.payment_amount,
    payment_instruction: config.payment_instruction,
    fields_schema: envelope,
    flow_schema: config.flow_schema,
    updated_at: now(),
  };
}

function mappedMaster(row = {}, publicView = false) {
  const envelope = readEnvelope(row);
  const published = envelope.published;
  const draft = envelope.draft;
  const config = publicView ? published : draft || published || rowConfig(row);
  const state = envelope.lifecycle === "archived" ? "archived" : row.active && published ? "active" : "draft";
  const common = {
    ...row,
    ...config,
    id: row.id,
    active: Boolean(row.active && published && state === "active"),
    lifecycle_status: state,
    published_revision: published?.revision || 0,
    published_at: published?.published_at || "",
  };
  if (publicView) return common;
  return {
    ...common,
    has_draft: Boolean(draft),
    draft_revision: draft?.revision || 0,
    version_history: [...envelope.history, ...(published ? [published] : [])]
      .sort((a, b) => Number(b.revision || 0) - Number(a.revision || 0))
      .map(clone),
    published_config: published ? clone(published) : null,
  };
}

function validatePublished(config) {
  const fields = config.fields_schema;
  const flow = config.flow_schema;
  if (!fields.length) throw new Error("Master aktif minimal memiliki satu field pengajuan");
  if (new Set(fields.map((field) => field.key)).size !== fields.length) throw new Error("Nama sistem field tidak boleh duplikat");
  const emptyOptions = fields.find((field) => ["select", "radio"].includes(field.type) && !(field.options || []).length);
  if (emptyOptions) throw new Error(`Pilihan untuk field ${emptyOptions.label} belum diisi`);
  if (config.payment_required && config.payment_amount <= 0) throw new Error("Nominal pembayaran wajib lebih dari 0");
  if (config.payment_required && flow[0]?.action !== "validate_payment") throw new Error("Master berbayar harus diawali tahap validasi pembayaran");
}

function submitted(value) {
  if (value && typeof value === "object" && value.kind === "attachment") return Boolean(value.path && value.name);
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(clean(value));
}

function validateSubmission(master, formData) {
  const missing = (master.fields_schema || [])
    .filter((field) => field.required && !submitted(formData[field.key]))
    .map((field) => field.label || field.key);
  if (missing.length) throw new Error(`Field wajib belum diisi: ${missing.join(", ")}`);
}

function payloadConfig(payload = {}, fallback = {}) {
  return normalizeConfig({
    code: payload.code || payload.name,
    name: payload.name,
    category: payload.category,
    description: payload.description,
    icon: payload.icon,
    color: payload.color,
    payment_required: payload.payment_required,
    payment_amount: payload.payment_amount,
    payment_instruction: payload.payment_instruction,
    fields_schema: arraySchema(payload.fields_schema, fallback.fields_schema || DEFAULT_FIELDS),
    flow_schema: arraySchema(payload.flow_schema, fallback.flow_schema || []),
    updated_at: now(),
  }, fallback);
}

function firstStep(flow) {
  return normalizeFlow(flow)[0] || null;
}

function requestStatus(master) {
  const first = firstStep(master.flow_schema);
  if (!first) return { status: "completed", current_step: null, current_approver_role: null, payment_status: master.payment_required ? "pending" : "not_required" };
  return {
    status: master.payment_required && first.action === "validate_payment" ? "waiting_payment_validation" : "waiting_approval",
    current_step: first.step,
    current_approver_role: first.role,
    payment_status: master.payment_required ? "pending" : "not_required",
  };
}

async function roleScopedIds(supabase, role) {
  if (role === "admin") return null;
  const [{ data: current, error: currentError }, { data: actions, error: actionError }] = await Promise.all([
    supabase.from(REQUESTS).select("id").eq("current_approver_role", role),
    supabase.from(ACTIONS).select("request_id").eq("role", role),
  ]);
  if (currentError) throw new Error(currentError.message || "Gagal membaca approval role");
  if (actionError) throw new Error(actionError.message || "Gagal membaca riwayat approval role");
  return [...new Set([...(current || []).map((row) => clean(row.id)), ...(actions || []).map((row) => clean(row.request_id))].filter(Boolean))];
}

async function idsBySearch(supabase, term) {
  if (!term) return null;
  const requestColumns = ["request_no", "master_name", "requester_name", "requester_house", "current_approver_role", "status"];
  const actionColumns = ["role", "action", "note"];
  const searches = [
    ...requestColumns.map(async (column) => {
      const { data, error } = await supabase.from(REQUESTS).select("id").ilike(column, `%${term}%`);
      if (error) throw new Error(error.message || "Gagal mencari approval center");
      return (data || []).map((row) => clean(row.id));
    }),
    ...actionColumns.map(async (column) => {
      const { data, error } = await supabase.from(ACTIONS).select("request_id").ilike(column, `%${term}%`);
      if (error) throw new Error(error.message || "Gagal mencari approval center");
      return (data || []).map((row) => clean(row.request_id));
    }),
  ];
  return [...new Set((await Promise.all(searches)).flat().filter(Boolean))];
}

function intersect(left, right) {
  if (!Array.isArray(left)) return right;
  if (!Array.isArray(right)) return left;
  const rightSet = new Set(right);
  return left.filter((id) => rightSet.has(id));
}

function idScope(query, ids) {
  if (!Array.isArray(ids)) return query;
  return ids.length ? query.in("id", ids) : null;
}

const nonTerminal = (query) => query.not("status", "in", `(${TERMINAL.join(",")})`);

function listFilter(query, role, filter) {
  if (filter === "inbox") return role === "admin" ? nonTerminal(query) : nonTerminal(query.eq("current_approver_role", role));
  if (filter === "processing") return nonTerminal(query);
  if (TERMINAL.includes(filter)) return query.eq("status", filter);
  return query;
}

async function countRequests(supabase, role, type, ids) {
  if (Array.isArray(ids) && !ids.length) return 0;
  let query = idScope(supabase.from(REQUESTS).select("id", { count: "exact", head: true }), ids);
  if (!query) return 0;
  query = listFilter(query, role, type);
  const { count, error } = await query;
  if (error) throw new Error(error.message || "Gagal menghitung approval center");
  return count || 0;
}

async function summary(supabase, role, ids) {
  const [inbox, processing, completed, rejected] = await Promise.all([
    countRequests(supabase, role, "inbox", ids),
    countRequests(supabase, role, "processing", ids),
    countRequests(supabase, role, "completed", ids),
    countRequests(supabase, role, "rejected", ids),
  ]);
  return { inbox, processing, completed, rejected };
}

async function requestNo(supabase) {
  const date = new Date();
  const prefix = `APR-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}-`;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const value = `${prefix}${String(randomInt(0, 10000)).padStart(4, "0")}`;
    const { data, error } = await supabase.from(REQUESTS).select("id").eq("request_no", value).maybeSingle();
    if (error) throw new Error(error.message || "Gagal membuat nomor pengajuan");
    if (!data) return value;
  }
  throw new Error("Gagal membuat nomor pengajuan unik. Silakan coba lagi.");
}

export async function getApprovalMasters({ activeOnly = false } = {}) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from(MASTERS).select("*").order("created_at", { ascending: false });
  if (activeOnly) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message || "Gagal membaca master approval");
  return (data || []).map((row) => mappedMaster(row, activeOnly)).filter((master) => !activeOnly || master.active);
}

export async function getApprovalMaster({ id = "", code: masterCode = "", activeOnly = false } = {}) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from(MASTERS).select("*").limit(1);
  if (activeOnly) query = query.eq("active", true);
  query = clean(id) ? query.eq("id", clean(id)) : query.eq("code", code(masterCode));
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message || "Gagal membaca master approval");
  if (!data) return null;
  const master = mappedMaster(data, activeOnly);
  return activeOnly && !master.active ? null : master;
}

export async function getMasterManagementOverview() {
  return { ok: true, masters: await getApprovalMasters(), default_fields_schema: DEFAULT_FIELDS, default_flow_schema: DEFAULT_FLOW };
}

export async function saveApprovalMaster({ req, payload = {} }) {
  const supabase = getSupabaseAdmin();
  const id = clean(payload.id);
  const operation = clean(payload.operation).toLowerCase();
  const requested = lifecycle(payload.lifecycle_status, payload.active !== false);
  const timestamp = now();

  let existing = null;
  if (id) {
    const { data, error } = await supabase.from(MASTERS).select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message || "Gagal membaca approval master");
    if (!data) throw new Error("Approval master tidak ditemukan");
    existing = data;
  }

  const envelope = existing ? readEnvelope(existing) : { lifecycle: "draft", published: null, draft: null, history: [] };

  if (operation === "discard_draft") {
    if (!existing || !envelope.draft) throw new Error("Draft tidak ditemukan");
    const state = envelope.published && existing.active ? "active" : envelope.lifecycle;
    const packed = packEnvelope({ state, published: envelope.published, draft: null, history: envelope.history });
    const fallback = envelope.published || rowConfig(existing);
    const { data, error } = await supabase.from(MASTERS).update(configToRow(fallback, state === "active", packed)).eq("id", id).select("*").single();
    if (error) throw new Error(error.message || "Gagal membuang draft");
    await recordAdminActivity(req, { type: "update", module: "master-management", severity: "warning", message: `Discard draft approval master ${fallback.code}`, metadata: { id, code: fallback.code } });
    return { ok: true, master: mappedMaster(data) };
  }

  const fallback = envelope.draft || envelope.published || (existing ? rowConfig(existing) : {});
  const incoming = payloadConfig(payload, fallback);
  if (!incoming.code) throw new Error("Kode approval wajib diisi");
  if (!incoming.name) throw new Error("Nama approval wajib diisi");

  let state = requested;
  let published = clone(envelope.published);
  let draft = clone(envelope.draft);
  let history = clone(envelope.history || []);
  let active = Boolean(existing?.active && published);

  if (requested === "draft") {
    const revision = draft?.revision || (published?.revision || 0) + 1;
    draft = { ...incoming, revision, updated_at: timestamp, published_at: "" };
    state = active && published ? "active" : "draft";
  } else if (requested === "active") {
    validatePublished(incoming);
    if (published) history = [...history, clone(published)].slice(-MAX_HISTORY);
    const revision = draft?.revision || (published?.revision || 0) + 1;
    published = { ...incoming, revision, updated_at: timestamp, published_at: timestamp };
    draft = null;
    active = true;
    state = "active";
  } else {
    draft = null;
    active = false;
    state = "archived";
  }

  const packed = packEnvelope({ state, published, draft, history });
  const effective = active && published ? published : draft || published || incoming;
  const row = configToRow(effective, active, packed);
  const query = existing
    ? supabase.from(MASTERS).update(row).eq("id", id).select("*").single()
    : supabase.from(MASTERS).insert(row).select("*").single();
  const { data, error } = await query;
  if (error) throw new Error(error.message || "Gagal menyimpan master approval");

  await recordAdminActivity(req, {
    type: existing ? "update" : "create",
    module: "master-management",
    severity: "success",
    message: `${existing ? "Update" : "Create"} approval master ${effective.code} sebagai ${requested}`,
    metadata: { access_role: "admin", code: effective.code, id: data?.id || id, lifecycle_status: state, published_revision: published?.revision || 0, draft_revision: draft?.revision || 0 },
  });
  return { ok: true, master: mappedMaster(data) };
}

export async function getApprovalCenterOverview({ accessRole = "admin", offset = 0, limit = DEFAULT_LIMIT, filter = "all", search = "" } = {}) {
  const role = resolveAdminAccessRole(accessRole);
  const supabase = getSupabaseAdmin();
  const from = safeOffset(offset);
  const size = safeLimit(limit);
  const selected = clean(filter).toLowerCase() || "all";
  const scoped = await roleScopedIds(supabase, role);
  const searched = await idsBySearch(supabase, safeSearch(search));
  const ids = intersect(scoped, searched);

  if (Array.isArray(ids) && !ids.length) {
    return { ok: true, access_role: role, summary: await summary(supabase, role, scoped), inbox: [], requests: [], pagination: { offset: from, limit: size, fetched: 0, next_offset: from, total: 0, has_more: false, filter: selected, search: safeSearch(search) } };
  }

  let query = idScope(supabase.from(REQUESTS).select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, from + size - 1), ids);
  query = listFilter(query, role, selected);
  const { data, error, count } = await query;
  if (error) throw new Error(error.message || "Gagal membaca approval center");
  const rows = data || [];
  const inbox = role === "admin" ? rows.filter((row) => !isTerminal(row.status)) : rows.filter((row) => row.current_approver_role === role && !isTerminal(row.status));
  const total = count || 0;
  const nextOffset = from + rows.length;
  return { ok: true, access_role: role, summary: await summary(supabase, role, scoped), inbox, requests: rows, pagination: { offset: from, limit: size, fetched: rows.length, next_offset: nextOffset, total, has_more: nextOffset < total, filter: selected, search: safeSearch(search) } };
}

export async function submitApprovalRequest(payload = {}) {
  const supabase = getSupabaseAdmin();
  const master = await getApprovalMaster({ id: clean(payload.master_id), code: code(payload.master_code), activeOnly: true });
  if (!master?.id) throw new Error("Jenis pengajuan tidak ditemukan atau nonaktif");

  const raw = payload.form_data && typeof payload.form_data === "object" ? payload.form_data : {};
  const formData = Object.fromEntries(Object.entries(raw).filter(([key]) => !key.startsWith("__")));
  validateSubmission(master, formData);
  const generatedNo = await requestNo(supabase);
  const status = requestStatus(master);
  const timestamp = now();
  const persisted = {
    ...formData,
    __system: {
      master_revision: master.published_revision || 1,
      fields_schema_snapshot: clone(master.fields_schema),
      flow_schema_snapshot: clone(master.flow_schema),
      payment_instruction_snapshot: master.payment_instruction,
      captured_at: timestamp,
    },
  };
  const row = {
    request_no: generatedNo,
    master_id: master.id,
    master_code: master.code,
    master_name: master.name,
    requester_house: clean(formData.requester_house || payload.requester_house),
    requester_name: clean(formData.requester_name || payload.requester_name),
    requester_phone: clean(formData.requester_phone || payload.requester_phone),
    status: status.status,
    current_step: status.current_step,
    current_approver_role: status.current_approver_role,
    amount: master.payment_required ? master.payment_amount : 0,
    payment_status: status.payment_status,
    form_data: persisted,
    submitted_at: timestamp,
    updated_at: timestamp,
  };
  const { data, error } = await supabase.from(REQUESTS).insert(row).select("*").single();
  if (error) throw new Error(error.message || "Gagal membuat pengajuan");
  const reason = clean(formData.reason || formData.alasan);
  const { error: actionError } = await supabase.from(ACTIONS).insert({ request_id: data.id, step: 0, role: "warga", actor: row.requester_name || row.requester_house || "warga", action: "submit", note: reason ? `Alasan Pengajuan: ${reason}` : "Pengajuan dibuat oleh warga" });
  if (actionError) throw new Error(actionError.message || "Pengajuan dibuat tetapi riwayat awal gagal disimpan");
  return { ok: true, request: data, payment_instruction: master.payment_instruction, message: master.payment_required ? `Pengajuan berhasil. Silakan transfer Rp${master.payment_amount.toLocaleString("id-ID")} dan tunggu validasi ${status.current_approver_role || "pengurus"}.` : "Pengajuan berhasil dan sedang menunggu approval pengurus." };
}
