import { NextResponse } from "next/server";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { getCurrentAdminSession } from "@/lib/adminSession";
import { getApprovalCenterOverview } from "@/features/approval/approvalService";
import { processApprovalAction } from "@/features/approval/approvalActionService";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { dbTable } from "@/lib/dbTable";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APPROVAL_ACTIONS_TABLE = dbTable("approval_actions");
const DONE = ["completed", "rejected", "cancelled"];

function clean(value) {
  return String(value || "").trim();
}

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function terminal(status) {
  return DONE.includes(clean(status).toLowerCase());
}

function flowSteps(value = []) {
  return [...(Array.isArray(value) ? value : [])]
    .map((step, index) => ({
      step: number(step.step) || index + 1,
      role: clean(step.role).toLowerCase(),
      label: clean(step.label),
      action: clean(step.action) || "approve",
    }))
    .filter((step) => step.role)
    .sort((a, b) => a.step - b.step);
}

function snapshotFlow(request = {}) {
  return flowSteps(request.form_data?.__system?.flow_schema_snapshot || []);
}

function uniqueRows(rows = []) {
  const map = new Map();
  for (const row of rows) {
    if (row?.id) map.set(row.id, row);
  }
  return [...map.values()];
}

function canBeInbox(row, role) {
  if (!row || terminal(row.status) || !clean(row.current_approver_role)) return false;
  return role === "admin" || clean(row.current_approver_role).toLowerCase() === role;
}

function normalizeCenterPayload(payload = {}) {
  const role = clean(payload.access_role).toLowerCase() || "admin";
  const rows = uniqueRows([...(payload.inbox || []), ...(payload.requests || [])]);
  const safeInbox = rows.filter((row) => canBeInbox(row, role));

  return {
    ...payload,
    access_role: role,
    inbox: safeInbox,
    requests: rows,
    summary: payload.summary || {
      inbox: safeInbox.length,
      processing: rows.filter((row) => !terminal(row.status)).length,
      completed: rows.filter((row) => row.status === "completed").length,
      rejected: rows.filter((row) => row.status === "rejected").length,
    },
  };
}

function publicSubmissionData(row = {}) {
  return Object.fromEntries(Object.entries(row.form_data || {}).filter(([key]) => !key.startsWith("__")));
}

async function signAttachment(supabase, value) {
  if (!value || typeof value !== "object" || value.kind !== "attachment" || !value.bucket || !value.path) return value;
  const { data, error } = await supabase.storage.from(value.bucket).createSignedUrl(value.path, 60 * 60);
  return {
    ...value,
    signed_url: error ? "" : data?.signedUrl || "",
    preview_error: error?.message || "",
  };
}

async function attachSubmissionDetails(supabase, row) {
  const formData = publicSubmissionData(row);
  const signedEntries = await Promise.all(
    Object.entries(formData).map(async ([key, value]) => [key, await signAttachment(supabase, value)]),
  );
  return {
    ...row,
    form_data: Object.fromEntries(signedEntries),
    fields_schema_snapshot: Array.isArray(row.form_data?.__system?.fields_schema_snapshot)
      ? row.form_data.__system.fields_schema_snapshot
      : [],
    flow_schema_snapshot: snapshotFlow(row),
    master_revision: number(row.form_data?.__system?.master_revision) || 1,
  };
}

async function withActions(payload) {
  const rows = uniqueRows([...(payload.inbox || []), ...(payload.requests || [])]);
  const ids = rows.map((row) => row.id).filter(Boolean);
  if (!ids.length) return normalizeCenterPayload(payload);

  const supabase = getSupabaseAdmin();
  const { data: actions, error } = await supabase
    .from(APPROVAL_ACTIONS_TABLE)
    .select("*")
    .in("request_id", ids)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message || "Gagal membaca riwayat approval");

  const grouped = new Map();
  for (const action of actions || []) {
    if (!grouped.has(action.request_id)) grouped.set(action.request_id, []);
    grouped.get(action.request_id).push(action);
  }

  const detailedRows = await Promise.all(rows.map(async (row) => ({
    ...(await attachSubmissionDetails(supabase, row)),
    approval_actions: grouped.get(row.id) || [],
  })));
  const detailedMap = new Map(detailedRows.map((row) => [row.id, row]));
  const attach = (row) => detailedMap.get(row.id) || row;

  return normalizeCenterPayload({
    ...payload,
    inbox: (payload.inbox || []).map(attach),
    requests: (payload.requests || []).map(attach),
  });
}

export async function GET(req) {
  try {
    if (!(await isAdmin(req))) return unauthorized();
    const session = await getCurrentAdminSession(req);
    const { searchParams } = new URL(req.url);
    const payload = await getApprovalCenterOverview({
      accessRole: session?.access_role || "admin",
      offset: searchParams.get("offset"),
      limit: searchParams.get("limit"),
      filter: searchParams.get("filter"),
      search: searchParams.get("q") || searchParams.get("search"),
    });
    return NextResponse.json(await withActions(payload));
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal membaca approval requests" }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    if (!(await isAdmin(req))) return unauthorized();
    if (!validateCSRF(req)) return NextResponse.json({ error: "CSRF tidak valid" }, { status: 403 });
    const session = await getCurrentAdminSession(req);
    const body = await req.json();
    return NextResponse.json(await processApprovalAction({
      req,
      accessRole: session?.access_role || "admin",
      id: body.id,
      action: body.action,
      note: body.note,
      actor: session?.access_role || "admin",
      source: "web",
    }));
  } catch (err) {
    const message = err.message || "Gagal memproses approval request";
    const conflict = message.includes("pengguna lain") || message.includes("sudah selesai");
    const validation = message.includes("wajib diisi") || message.includes("belum masuk ke role");
    return NextResponse.json({ error: message }, { status: conflict ? 409 : validation ? 400 : 500 });
  }
}
