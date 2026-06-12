import { randomInt } from "crypto";
import { dbTable } from "@/lib/dbTable";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { recordAdminActivity } from "@/lib/adminActivity";
import { resolveAdminAccessRole } from "@/lib/adminRoles";

const APPROVAL_MASTERS_TABLE = dbTable("approval_masters");
const APPROVAL_REQUESTS_TABLE = dbTable("approval_requests");
const APPROVAL_ACTIONS_TABLE = dbTable("approval_actions");
const TERMINAL_STATUSES = ["completed", "rejected", "cancelled"];
const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 60;

const DEFAULT_FIELDS_SCHEMA = [
  { key: "requester_name", label: "Nama Warga", type: "text", required: true },
  { key: "requester_house", label: "Nomor Rumah", type: "text", required: true },
  { key: "requester_phone", label: "Nomor WhatsApp", type: "text", required: true },
  { key: "reason", label: "Alasan Pengajuan", type: "textarea", required: true },
];

const DEFAULT_FLOW_SCHEMA = [
  { step: 1, role: "bendahara", label: "Validasi Pembayaran", action: "validate_payment" },
  { step: 2, role: "ketua", label: "Approval Ketua", action: "final_approval" },
];

function clean(value) { return String(value || "").trim(); }
function isTerminalStatus(status) { return TERMINAL_STATUSES.includes(clean(status).toLowerCase()); }
function normalizeCode(value) { return clean(value).toUpperCase().replace(/[^A-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40); }
function safeNumber(value) { const number = Number(value || 0); return Number.isFinite(number) ? number : 0; }
function safeOffset(value) { return Math.max(0, Math.floor(safeNumber(value))); }
function safeLimit(value) { const parsed = Math.floor(safeNumber(value)); return parsed ? Math.min(Math.max(1, parsed), MAX_PAGE_LIMIT) : DEFAULT_PAGE_LIMIT; }
function safeSearch(value) { return clean(value).replace(/[%,()]/g, " ").replace(/\s+/g, " ").slice(0, 80); }
function requestReason(formData = {}) { return clean(formData.reason || formData.alasan); }

function parseSchema(value, fallback) {
  if (Array.isArray(value)) return value;
  if (!clean(value)) return fallback;
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : fallback; } catch { return fallback; }
}

function ensureFlow(flowSchema = []) {
  return [...(flowSchema || [])]
    .map((step, index) => ({ step: safeNumber(step.step) || index + 1, role: clean(step.role).toLowerCase(), label: clean(step.label) || `Approval Step ${index + 1}`, action: clean(step.action) || "approve" }))
    .filter((step) => step.role)
    .sort((a, b) => a.step - b.step);
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

function mapMaster(row = {}) {
  return { ...row, fields_schema: Array.isArray(row.fields_schema) ? row.fields_schema : DEFAULT_FIELDS_SCHEMA, flow_schema: Array.isArray(row.flow_schema) ? row.flow_schema : DEFAULT_FLOW_SCHEMA, payment_amount: safeNumber(row.payment_amount), payment_required: Boolean(row.payment_required), active: row.active !== false };
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
  return (data || []).map(mapMaster);
}

export async function getMasterManagementOverview() {
  return { ok: true, masters: await getApprovalMasters(), default_fields_schema: DEFAULT_FIELDS_SCHEMA, default_flow_schema: DEFAULT_FLOW_SCHEMA };
}

export async function saveApprovalMaster({ req, payload = {} }) {
  const supabase = getSupabaseAdmin();
  const id = clean(payload.id); const code = normalizeCode(payload.code || payload.name); const name = clean(payload.name);
  if (!code) throw new Error("Kode approval wajib diisi");
  if (!name) throw new Error("Nama approval wajib diisi");
  const row = { code, name, description: clean(payload.description), category: clean(payload.category) || "Umum", active: payload.active !== false, payment_required: Boolean(payload.payment_required), payment_amount: safeNumber(payload.payment_amount), payment_instruction: clean(payload.payment_instruction), fields_schema: parseSchema(payload.fields_schema, DEFAULT_FIELDS_SCHEMA), flow_schema: ensureFlow(parseSchema(payload.flow_schema, DEFAULT_FLOW_SCHEMA)), updated_at: new Date().toISOString() };
  const query = id ? supabase.from(APPROVAL_MASTERS_TABLE).update(row).eq("id", id).select("*").single() : supabase.from(APPROVAL_MASTERS_TABLE).insert(row).select("*").single();
  const { data, error } = await query;
  if (error) throw new Error(error.message || "Gagal menyimpan master approval");
  await recordAdminActivity(req, { type: id ? "update" : "create", module: "master-management", severity: "success", message: `${id ? "Update" : "Create"} approval master ${code}`, metadata: { access_role: "admin", code, id: data?.id || id } });
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
  if (!master?.id) throw new Error("Jenis pengajuan tidak ditemukan atau nonaktif");
  const formData = payload.form_data || {};
  validateFormData(master, formData);
  const requestNo = await generateRequestNo(supabase);
  const status = buildRequestStatus(master);
  const now = new Date().toISOString();
  const row = { request_no: requestNo, master_id: master.id, master_code: master.code, master_name: master.name, requester_house: clean(formData.requester_house || payload.requester_house), requester_name: clean(formData.requester_name || payload.requester_name), requester_phone: clean(formData.requester_phone || payload.requester_phone), status: status.status, current_step: status.current_step, current_approver_role: status.current_approver_role, amount: master.payment_required ? master.payment_amount : 0, payment_status: status.payment_status, form_data: formData, submitted_at: now, updated_at: now };
  const { data, error } = await supabase.from(APPROVAL_REQUESTS_TABLE).insert(row).select("*").single();
  if (error) throw new Error(error.message || "Gagal membuat pengajuan");
  const reason = requestReason(formData);
  await supabase.from(APPROVAL_ACTIONS_TABLE).insert({ request_id: data.id, step: 0, role: "warga", actor: row.requester_name || row.requester_house || "warga", action: "submit", note: reason ? `Alasan Pengajuan: ${reason}` : "Pengajuan dibuat oleh warga" });
  return { ok: true, request: data, payment_instruction: master.payment_instruction, message: master.payment_required ? `Pengajuan berhasil. Silakan transfer Rp${master.payment_amount.toLocaleString("id-ID")} dan tunggu validasi ${status.current_approver_role || "pengurus"}.` : "Pengajuan berhasil dan sedang menunggu approval pengurus." };
}
