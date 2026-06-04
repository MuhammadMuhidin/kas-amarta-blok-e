import { NextResponse } from "next/server";
import { getSheets } from "@/lib/google";
import { generateId } from "@/lib/id";
import { getAppConfig } from "@/lib/appConfig";
import { recordAdminActivity } from "@/lib/adminActivity";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import {
  enforceRateLimit,
  RATE_LIMIT_SCOPES,
} from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const spreadsheetId = process.env.SPREADSHEET_ID;

function normalize(value) {
  return String(value || "").trim();
}

function normalizeUpper(value) {
  return normalize(value).toUpperCase();
}

function isActiveMember(row) {
  return ["Y", "YES", "TRUE", "1"].includes(normalizeUpper(row[4]));
}

function isJoinedByPeriod(row, period) {
  const joinPeriod = normalize(row[5]).slice(0, 7);
  return !joinPeriod || joinPeriod <= period;
}

function buildAdvanceRefId(personId, period) {
  return `TRASHADV-${normalize(personId)}-${normalize(period)}`;
}

function buildAdvanceNote(house, period) {
  return `Talangan Sampah ${house} Periode ${period}`;
}

export async function POST(req) {
  try {
    if (!(await isAdmin(req))) {
      return unauthorized();
    }

    if (!validateCSRF(req)) {
      return NextResponse.json({ error: "Invalid CSRF" }, { status: 403 });
    }

    const body = await req.json();
    const period = normalize(body.period);

    if (!/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json({ error: "Valid period is required" }, { status: 400 });
    }

    const rateLimit = await enforceRateLimit(
      req,
      RATE_LIMIT_SCOPES.cashflowCreate,
      { identity: "session", targetId: `trash-advance-${period}` },
    );

    if (rateLimit) return rateLimit;

    const appConfig = await getAppConfig();
    const trashFee = Number(appConfig?.trash_fee || 0);

    if (!Number.isFinite(trashFee) || trashFee <= 0) {
      return NextResponse.json({ error: "Trash fee is not configured" }, { status: 400 });
    }

    const sheets = await getSheets();
    const today = new Date().toISOString().slice(0, 10);

    const [personalRes, paymentRes, trashRes, cashflowRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId, range: "Personal!A:F" }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: "Payment!A:G" }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: "Trash!A:D" }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: "Cashflow!A:G" }),
    ]);

    const personalRows = personalRes.data.values || [];
    const paymentRows = paymentRes.data.values || [];
    const trashRows = trashRes.data.values || [];
    const cashflowRows = cashflowRes.data.values || [];

    const paymentMap = new Map(paymentRows.slice(1).map((row) => [normalize(row[0]), row]));
    const paidPersonIds = new Set(
      trashRows
        .slice(1)
        .map((row) => paymentMap.get(normalize(row[1])))
        .filter((payment) => payment && normalize(payment[4]) === period)
        .map((payment) => normalize(payment[1]))
        .filter(Boolean),
    );
    const existingAdvanceRefs = new Set(
      cashflowRows
        .slice(1)
        .map((row) => normalize(row[1]))
        .filter((refId) => refId.startsWith("TRASHADV-")),
    );

    const trashMembers = personalRows
      .slice(1)
      .filter((row) => isActiveMember(row))
      .filter((row) => normalizeUpper(row[3]) === "Y")
      .filter((row) => isJoinedByPeriod(row, period));

    const unpaidMembers = trashMembers.filter((row) => !paidPersonIds.has(normalize(row[0])));
    const values = [];
    const advancedMembers = [];
    const skippedMembers = [];

    unpaidMembers.forEach((member) => {
      const personId = normalize(member[0]);
      const house = normalize(member[1]);
      const name = normalize(member[2]);
      const refId = buildAdvanceRefId(personId, period);

      if (!personId || !house || existingAdvanceRefs.has(refId)) {
        skippedMembers.push({ person_id: personId, house, name, ref_id: refId });
        return;
      }

      const cashflowId = generateId("CSFLOW-");
      values.push([
        cashflowId,
        refId,
        "expense",
        trashFee,
        buildAdvanceNote(house, period),
        today,
        "",
      ]);
      advancedMembers.push({ person_id: personId, house, name, ref_id: refId, cashflow_id: cashflowId });
    });

    if (values.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Cashflow!A:G",
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
      });
    }

    await recordAdminActivity(req, {
      type: values.length > 0 ? "create" : "idempotent",
      module: "trash",
      severity: values.length > 0 ? "warning" : "info",
      message: `Advance unpaid trash ${period}: ${values.length} cashflow expense`,
      metadata: {
        period,
        trash_fee: trashFee,
        advanced: values.length,
        skipped: skippedMembers.length,
        total_amount: values.length * trashFee,
        advanced_members: advancedMembers,
        skipped_members: skippedMembers,
      },
    });

    return NextResponse.json({
      success: true,
      period,
      advanced: values.length,
      skipped: skippedMembers.length,
      total: values.length * trashFee,
      trash_fee: trashFee,
      advanced_members: advancedMembers,
      skipped_members: skippedMembers,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
