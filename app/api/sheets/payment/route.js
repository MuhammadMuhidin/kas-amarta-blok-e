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

async function ensurePaymentCashflow({ sheets, paymentId, personHouse, period, amount, date }) {
  const cashflowRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Cashflow!A:F",
  });

  const cashflowRows = cashflowRes.data.values || [];
  const hasCashflow = cashflowRows.slice(1).some((r) => normalize(r[1]) === normalize(paymentId));

  if (hasCashflow) return false;

  const note = `Pembayaran Kas ${personHouse} Periode ${period}`;

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Cashflow!A:F",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[generateId("CSFLOW-"), paymentId, "income", amount, note, date]],
    },
  });

  return true;
}

async function ensurePaymentTrash({ sheets, paymentId, member, date }) {
  const isTrashUser = normalize(member?.[3]).toUpperCase() === "Y";

  if (!isTrashUser) return false;

  const appConfig = await getAppConfig();
  const trashAmount = Number(appConfig?.trash_fee || 0);

  if (!trashAmount) {
    throw new Error("Tarif sampah belum dikonfigurasi.");
  }

  const trashRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Trash!A:D",
  });

  const trashRows = trashRes.data.values || [];
  const hasTrash = trashRows.slice(1).some((r) => normalize(r[1]) === normalize(paymentId));

  if (hasTrash) return false;

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Trash!A:D",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[generateId("TRASH-"), paymentId, trashAmount, date]],
    },
  });

  return true;
}

export async function GET(req) {
  if (!(await isAdmin(req))) {
    return unauthorized();
  }

  const sheets = await getSheets();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Payment!A:G",
  });

  const rows = res.data.values || [];

  const data = rows.slice(1).map((r) => ({
    id: r[0],
    person_id: r[1],
    person_house: r[2],
    person_name: r[3],
    period: r[4],
    amount: Number(r[5]) || 0,
    date: r[6],
  }));

  return NextResponse.json(data);
}

export async function POST(req) {
  if (!(await isAdmin(req))) {
    return unauthorized();
  }

  if (!validateCSRF(req)) {
    return NextResponse.json({ error: "Invalid CSRF" }, { status: 403 });
  }

  const body = await req.json();
  const house = normalize(body.house);
  const period = normalize(body.period);
  const amount = Number(body.amount || 0);
  const bulkBatchId = normalize(body.bulk_batch_id);
  const bulkIndex = Number(body.bulk_index || 0);

  if (bulkBatchId) {
    if (bulkIndex === 0) {
      const bulkLimit = await enforceRateLimit(
        req,
        RATE_LIMIT_SCOPES.paymentBulkCreate,
        {
          identity: "session",
          targetId: `${period}:${bulkBatchId}`,
        },
      );

      if (bulkLimit) return bulkLimit;
    }
  } else {
    const paymentLimit = await enforceRateLimit(
      req,
      RATE_LIMIT_SCOPES.paymentCreate,
      {
        identity: "session",
        targetId: period,
      },
    );

    if (paymentLimit) return paymentLimit;
  }

  if (!house || !period || !amount) {
    return NextResponse.json(
      { error: "House, period, and amount are required" },
      { status: 400 },
    );
  }

  const sheets = await getSheets();
  const today = new Date().toISOString().slice(0, 10);

  const personalRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Personal!A:F",
  });

  const personalRows = personalRes.data.values || [];
  const member = personalRows.slice(1).find((r) => normalize(r[1]) === house);

  if (!member) {
    return NextResponse.json({ error: "House not found" }, { status: 404 });
  }

  const person_id = member[0];
  const person_house = member[1];
  const person_name = member[2];

  const paymentRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Payment!A:G",
  });

  const paymentRows = paymentRes.data.values || [];
  const existingPayment = paymentRows.slice(1).find((r) => {
    const samePerson = normalize(r[1]) === normalize(person_id);
    const sameHouse = normalize(r[2]) === normalize(person_house);
    const samePeriod = normalize(r[4]) === period;

    return samePeriod && (samePerson || sameHouse);
  });

  if (existingPayment) {
    const existingPaymentId = existingPayment[0];
    const existingPaymentAmount = Number(existingPayment[5]) || amount;
    const existingPaymentDate = existingPayment[6] || today;
    const cashflowRecovered = await ensurePaymentCashflow({
      sheets,
      paymentId: existingPaymentId,
      personHouse: existingPayment[2] || person_house,
      period,
      amount: existingPaymentAmount,
      date: existingPaymentDate,
    });
    const trashRecovered = await ensurePaymentTrash({
      sheets,
      paymentId: existingPaymentId,
      member,
      date: existingPaymentDate,
    });

    await recordAdminActivity(req, {
      type: "idempotent",
      module: "payment",
      severity: "info",
      message: `Reuse existing payment ${person_house} ${period}`,
      metadata: {
        payment_id: existingPaymentId,
        person_id,
        house: person_house,
        name: person_name,
        period,
        amount: existingPaymentAmount,
        cashflow_recovered: cashflowRecovered,
        trash_recovered: trashRecovered,
        bulk_batch_id: bulkBatchId || null,
      },
    });

    return NextResponse.json({
      success: true,
      existing: true,
      cashflow_recovered: cashflowRecovered,
      trash_recovered: trashRecovered,
      payment_id: existingPaymentId,
    });
  }

  const paymentId = generateId("PAY-");

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Payment!A:G",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[paymentId, person_id, person_house, person_name, period, amount, today]],
    },
  });

  const cashflowRecorded = await ensurePaymentCashflow({
    sheets,
    paymentId,
    personHouse: person_house,
    period,
    amount,
    date: today,
  });
  const trashRecorded = await ensurePaymentTrash({ sheets, paymentId, member, date: today });

  await recordAdminActivity(req, {
    type: "create",
    module: "payment",
    severity: "success",
    message: `Record payment ${person_house} ${period}`,
    metadata: {
      payment_id: paymentId,
      person_id,
      house: person_house,
      name: person_name,
      period,
      amount,
      cashflow_recorded: cashflowRecorded,
      trash_recorded: trashRecorded,
      bulk_batch_id: bulkBatchId || null,
    },
  });

  return NextResponse.json({
    success: true,
    payment_id: paymentId,
    cashflow_recorded: cashflowRecorded,
    trash_recorded: trashRecorded,
  });
}
