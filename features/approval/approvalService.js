import { randomInt } from "crypto";
import { dbTable } from "@/lib/dbTable";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { recordAdminActivity } from "@/lib/adminActivity";
import { resolveAdminAccessRole } from "@/lib/adminRoles";

const APPROVAL_MASTERS_TABLE = dbTable("approval_masters");
const APPROVAL_REQUESTS_TABLE = dbTable("approval_requests");
const APPROVAL_ACTIONS_TABLE = dbTable("approval_actions");
const TERMINAL_STATUSES = ["completed", "rejected", "cancelled"];
const MASTER_LIFECYCLES = new Set(["draft", "active", "archived"]);
const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 60;
const MAX_VERSION_HISTORY = 10;

const DEFAULT_FIELDS_SCHEMA = [
  { key: "requester_name", label: "Nama Warga", type: "text", required: true, placeholder: "Nama lengkap", show_summary: true },
  { key: "requester_house", label: "Nomor Rumah", type: "text", required: true, placeholder: "Contoh: E3-3", show_summary: true },
  { key: "requester_phone", label: "Nomor WhatsApp", type: "tel", required: true, placeholder: "08xxxxxxxxxx", show_summary: false },
  { key: "reason", label: "Alasan Pengajuan", type: "textarea", required: true, placeholder: "Jelaskan kebutuhan pengajuan", show_summary: true },
];

const DEFAULT_FLOW_SCHEMA = [
  { step: 1, role: "bendahara", label: "Validasi Pembayaran", action: "validate_payment" },
  { step: 2, role: "ketua", label: "Approval Ketua", action: "final_approval" },
];

function clean(value) { return String(value || "").trim(); }
function isTerminalStatus(status) { return TERMINAL_STATUSES.includes(clean(status).toLowerCase()); }
function normalizeCode(value) { return clean(value).toUpperCase().replace(/[^A-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40); }
function normalizeFieldKey(value) { return clean(value).toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60); }
function safeNumber(value) { const number = Number(value || 0); return Number.isFinite(number) ? number : 0; }
function safeOffset(value) { return Math.max(0, Math.floor(safeNumber(value))); }
function safeLimit(value) { const parsed = Math.floor(safeNumber(value)); return parsed ? Math.min(Math.max(1, parsed), MAX_PAGE_LIMIT) : DEFAULT_PAGE_LIMIT; }
function safeSearch(value) { return clean(value).replace(/[%,()]/g, " ").replace(/\s+/g, " ").slice(0, 80); }
function requestReason(formData = {}) { return clean(formData.reason || formData.alasan); }
function normalizeLifecycle(value, active = false) { const lifecycle = clean(value).toLowerCase(); return MASTER_LIFECYCLES.has(lifecycle) ? lifecycle : active ? "active" : "draft"; }
function isoNow() { return new Date().toISOString(); }
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }

function parseJson(value) {
  if (typeof value !== "string") return value;
  if (!clean(value)) return null;
  try { return JSON.parse(value); } catch { return null; }
}

function parseSchema(value, fallback) {
  const parsed = parseJson(value);
  return Array.isArray(parsed) ? parsed : fallback;
}

function ensureFields(fieldsSchema = []) {
  return [...(Array.isArray(fieldsSchema) ? fieldsSchema : [])]
    .map((field, index) => {
      const label = clean(field?.label) || `Field ${index + 1}`;
      const key = normalizeFieldKey(field?.key || label || `field_${index + 1}`);
      const options = Array.isArray(field?.options) ? field.options.map(clean).filter(Boolean) : [];
      const type = clean(field?.type).toLowerCase() || "text";
      const defaultMax = type === "image" ? 5 : type === "file" ? 10 : 0;
      return {
        ...field,
        key,
        label,
        type,
        required: Boolean(field?.required),
        placeholder: clean(field?.placeholder),
        show_summary: field?.show_summary !== false,
        ...(options.length ? { options } : {}),
        ...(["image", "file"].includes(type) ? {
          accept: clean(field?.accept) || (type === "image" ? "image/jpeg,image/png,image/webp" : "application/pdf,image/jpeg,image/png,image/webp"),
          max_size_mb: Math.min(Math.max(safeNumber(field?.max_size_mb) || defaultMax, 1), 20),
        } : {}),
      };
    })
    .filter((field) => field.key && field.label);
}

function ensureFlow(flowSchema = []) {
  return [...(Array.isArray(flowSchema) ? flowSchema : [])]
    .map((step, index) => ({
      ...step,
      step: index + 1,
      role: clean(step?.role).toLowerCase(),
      label: clean(step?.label) || `Approval Step ${index + 1}`,
      action: clean(step?.action).toLowerCase() || "approve",
    }))
    .filter((step) => step.role);
}

function configFromRow(row = {}, fields = DEFAULT_FIELDS_SCHEMA, flow = DEFAULT_FLOW_SCHEMA) {
  return {
    code: normalizeCode(row.code || row.name),
    name: clean(row.name),
    category: clean(row.category) || "Umum",
    description: clean(row.description),
    icon: "📄",
    color: "#2563eb",
    payment_required: Boolean(row.payment_required),
    payment_amount: safeNumber(row.payment_amount),
    payment_instruction: clean(row.payment_instruction),
    fields_schema: ensureFields(fields),
    flow_schema: ensureFlow(flow),
    revision: 1,
    updated_at: clean(row.updated_at || row.created_at) || isoNow(),
    published_at: row.active !== false ? clean(row.updated_at || row.created_at) || isoNow() : "",
  };
}

function normalizeConfig(value = {}, fallback = {}) {
  const merged = { ...fallback, ...(value && typeof value === "object" ? value : {}) };
  return {
    code: normalizeCode(merged.code || merged.name),
    name: clean(merged.name),
    category: clean(merged.category) || "Umum",
    description: clean(merged.description),
    icon: clean(merged.icon) || "📄",
    color: clean(merged.color) || "#2563eb",
    payment_required: Boolean(merged.payment_required),
    payment_amount: safeNumber(merged.payment_amount),
    payment_instruction: clean(merged.payment_instruction),
    fields_schema: ensureFields(merged.fields_schema || fallback.fields_schema || DEFAULT_FIELDS_SCHEMA),
    flow_schema: ensureFlow(merged.flow_schema || fallback.flow_schema || []),
    revision: Math.max(1, Math.floor(safeNumber(merged.revision) || safeNumber(fallback.revision) || 1)),
    updated_at: clean(merged.updated_at) || isoNow(),
    published_at: clean(merged.published_at),
  };
}

function readMasterEnvelope(row = {}) {
  const parsed = parseJson(row.fields_schema);
  const rowFlow = Array.isArray(row.flow_schema) ? row.flow_schema : DEFAULT_FLOW_SCHEMA;

  if (parsed?.schema_version === 2) {
    const published = parsed.published ? normalizeConfig(parsed.published, configFromRow(row, parsed.fields || DEFAULT_FIELDS_SCHEMA, rowFlow)) : null;
    const draft = parsed.draft ? normalizeConfig(parsed.draft, published || configFromRow(row, parsed.fields || DEFAULT_FIELDS_SCHEMA, rowFlow)) : null;
    const history = Array.isArray(parsed.history) ? parsed.history.map((item) => normalizeConfig(item, published || draft || {})).slice(-MAX_VERSION_HISTORY) : [];
    return {
      schema_version: 2,
      lifecycle_status: normalizeLifecycle(parsed.meta?.lifecycle_status, row.active !== false),
      published,
      draft,
      history,
    };
  }

  const legacyFields = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.fields) ? parsed.fields : DEFAULT_FIELDS_SCHEMA;
  const legacyMeta = parsed && !Array.isArray(parsed) && parsed.meta ? parsed.meta : {};
  const legacyConfig = normalizeConfig({
    ...configFromRow(row, legacyFields, rowFlow),
    icon: legacyMeta.icon,
    color: legacyMeta.color,
  });
  const lifecycle = normalizeLifecycle(legacyMeta.lifecycle_status, row.active !== false);

  if (lifecycle === "draft" && row.active === false) {
    return { schema_version: 2, lifecycle_status: "draft", published: null, draft: legacyConfig, history: [] };
  }

  return {
    schema_version: 2,
    lifecycle_status: lifecycle,
    published: legacyConfig,
    draft: null,
    history: [],
  };
}

function packMasterEnvelope({ lifecycleStatus, published, draft, history = [] }) {
  const effective = draft || published || normalizeConfig({});
  return {
    schema_version: 2,
    meta: {
      lifecycle_status: lifecycleStatus,
      published_revision: published?.revision || 0,
      draft_revision: draft?.revision || 0,
      published_at: published?.published_at || "",
      updated_at: isoNow(),
    },
    fields: effective.fields_schema,
    published: published || null,
    draft: draft || null,
    history: history.slice(-MAX_VERSION_HISTORY),
  };
}

function configToRow(config, { active, fieldsEnvelope }) {
  return {
    code: config.code,
    name: config.name,
    description: config.description,
    category: config.category,
    active,
    payment_required: config.payment_required,
    payment_amount: config.payment_amount,
    payment_instruction: config.payment_instruction,
    fields_schema: fieldsEnvelope,
    flow_schema: config.flow_schema,
    updated_at: isoNow(),
  };
}

function mapMaster(row = {}, { publicView = false } = {}) {
  const envelope = readMasterEnvelope(row);
  const published = envelope.published;
  const draft = envelope.draft;
  const config = publicView ? published : draft || published || configFromRow(row);
  const lifecycleStatus = envelope.lifecycle_status === "archived"
    ? "archived"
    : row.active && published
      ? "active"
      : "draft";

  return {
    ...row,
    ...config,
    id: row.id,
    active: Boolean(row.active && published && lifecycleStatus === "active"),
    lifecycle_status: lifecycleStatus,
    has_draft: Boolean(draft),
    published_revision: published?.revision || 0,
    draft_revision: draft?.revision || 0,
    published_at: published?.published_at || "",
    version_history: [...envelope.history, ...(published ? [published] : [])]
      .sort((a, b) => Number(b.revision || 0) - Number(a.revision || 0))
      .map((item) => clone(item)),
    published_config: published ? clone(published) : null,
  };
}

function getFirstStep(flowSchema = []) { return ensureFlow(flowSchema)[0] || null; }

function buildRequestStatus(master) {
  const firstStep = getFirstStep(master.flow_schema);
  if (!firstStep) return { status: "completed", current_step: null, current_approver_role: null, payment_status: master.payment_required ? "pending" : "not_required" };
  return { status: master.payment_required && firstStep.action === "validate_payment" ? "waiting_payment_validation" : "waiting_approval", current_step: firstStep.step, current_approver_role: firstStep.role, payment_status: master.payment_required ? "pending" : "not_required" };
}

function hasSubmittedValue(value) {
  if (value && typeof value === "object" && value.kind === "attachment") return Boolean(value.path && value.name);
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(clean(value));
}

function validateFormData(master, formData = {}) {
  const missing = (master.fields_schema || [])
    .filter((field) => field.required)
    .filter((field) => !hasSubmittedValue(formData[field.key]))
    .map((field) => field.label || field.key);
  if (missing.length) throw new Error(`Field wajib belum diisi: ${missing.join(", ")}`);
}

function validatePublishedMaster({ fields, flow, paymentRequired, paymentAmount }) {
  if (!fields.length) throw new Error("Master aktif minimal memiliki satu field pengajuan");
  const keys = fields.map((field) => field.key);
  if (new Set(keys).size !== keys.length) throw new Error("Nama sistem field tidak boleh duplikat");
  const optionField = fields.find((field) => ["select", "radio"].includes(field.type) && !(field.options || []).length);
  if (optionField) throw new Error(`Pilihan untuk field ${optionField.label} belum diisi`);
  if (paymentRequired && paymentAmount <= 0) throw new Error("Nominal pembayaran wajib lebih dari 0");
  if (paymentRequired && flow[0]?.action !== "validate_payment") throw new Error("Master berbayar harus diawali tahap validasi pembayaran");
}

function payloadToConfig(payload = {}, fallback = {}) {
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
    fields_schema: parseSchema(payload.fields_schema, fallback.fields_schema || DEFAULT_FIELDS_SCHEMA),
    flow_schema: parseSchema(payload.flow_schema, fallback.flow_schema || []),
    updated_at: isoNow(),
  }, fallback);
}

async function getRoleScopedIds(supabase, role) {
  if (role === "admin") return null;
  const [{ data: currentRows, error: currentError }, { data: actionRows, error: actionError }] = await Promise.all([
    supabase.from(APPROVAL_REQUESTS_TABLE).select("id").eq("current_approver_role", role),
    supabase.from(APPROVAL_ACTIONS_TABLE).select("request_id").eq("role", role),
  ]);
  if (currentError) throw new Error(currentError.message || "Gagal membaca approval role");
  if (actionError) throw new Error(actionError.message || "Gagal membaca riwayat approval role");
  return [...new Set([...(currentRows || []).map((row) => clean(row.id)), ...(actionRows || []).map((row) => clean(row.request_id))].filter(Boolean))];
}

async function idsFromColumnSearch(supabase, table, column, term, idColumn = "id") {
  if (!term) return [];
  const { data, error } = await supabase.from(table).select(idColumn).ilike(column, `%${term}%`);
  if (error) throw new Error(error.message || "Gagal mencari approval center");
  return (data || []).map((row) => clean(row[idColumn])).filter(Boolean);
}

async function getSearchMatchedIds(supabase, term) {
  if (!term) return null;
  const requestFields = ["request_no", "master_name", "requester_name", "requester_house", "current_approver_role", "status"];
  const actionFields = ["role", "action", "note"];
  const results = await Promise.all([
    ...requestFields.map((field) => idsFromColumnSearch(supabase, APPROVAL_REQUESTS_TABLE, field, term, "id")),
    ...actionFields.map((field) => idsFromColumnSearch(supabase, APPROVAL_ACTIONS_TABLE, field, term, "request_id")),
  ]);
  return [...new Set(results.flat())];
}

function intersectIds(left, right) {
  if (!Array.isArray(left)) return right;
  if (!Array.isArray(right)) return left;
  const set = new Set(right);
  return left.filter((id) => set.has(id));
}

function applyIdScope(query, ids) {
  if (!Array.isArray(ids)) return query;
  if (!ids.length) return null;
  return query.in("id", ids);
}

function applyNonTerminal(query) { return query.not("status", "in", `(${TERMINAL_STATUSES.join(",")})`); }

function applyListFilter(query, role, selectedFilter) {
  if (selectedFilter === "inbox") return role === "admin" ? applyNonTerminal(query) : applyNonTerminal(query.eq("current_approver_role", role));
  if (selectedFilter === "processing") return applyNonTerminal(query);
  if (["completed", "rejected", "cancelled"].includes(selectedFilter)) return query.eq("status", selectedFilter);
  return query;
}

async function countApprovalRequests({ supabase, role, type, scopedIds }) {
  if (Array.isArray(scopedIds) && !scopedIds.length) return 0;
  let query = supabase.from(APPROVAL_REQUESTS_TABLE).select("id", { count: "exact", head: true });
  query = applyIdScope(query, scopedIds);
  if (!query) return 0;
  if (type === "inbox") query = role === "admin" ? applyNonTerminal(query) : applyNonTerminal(query.eq("current_approver_role", role));
  if (type === "processing") query = applyNonTerminal(query);
  if (type === "completed") query = query.eq("status", "completed");
  if (type === "rejected") query = query.eq("status", "rejected");
  const { count, error } = await query;
  if (error) throw new Error(error.message || "Gagal menghitung approval center");
  return count || 0;
}

async function getApprovalSummary({ supabase, role, scopedIds }) {
  const [inbox, processing, completed, rejected] = await Promise.all([
    countApprovalRequests({ supabase, role, type: "inbox", scopedIds }),
    countApprovalRequests({ supabase, role, type: "processing", scopedIds }),
    countApprovalRequests({ supabase, role, type: "completed", scopedIds }),
    countApprovalRequests({ supabase, role, type: "rejected", scopedIds }),
  ]);
  return { inbox, processing, completed, rejected };
}

async function generateRequestNo(supabase) {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `APR-${yearMonth}-`;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const requestNo = `${prefix}${String(randomInt(0, 10000)).padStart(4, "0")}`;
    const { data, error } = await supabase.from(APPROVAL_REQUESTS_TABLE).select("id").eq("request_no", requestNo).maybeSingle();
    if (error) throw new Error(error.message || "Gagal membuat nomor pengajuan");
    if (!data) return requestNo;
  }
  throw new Error("Gagal membuat nomor pengajuan unik. Silakan coba lagi.");
}

export async function getApprovalMasters({ activeOnly = false } = {}) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from(APPROVAL_MASTERS_TABLE).select("*").order("created_at", { ascending: false });
  if (activeOnly) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message || "Gagal membaca master approval");
  return (data || [])
    .map((row) => mapMaster(row, { publicView: activeOnly }))
    .filter((master) => !activeOnly || master.active);
}

export async function getApprovalMaster({ id = "", code = "", activeOnly = false } = {}) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from(APPROVAL_MASTERS_TABLE).select("*").limit(1);
  if (activeOnly) query = query.eq("active", true);
  if (clean(id)) query = query.eq("id", clean(id));
  else query = query.eq("code", normalizeCode(code));
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message || "Gagal membaca master approval");
  if (!data) return null;
  const master = mapMaster(data, { publicView: activeOnly });
  return activeOnly && !master.active ? null : master;
}

export async function getMasterManagementOverview() {
  return { ok: true, masters: await getApprovalMasters(), default_fields_schema: DEFAULT_FIELDS_SCHEMA, default_flow_schema: DEFAULT_FLOW_SCHEMA };
}

export async function saveApprovalMaster({ req, payload = {} }) {
  const supabase = getSupabaseAdmin();
  const id = clean(payload.id);
  const operation = clean(payload.operation).toLowerCase();
  const requestedLifecycle = normalizeLifecycle(payload.lifecycle_status, payload.active !== false);
  const now = isoNow();

  let existingRow = null;
  if (id) {
    const { data, error } = await supabase.from(APPROVAL_MASTERS_TABLE).select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message || "Gagal membaca approval master");
    if (!data) throw new Error("Approval master tidak ditemukan");
    existingRow = data;
  }

  const envelope = existingRow
    ? readMasterEnvelope(existingRow)
    : { lifecycle_status: "draft", published: null, draft: null, history: [] };

  if (operation === "discard_draft") {
    if (!existingRow || !envelope.draft) throw new Error("Draft tidak ditemukan");
    const lifecycleStatus = envelope.published && existingRow.active ? "active" : envelope.lifecycle_status;
    const packed = packMasterEnvelope({ lifecycleStatus, published: envelope.published, draft: null, history: envelope.history });
    const fallback = envelope.published || configFromRow(existingRow);
    const { data, error } = await supabase
      .from(APPROVAL_MASTERS_TABLE)
      .update(configToRow(fallback, { active: lifecycleStatus === "active", fieldsEnvelope: packed }))
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message || "Gagal membuang draft");
    await recordAdminActivity(req, { type: "update", module: "master-management", severity: "warning", message: `Discard draft approval master ${fallback.code}`, metadata: { id, code: fallback.code } });
    return { ok: true, master: mapMaster(data) };
  }

  const fallbackConfig = envelope.draft || envelope.published || (existingRow ? configFromRow(existingRow) : {});
  const incoming = payloadToConfig(payload, fallbackConfig);
  if (!incoming.code) throw new Error("Kode approval wajib diisi");
  if (!incoming.name) throw new Error("Nama approval wajib diisi");

  let lifecycleStatus = requestedLifecycle;
  let published = envelope.published ? clone(envelope.published) : null;
  let draft = envelope.draft ? clone(envelope.draft) : null;
  let history = clone(envelope.history || []);
  let active = Boolean(existingRow?.active && published);

  if (requestedLifecycle === "draft") {
    const baseRevision = published?.revision || draft?.revision || 0;
    draft = { ...incoming, revision: Math.max(baseRevision + 1, draft?.revision || 1), updated_at: now, published_at: "" };
    lifecycleStatus = active && published ? "active" : "draft";
  } else if (requestedLifecycle === "active") {
    validatePublishedMaster({ fields: incoming.fields_schema, flow: incoming.flow_schema, paymentRequired: incoming.payment_required, paymentAmount: incoming.payment_amount });
    if (published) history = [...history, clone(published)].slice(-MAX_VERSION_HISTORY);
    const nextRevision = Math.max(published?.revision || 0, draft?.revision || 0) + 1;
    published = { ...incoming, revision: nextRevision, updated_at: now, published_at: now };
    draft = null;
    active = true;
    lifecycleStatus = "active";
  } else if (requestedLifecycle === "archived") {
    draft = null;
    active = false;
    lifecycleStatus = "archived";
  }

  const packed = packMasterEnvelope({ lifecycleStatus, published, draft, history });
  const rowConfig = active && published ? published : draft || published || incoming;
  const row = configToRow(rowConfig, { active, fieldsEnvelope: packed });
  const query = existingRow
    ? supabase.from(APPROVAL_MASTERS_TABLE).update(row).eq("id", id).select("*").single()
    : supabase.from(APPROVAL_MASTERS_TABLE).insert(row).select("*").single();
  const { data, error } = await query;
  if (error) throw new Error(error.message || "Gagal menyimpan master approval");

  await recordAdminActivity(req, {
    type: existingRow ? "update" : "create",
    module: "master-management",
    severity: "success",
    message: `${existingRow ? "Update" : "Create"} approval master ${rowConfig.code} sebagai ${requestedLifecycle}`,
    metadata: {
      access_role: "admin",
      code: rowConfig.code,
      id: data?.id || id,
      lifecycle_status: lifecycleStatus,
      published_revision: published?.revision || 0,
      draft_revision: draft?.revision || 0,
    },
  });
  return { ok: true, master: mapMaster(data) };
}

export async function getApprovalCenterOverview({ accessRole = "admin", offset = 0, limit = DEFAULT_PAGE_LIMIT, filter = "all", search = "" } = {}) {
  const role = resolveAdminAccessRole(accessRole);
  const supabase = getSupabaseAdmin();
  const from = safeOffset(offset); const size = safeLimit(limit); const to = from + size - 1;
  const selectedFilter = clean(filter).toLowerCase() || "all";
  const term = safeSearch(search);
  const roleScopedIds = await getRoleScopedIds(supabase, role);
  const searchIds = await getSearchMatchedIds(supabase, term);
  const effectiveIds = intersectIds(roleScopedIds, searchIds);

  if (Array.isArray(effectiveIds) && !effectiveIds.length) {
    return { ok: true, access_role: role, summary: await getApprovalSummary({ supabase, role, scopedIds: roleScopedIds }), inbox: [], requests: [], pagination: { offset: from, limit: size, fetched: 0, next_offset: from, total: 0, has_more: false, filter: selectedFilter, search: term } };
  }

  let query = supabase.from(APPROVAL_REQUESTS_TABLE).select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
  query = applyIdScope(query, effectiveIds);
  query = applyListFilter(query, role, selectedFilter);
  const { data, error, count } = await query;
  if (error) throw new Error(error.message || "Gagal membaca approval center");

  const rows = data || [];
  const inbox = role === "admin" ? rows.filter((row) => !isTerminalStatus(row.status)) : rows.filter((row) => row.current_approver_role === role && !isTerminalStatus(row.status));
  const total = count || 0;
  const nextOffset = from + rows.length;
  return { ok: true, access_role: role, summary: await getApprovalSummary({ supabase, role, scopedIds: roleScopedIds }), inbox, requests: rows, pagination: { offset: from, limit: size, fetched: rows.length, next_offset: nextOffset, total, has_more: nextOffset < total, filter: selectedFilter, search: term } };
}

export async function submitApprovalRequest(payload = {}) {
  const supabase = getSupabaseAdmin();
  const masterId = clean(payload.master_id);
  const masterCode = normalizeCode(payload.master_code);
  const master = await getApprovalMaster({ id: masterId, code: masterCode, activeOnly: true });
  if (!master?.id) throw new Error("Jenis pengajuan tidak ditemukan atau nonaktif");

  const rawFormData = payload.form_data && typeof payload.form_data === "object" ? payload.form_data : {};
  const formData = Object.fromEntries(Object.entries(rawFormData).filter(([key]) => !key.startsWith("__")));
  validateFormData(master, formData);
  const requestNo = await generateRequestNo(supabase);
  const status = buildRequestStatus(master);
  const now = isoNow();
  const systemSnapshot = {
    master_revision: master.published_revision || 1,
    fields_schema_snapshot: clone(master.fields_schema),
    flow_schema_snapshot: clone(master.flow_schema),
    payment_instruction_snapshot: master.payment_instruction,
    captured_at: now,
  };
  const persistedFormData = { ...formData, __system: systemSnapshot };
  const row = {
    request_no: requestNo,
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
    form_data: persistedFormData,
    submitted_at: now,
    updated_at: now,
  };
  const { data, error } = await supabase.from(APPROVAL_REQUESTS_TABLE).insert(row).select("*").single();
  if (error) throw new Error(error.message || "Gagal membuat pengajuan");
  const reason = requestReason(formData);
  const { error: actionError } = await supabase.from(APPROVAL_ACTIONS_TABLE).insert({ request_id: data.id, step: 0, role: "warga", actor: row.requester_name || row.requester_house || "warga", action: "submit", note: reason ? `Alasan Pengajuan: ${reason}` : "Pengajuan dibuat oleh warga" });
  if (actionError) throw new Error(actionError.message || "Pengajuan dibuat tetapi riwayat awal gagal disimpan");
  return { ok: true, request: data, payment_instruction: master.payment_instruction, message: master.payment_required ? `Pengajuan berhasil. Silakan transfer Rp${master.payment_amount.toLocaleString("id-ID")} dan tunggu validasi ${status.current_approver_role || "pengurus"}.` : "Pengajuan berhasil dan sedang menunggu approval pengurus." };
}
