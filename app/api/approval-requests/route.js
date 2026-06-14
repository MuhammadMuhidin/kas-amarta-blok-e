import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getApprovalMaster, getApprovalMasters, submitApprovalRequest } from "@/features/approval/approvalService";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { dbTable } from "@/lib/dbTable";
import { notifyRequesterCreated, notifyRoleNewRequest } from "@/lib/approvalWhatsApp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APPROVAL_MASTERS_TABLE = dbTable("approval_masters");
const APPROVAL_REQUESTS_TABLE = dbTable("approval_requests");
const APPROVAL_ACTIONS_TABLE = dbTable("approval_actions");
const ATTACHMENT_BUCKET = process.env.SUPABASE_APPROVAL_ATTACHMENTS_BUCKET || "approval-attachments";
const MAX_TOTAL_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_UPLOAD_FIELDS = 8;

function clean(value) {
  return String(value || "").trim();
}

function maskResidentName(value) {
  const words = clean(value).split(/\s+/).filter(Boolean);
  if (!words.length) return "-";

  return words.map((word) => {
    const characters = [...word];
    if (!characters.length) return "";
    return `${characters[0]}${"•".repeat(Math.max(characters.length - 1, 1))}`;
  }).join(" ");
}

function maskResidentHouse(value) {
  const raw = clean(value).normalize("NFKC").toUpperCase();
  if (!raw) return "-";

  const normalized = raw
    .replace(/^\s*(?:BLOK|BLK)\s+/i, "")
    .replace(/\b(?:NOMOR|NO|UNIT)\b\.?/gi, "-")
    .replace(/[\/#]/g, "-")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  const separated = normalized.match(/^([A-Z]+\s*\d+)\s*(?:-|\s)\s*\d+\b/i);
  if (separated) return `${separated[1].replace(/\s+/g, "")}-•`;

  const compact = normalized.replace(/[^A-Z0-9]/g, "");
  const compactMatch = compact.match(/^([A-Z]+)(\d{2,})$/i);
  if (compactMatch) {
    const [, letters, digits] = compactMatch;
    return `${letters}${digits.slice(0, -1)}-•`;
  }

  const blockOnly = normalized.match(/([A-Z]+\s*\d+)/i);
  if (blockOnly) return `${blockOnly[1].replace(/\s+/g, "")}-•`;

  return "•••";
}

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function requestReason(row = {}) {
  return clean(row.form_data?.reason || row.form_data?.alasan || row.reason);
}

function publicRequest(row = {}) {
  return {
    id: row.id,
    request_no: row.request_no,
    master_name: row.master_name,
    master_code: row.master_code,
    status: row.status,
    current_step: row.current_step,
    current_approver_role: row.current_approver_role,
    amount: row.amount,
    payment_status: row.payment_status,
    submitted_at: row.submitted_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at,
    requester_name: maskResidentName(row.requester_name),
    requester_house: maskResidentHouse(row.requester_house),
    reason: requestReason(row),
  };
}

function publicAction(row = {}) {
  const isResidentAction = clean(row.role).toLowerCase() === "warga" || clean(row.action).toLowerCase() === "submit";
  return {
    id: row.id,
    step: row.step,
    role: row.role,
    actor: isResidentAction ? maskResidentName(row.actor) : row.actor,
    action: row.action,
    note: row.note,
    created_at: row.created_at,
  };
}

function publicFlowStep(row = {}, index = 0) {
  return {
    step: number(row.step) || index + 1,
    role: clean(row.role).toLowerCase(),
    label: clean(row.label),
    action: clean(row.action) || "approve",
  };
}

function normalizeFlow(value = []) {
  return [...(Array.isArray(value) ? value : [])]
    .map(publicFlowStep)
    .filter((step) => step.role)
    .sort((a, b) => a.step - b.step);
}

async function readPublicFlowSchema({ supabase, request }) {
  const snapshot = request.form_data?.__system?.flow_schema_snapshot;
  if (Array.isArray(snapshot)) return normalizeFlow(snapshot);

  let query = supabase.from(APPROVAL_MASTERS_TABLE).select("flow_schema").limit(1);
  if (request.master_id) query = query.eq("id", request.master_id);
  else query = query.eq("code", request.master_code);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message || "Gagal membaca alur pengajuan");
  return normalizeFlow(data?.flow_schema);
}

async function checkStatusByRequestNo(requestNo) {
  const supabase = getSupabaseAdmin();
  const no = clean(requestNo).toUpperCase();
  if (!no) throw new Error("Nomor pengajuan wajib diisi");

  const { data: request, error } = await supabase
    .from(APPROVAL_REQUESTS_TABLE)
    .select("*")
    .eq("request_no", no)
    .maybeSingle();
  if (error) throw new Error(error.message || "Gagal cek status pengajuan");
  if (!request) throw new Error("Pengajuan tidak ditemukan");

  const [{ data: actions, error: actionsError }, flowSchema] = await Promise.all([
    supabase
      .from(APPROVAL_ACTIONS_TABLE)
      .select("*")
      .eq("request_id", request.id)
      .order("created_at", { ascending: true }),
    readPublicFlowSchema({ supabase, request }),
  ]);
  if (actionsError) throw new Error(actionsError.message || "Gagal membaca riwayat pengajuan");

  return {
    ok: true,
    request: publicRequest(request),
    flow_schema: flowSchema,
    actions: (actions || []).map(publicAction),
  };
}

function safeFileName(value) {
  const raw = clean(value).normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return raw.replace(/^[-.]+|[-.]+$/g, "").slice(0, 100) || "attachment";
}

function acceptedMimeTypes(field = {}) {
  return clean(field.accept)
    .split(",")
    .map((item) => clean(item).toLowerCase())
    .filter(Boolean);
}

function mimeAccepted(fileType, accepted = []) {
  if (!accepted.length) return true;
  const type = clean(fileType).toLowerCase();
  return accepted.some((rule) => rule.endsWith("/*") ? type.startsWith(rule.slice(0, -1)) : type === rule);
}

async function ensureAttachmentBucket(supabase) {
  const { data, error } = await supabase.storage.getBucket(ATTACHMENT_BUCKET);
  if (data) return;
  const message = clean(error?.message).toLowerCase();
  if (error && !message.includes("not found") && !message.includes("does not exist")) throw new Error(error.message);
  const { error: createError } = await supabase.storage.createBucket(ATTACHMENT_BUCKET, {
    public: false,
    fileSizeLimit: MAX_TOTAL_UPLOAD_BYTES,
    allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  });
  if (createError && !clean(createError.message).toLowerCase().includes("already exists")) {
    throw new Error(createError.message || "Gagal menyiapkan penyimpanan lampiran");
  }
}

async function parseSubmission(req) {
  const contentType = clean(req.headers.get("content-type")).toLowerCase();
  if (!contentType.includes("multipart/form-data")) {
    return { payload: await req.json(), multipart: null };
  }

  const multipart = await req.formData();
  const rawPayload = multipart.get("payload");
  if (!rawPayload) throw new Error("Payload pengajuan tidak ditemukan");
  let payload;
  try {
    payload = JSON.parse(String(rawPayload));
  } catch {
    throw new Error("Payload pengajuan tidak valid");
  }
  return { payload, multipart };
}

async function uploadSubmissionAttachments({ payload, multipart }) {
  if (!multipart) return { payload, uploadedPaths: [] };
  const master = await getApprovalMaster({ id: payload.master_id, code: payload.master_code, activeOnly: true });
  if (!master) throw new Error("Jenis pengajuan tidak ditemukan atau nonaktif");

  const uploadFields = (master.fields_schema || []).filter((field) => ["image", "file"].includes(field.type));
  if (uploadFields.length > MAX_UPLOAD_FIELDS) throw new Error(`Maksimal ${MAX_UPLOAD_FIELDS} field upload per pengajuan`);

  const files = uploadFields
    .map((field) => ({ field, file: multipart.get(`attachment:${field.key}`) }))
    .filter(({ file }) => file && typeof file.arrayBuffer === "function" && file.size > 0);
  const totalBytes = files.reduce((total, item) => total + Number(item.file.size || 0), 0);
  if (totalBytes > MAX_TOTAL_UPLOAD_BYTES) throw new Error("Total ukuran lampiran maksimal 25 MB");
  if (!files.length) return { payload, uploadedPaths: [] };

  const supabase = getSupabaseAdmin();
  await ensureAttachmentBucket(supabase);
  const uploadedPaths = [];
  const nextFormData = { ...(payload.form_data || {}) };

  try {
    for (const { field, file } of files) {
      const maxBytes = Math.min(Math.max(number(field.max_size_mb) || (field.type === "image" ? 5 : 10), 1), 20) * 1024 * 1024;
      if (file.size > maxBytes) throw new Error(`${field.label} maksimal ${Math.round(maxBytes / 1024 / 1024)} MB`);
      const accepted = acceptedMimeTypes(field);
      if (!mimeAccepted(file.type, accepted)) throw new Error(`Format file untuk ${field.label} tidak diizinkan`);
      if (field.type === "image" && !clean(file.type).toLowerCase().startsWith("image/")) throw new Error(`${field.label} harus berupa gambar`);

      const year = new Date().getUTCFullYear();
      const path = `${safeFileName(master.code).toLowerCase()}/${year}/${randomUUID()}-${safeFileName(file.name)}`;
      const bytes = Buffer.from(await file.arrayBuffer());
      const { error } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(path, bytes, {
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw new Error(error.message || `Gagal mengunggah ${field.label}`);
      uploadedPaths.push(path);
      nextFormData[field.key] = {
        kind: "attachment",
        bucket: ATTACHMENT_BUCKET,
        path,
        name: safeFileName(file.name),
        original_name: clean(file.name),
        type: clean(file.type) || "application/octet-stream",
        size: Number(file.size || 0),
      };
    }
    return { payload: { ...payload, form_data: nextFormData }, uploadedPaths };
  } catch (error) {
    if (uploadedPaths.length) await supabase.storage.from(ATTACHMENT_BUCKET).remove(uploadedPaths);
    throw error;
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const requestNo = searchParams.get("request_no");
    if (requestNo) {
      return NextResponse.json(await checkStatusByRequestNo(requestNo), {
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      });
    }
    const masters = await getApprovalMasters({ activeOnly: true });
    return NextResponse.json({ ok: true, masters });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal membaca approval requests" }, { status: 500 });
  }
}

export async function POST(req) {
  let uploadedPaths = [];
  try {
    const parsed = await parseSubmission(req);
    const uploaded = await uploadSubmissionAttachments(parsed);
    uploadedPaths = uploaded.uploadedPaths;
    const result = await submitApprovalRequest(uploaded.payload);
    const [requesterWhatsapp, firstApproverWhatsapp] = await Promise.all([
      notifyRequesterCreated(result),
      notifyRoleNewRequest({ request: result.request }),
    ]);

    return NextResponse.json({
      ...result,
      whatsapp_sent: requesterWhatsapp.sent,
      whatsapp_status: requesterWhatsapp,
      first_approver_whatsapp_sent: firstApproverWhatsapp.sent,
      first_approver_whatsapp_status: firstApproverWhatsapp,
    });
  } catch (err) {
    if (uploadedPaths.length) {
      try { await getSupabaseAdmin().storage.from(ATTACHMENT_BUCKET).remove(uploadedPaths); } catch {}
    }
    const message = err.message || "Gagal membuat approval request";
    const isValidation = /wajib|maksimal|format|tidak valid|tidak ditemukan|harus berupa|tidak diizinkan/i.test(message);
    return NextResponse.json({ error: message }, { status: isValidation ? 400 : 500 });
  }
}
