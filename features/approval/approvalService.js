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

const DEFAULT_FIELDS_SCHEMA = [
  { key: "requester_name", label: "Nama Warga", type: "text", required: true, placeholder: "Nama lengkap" },
  { key: "requester_house", label: "Nomor Rumah", type: "text", required: true, placeholder: "Contoh: E3-3" },
  { key: "requester_phone", label: "Nomor WhatsApp", type: "text", required: true, placeholder: "08xxxxxxxxxx" },
  { key: "reason", label: "Alasan Pengajuan", type: "textarea", required: true, placeholder: "Jelaskan kebutuhan pengajuan" },
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
      return {
        ...field,
        key,
        label,
        type: clean(field?.type).toLowerCase() || "text",
        required: Boolean(field?.required),
        placeholder: clean(field?.placeholder),
        show_summary: field?.show_summary !== false,
        ...(options.length ? { options } : {}),
      };
    })
    .filter((field) => field.key && field.label);
}

function readFieldsEnvelope(value) {
  const parsed = parseJson(value);
  if (Array.isArray(parsed)) return { fields: ensureFields(parsed), meta: {} };
  if (parsed && typeof parsed === "object" && Array.isArray(parsed.fields)) {
    return { fields: ensureFields(parsed.fields), meta: parsed.meta && typeof parsed.meta === "object" ? parsed.meta : {} };
  }
  return { fields: ensureFields(DEFAULT_FIELDS_SCHEMA), meta: {} };
}

function packFieldsEnvelope(fields, meta = {}) {
  return {
    version: 1,
    meta: {
      lifecycle_status: normalizeLifecycle(meta.lifecycle_status, meta.active),
      icon: clean(meta.icon) || "📄",
      color: clean(meta.color) || "#2563eb",
    },
    fields: ensureFields(fields),
  };
}

function ensureFlow(flowSchema = []) {
  return [...(flowSchema || [])]
    .map((step, index) => ({
      ...step,
      step: index + 1,
      role: clean(step?.role).toLowerCase(),
      label: clean(step?.label) || `Approval Step ${index + 1}`,
      action: clean(step?.action).toLowerCase() || "approve",
    }))
    .filter((step) => step.role);
}

function getFirstStep(flowSchema = []) { return ensureFlow(flowSchema)[0] || null; }

function buildRequestStatus(master) {
  const firstStep = getFirstStep(master.flow_schema);
  if (!firstStep) return { status: "completed", current_step: null, current_approver_role: null, payment_status: master.payment_required ? "pending" : "not_required" };
  return { status: master.payment_required && firstStep.action === "validate_payment" ? "waiting_payment_validation" : "waiting_approval", current_step: firstStep.step, current_approver_role: firstStep.role, payment_status: master.payment_required ? "pending" : "not_required" };
}

function validateFormData(master, formData = {}) {
  const missing = (master.fields_schema || []).filter((field) => field.required).filter((field) => !clean(formData[field.key])).map((field) => field.label || field.key);
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

function mapMaster(row = {}) {
  const envelope = readFieldsEnvelope(row.fields_schema);
  const lifecycleStatus = normalizeLifecycle(envelope.meta.lifecycle_status, row.active !== false);
  return {
    ...row,
    fields_schema: envelope.fields,
    flow_schema: Array.isArray(row.flow_schema) ? ensureFlow(row.flow_schema) : DEFAULT_FLOW_SCHEMA,
    lifecycle_status: lifecycleStatus,
    icon: clean(envelope.meta.icon) || "📄",
    color: clean(envelope.meta.color) || "#2563eb",
    payment_amount: safeNumber(row.payment_amount),
    payment_required: Boolean(row.payment_required),
    active: lifecycleStatus === "active" && row.active !== false,
  };
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
  const now = new Date(); const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`; const prefix = `APR-${yearMonth}-`;
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
  return (data || []).map(mapMaster).filter((master) => !activeOnly || master.lifecycle_status === "active");
}

export async function getMasterManagementOverview() {
  return { ok: true, masters: await getApprovalMasters(), default_fields_schema: DEFAULT_FIELDS_SCHEMA, default_flow_schema: DEFAULT_FLOW_SCHEMA };
}

export async function saveApprovalMaster({ req, payload = {} }) {
  const supabase = getSupabaseAdmin();
  const id = clean(payload.id);
  const code = normalizeCode(payload.code || payload.name);
  const name = clean(payload.name);
  if (!code) throw new Error("Kode approval wajib diisi");
  if (!name) throw new Error("Nama approval wajib diisi");

  const parsedFields = readFieldsEnvelope(payload.fields_schema);
  const fields = ensureFields(parsedFields.fields);
  const flow = ensureFlow(parseSchema(payload.flow_schema, []));
  const lifecycleStatus = normalizeLifecycle(payload.lifecycle_status, payload.active !== false);
  const paymentRequired = Boolean(payload.payment_required);
  const paymentAmount = safeNumber(payload.payment_amount);

  if (lifecycleStatus === "active") validatePublishedMaster({ fields, flow, paymentRequired, paymentAmount });

  const row = {
    code,
    name,
    description: clean(payload.description),
    category: clean(payload.category) || "Umum",
    active: lifecycleStatus === "active",
    payment_required: paymentRequired,
    payment_amount: paymentAmount,
    payment_instruction: clean(payload.payment_instruction),
    fields_schema: packFieldsEnvelope(fields, {
      lifecycle_status: lifecycleStatus,
      active: lifecycleStatus === "active",
      icon: payload.icon || parsedFields.meta.icon,
      color: payload.color || parsedFields.meta.color,
    }),
    flow_schema: flow,
    updated_at: new Date().toISOString(),
  };

  const query = id
    ? supabase.from(APPROVAL_MASTERS_TABLE).update(row).eq("id", id).select("*").single()
    : supabase.from(APPROVAL_MASTERS_TABLE).insert(row).select("*").single();
  const { data, error } = await query;
  if (error) throw new Error(error.message || "Gagal menyimpan master approval");

  await recordAdminActivity(req, {
    type: id ? "update" : "create",
    module: "master-management",
    severity: "success",
    message: `${id ? "Update" : "Create"} approval master ${code} sebagai ${lifecycleStatus}`,
    metadata: { access_role: "admin", code, id: data?.id || id, lifecycle_status: lifecycleStatus },
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
  const masterId = clean(payload.master_id); const masterCode = normalizeCode(payload.master_code);
  let masterQuery = supabase.from(APPROVAL_MASTERS_TABLE).select("*").eq("active", true).limit(1);
  if (masterId) masterQuery = masterQuery.eq("id", masterId); else masterQuery = masterQuery.eq("code", masterCode);
  const { data: masters, error: masterError } = await masterQuery;
  if (masterError) throw new Error(masterError.message || "Gagal membaca master approval");
  const master = mapMaster(masters?.[0]);
  if (!master?.id || master.lifecycle_status !== "active") throw new Error("Jenis pengajuan tidak ditemukan atau nonaktif");
  const formData = payload.form_data || {};
  validateFormData(master, formData);
  const requestNo = await generateRequestNo(supabase);
  const status = buildRequestStatus(master);
  const now = new Date().toISOString();
  const row = { request_no: requestNo, master_id: master.id, master_code: master.code, master_name: master.name, requester_house: clean(formData.requester_house || payload.requester_house), requester_name: clean(formData.requester_name || payload.requester_name), requester_phone: clean(formData.requester_phone || payload.requester_phone), status: status.status, current_step: status.current_step, current_approver_role: status.current_approver_role, amount: master.payment_required ? master.payment_amount : 0, payment_status: status.payment_status, form_data: formData, submitted_at: now, updated_at: now };
  const { data, error } = await supabase.from(APPROVAL_REQUESTS_TABLE).insert(row).select("*").single();
  if (error) throw new Error(error.message || "Gagal membuat pengajuan");
  const reason = requestReason(formData);
  const { error: actionError } = await supabase.from(APPROVAL_ACTIONS_TABLE).insert({ request_id: data.id, step: 0, role: "warga", actor: row.requester_name || row.requester_house || "warga", action: "submit", note: reason ? `Alasan Pengajuan: ${reason}` : "Pengajuan dibuat oleh warga" });
  if (actionError) throw new Error(actionError.message || "Pengajuan dibuat tetapi riwayat awal gagal disimpan");
  return { ok: true, request: data, payment_instruction: master.payment_instruction, message: master.payment_required ? `Pengajuan berhasil. Silakan transfer Rp${master.payment_amount.toLocaleString("id-ID")} dan tunggu validasi ${status.current_approver_role || "pengurus"}.` : "Pengajuan berhasil dan sedang menunggu approval pengurus." };
}
