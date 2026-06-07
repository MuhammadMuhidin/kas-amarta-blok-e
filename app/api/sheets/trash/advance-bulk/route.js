import { NextResponse } from "next/server";
import { dbTable } from "@/lib/dbTable";
import { generateId } from "@/lib/id";
import { getAppConfig } from "@/lib/appConfig";
import { recordAdminActivity } from "@/lib/adminActivity";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  enforceRateLimit,
  RATE_LIMIT_SCOPES,
} from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const PERSONAL_TABLE = dbTable("personal");
const PAYMENT_TABLE = dbTable("payment");
const CASHFLOW_TABLE = dbTable("cashflow");
const TRASH_TABLE = dbTable("trash");

function normalize(value) {
  return String(value || "").trim();
}

function normalizeUpper(value) {
  return normalize(value).toUpperCase();
}

function isActiveMember(row) {
  return ["Y", "YES", "TRUE", "1"].includes(normalizeUpper(row.active));
}

function isJoinedByPeriod(row, period) {
  const joinPeriod = normalize(row.join_date).slice(0, 7);
  return !joinPeriod || joinPeriod <= period;
}

function buildAdvanceRefId(personId, period) {
  return `TRASHADV-${normalize(personId)}-${normalize(period)}`;
}

function buildAdvanceNote(house, period) {
  return `Talangan Iuran Sampah ${house} Periode ${period}`;
}

export async function POST(req) {
  try {
    if (!(await isAdmin(req))) return unauthorized();
    if (!validateCSRF(req)) return NextResponse.json({ error: "Invalid CSRF" }, { status: 403 });

    const body = await req.json();
    const period = normalize(body.period);

    if (!/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json({ error: "Valid period is required" }, { status: 400 });
    }

    const rateLimit = await enforceRateLimit(req, RATE_LIMIT_SCOPES.cashflowCreate, { identity: "session", targetId: `trash-advance-${period}` });
    if (rateLimit) return rateLimit;

    const appConfig = await getAppConfig();
    const trashFee = Number(appConfig?.trash_fee || 0);

    if (!Number.isFinite(trashFee) || trashFee <= 0) {
      return NextResponse.json({ error: "Trash fee is not configured" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);

    const [personalRes, paymentRes, trashRes, cashflowRes] = await Promise.all([
      supabase.from(PERSONAL_TABLE).select("id,house,name,trash,active,join_date"),
      supabase.from(PAYMENT_TABLE).select("id,person_id,person_house,person_name,period,amount,date"),
      supabase.from(TRASH_TABLE).select("id,payment_id,amount,date"),
      supabase.from(CASHFLOW_TABLE).select("id,payment_id,type,amount,note,date,receipt_url"),
    ]);

    if (personalRes.error) throw personalRes.error;
    if (paymentRes.error) throw paymentRes.error;
    if (trashRes.error) throw trashRes.error;
    if (cashflowRes.error) throw cashflowRes.error;

    const paymentMap = new Map((paymentRes.data || []).map((row) => [normalize(row.id), row]));
    const paidPersonIds = new Set(
      (trashRes.data || [])
        .map((row) => paymentMap.get(normalize(row.payment_id)))
        .filter((payment) => payment && normalize(payment.period) === period)
        .map((payment) => normalize(payment.person_id))
        .filter(Boolean),
    );
    const existingAdvanceRefs = new Set(
      (cashflowRes.data || [])
        .map((row) => normalize(row.payment_id))
        .filter((paymentId) => paymentId.startsWith("TRASHADV-")),
    );

    const trashMembers = (personalRes.data || [])
      .filter((row) => isActiveMember(row))
      .filter((row) => normalizeUpper(row.trash) === "Y")
      .filter((row) => isJoinedByPeriod(row, period));
    const unpaidMembers = trashMembers.filter((row) => !paidPersonIds.has(normalize(row.id)));
    const values = [];
    const advancedMembers = [];
    const skippedMembers = [];

    unpaidMembers.forEach((member) => {
      const personId = normalize(member.id);
      const house = normalize(member.house);
      const name = normalize(member.name);
      const paymentId = buildAdvanceRefId(personId, period);

      if (!personId || !house || existingAdvanceRefs.has(paymentId)) {
        skippedMembers.push({ person_id: personId, house, name, ref_id: paymentId, payment_id: paymentId });
        return;
      }

      const cashflowId = generateId("CSFLOW-");
      values.push({
        id: cashflowId,
        payment_id: paymentId,
        type: "expense",
        amount: trashFee,
        note: buildAdvanceNote(house, period),
        date: today,
        receipt_url: "",
      });
      advancedMembers.push({ person_id: personId, house, name, ref_id: paymentId, payment_id: paymentId, cashflow_id: cashflowId });
    });

    if (values.length > 0) {
      const { error } = await supabase.from(CASHFLOW_TABLE).insert(values);
      if (error) throw error;
    }

    await recordAdminActivity(req, {
      type: values.length > 0 ? "create" : "idempotent",
      module: "trash",
      severity: values.length > 0 ? "warning" : "info",
      message: `Advance unpaid trash ${period}: ${values.length} cashflow expense`,
      metadata: { period, trash_fee: trashFee, advanced: values.length, skipped: skippedMembers.length, total_amount: values.length * trashFee, advanced_members: advancedMembers, skipped_members: skippedMembers },
    });

    return NextResponse.json({ success: true, period, advanced: values.length, skipped: skippedMembers.length, total: values.length * trashFee, trash_fee: trashFee, advanced_members: advancedMembers, skipped_members: skippedMembers });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
