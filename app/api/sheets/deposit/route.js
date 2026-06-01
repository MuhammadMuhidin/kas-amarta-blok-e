import { NextResponse } from "next/server";
import { getSheets } from "@/lib/google";
import { generateId } from "@/lib/id";
import { getAppConfig } from "@/lib/appConfig";
import { recordAdminActivity } from "@/lib/adminActivity";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import {
  getCurrentPeriod,
  sortDeposits,
} from "@/lib/depositUtils";

export const dynamic = "force-dynamic";

const spreadsheetId = process.env.SPREADSHEET_ID;

function normalize(value) {
  return String(value || "").trim();
}

function numberParam(value, fallback) {
  const parsed = Number(value || fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
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

async function ensureTrashPayment({ sheets, paymentId, trashAmount, date }) {
  if (trashAmount <= 0) return false;

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
  const sheets = await getSheets();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Deposit!A:K",
  });

  const rows = res.data.values || [];

  const data = rows.slice(1).map((r) => ({
    id: r[0],
    person_id: r[1],
    house: r[2],
    name: r[3],
    period: r[4],
    amount: Number(r[5]) || 0,
    trash_amount: Number(r[6]) || 0,
    status: r[7],
    created_at: r[8],
    paid_at: r[9],
    payment_id: r[10],
  }));

  const { searchParams } = new URL(req.url);
  const paginated = searchParams.has("page") || searchParams.has("limit");

  if (!paginated) {
    return NextResponse.json(data);
  }

  const page = Math.max(numberParam(searchParams.get("page"), 1), 1);
  const limitRaw = numberParam(searchParams.get("limit"), 10);
  const limit = Math.min(Math.max(limitRaw, 5), 50);
  const from = (page - 1) * limit;
  const to = from + limit;
  const sorted = sortDeposits(data, getCurrentPeriod(), normalize);

  return NextResponse.json({
    ok: true,
    deposits: sorted.slice(from, to),
    pagination: {
      page,
      limit,
      total: sorted.length,
      total_pages: Math.max(Math.ceil(sorted.length / limit), 1),
    },
  });
}

export async function POST(req) {
  if (!(await isAdmin(req))) {
    return unauthorized();
  }

  if (!validateCSRF(req)) {
    return NextResponse.json({ error: "Invalid CSRF" }, { status: 403 });
  }

  const body = await req.json();
  const sheets = await getSheets();
  const { person_id, house, name, periods, amount } = body;

  if (!person_id || !house || !name || !Array.isArray(periods)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const personalRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Personal!A:F",
  });
  const personalRows = personalRes.data.values || [];
  const member = personalRows.slice(1).find((r) => r[0] === person_id);

  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const appConfig = await getAppConfig();
  const isTrashUser = String(member[3] || "").toUpperCase() === "Y";
  const trashAmount = isTrashUser ? Number(appConfig?.trash_fee) || 0 : 0;

  const existingRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Deposit!A:K",
  });
  const existing = (existingRes.data.values || []).slice(1);
  const now = new Date().toISOString();

  const values = periods
    .filter((period) => {
      return !existing.some(
        (r) => r[1] === person_id && r[4] === period && r[7] !== "cancelled",
      );
    })
    .map((period) => [
      generateId("DEP-"),
      person_id,
      house,
      name,
      period,
      amount,
      trashAmount,
      "pending",
      now,
      "",
      "",
    ]);

  if (values.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Deposit!A:K",
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });
  }

  await recordAdminActivity(req, {
    type: "create",
    module: "deposit",
    severity: "success",
    message: `Save deposit ${house} ${values.length} period`,
    metadata: {
      person_id,
      house,
      name,
      periods,
      amount,
      trash_amount: trashAmount,
      inserted: values.length,
      deposit_ids: values.map((item) => item[0]),
    },
  });

  return NextResponse.json({ success: true, inserted: values.length });
}

export async function PATCH(req) {
  if (!(await isAdmin(req))) {
    return unauthorized();
  }

  if (!validateCSRF(req)) {
    return NextResponse.json({ error: "Invalid CSRF" }, { status: 403 });
  }

  const body = await req.json();
  const sheets = await getSheets();
  const { id, action } = body;

  if (!["PAY_NOW", "UPDATE_SNAPSHOT"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);

  const depositRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Deposit!A:K",
  });
  const depositRows = depositRes.data.values || [];
  const depositIndex = depositRows.slice(1).findIndex((r) => r[0] === id);

  if (depositIndex === -1) {
    return NextResponse.json({ error: "Deposit not found" }, { status: 404 });
  }

  const depositRowNumber = depositIndex + 2;
  const deposit = depositRows[depositRowNumber - 1];

  const appConfig = await getAppConfig();
  const currentMonthlyFee = Number(appConfig?.monthly_fee) || 0;
  const currentTrashFee = Number(appConfig?.trash_fee) || 0;

  const personalRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Personal!A:F",
  });
  const personalRows = personalRes.data.values || [];
  const member = personalRows.slice(1).find((r) => r[0] === deposit[1]);

  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const isTrashUser = normalize(member[3]).toUpperCase() === "Y";

  function validateBookingAmount(amount, trashAmount) {
    if (amount !== currentMonthlyFee) {
      return `Kas booking Rp${amount.toLocaleString("id-ID")} berbeda dengan tarif aktif Rp${currentMonthlyFee.toLocaleString("id-ID")}`;
    }

    if (!isTrashUser && trashAmount > 0) {
      return "Warga ini tidak terdaftar iuran sampah, trash booking harus Rp0";
    }

    if (isTrashUser && trashAmount !== currentTrashFee) {
      return `Trash booking Rp${trashAmount.toLocaleString("id-ID")} berbeda dengan tarif aktif Rp${currentTrashFee.toLocaleString("id-ID")}`;
    }

    return "";
  }

  if (action === "UPDATE_SNAPSHOT") {
    if (!["pending", "waiting"].includes(String(deposit[7] || ""))) {
      return NextResponse.json({ error: "Only active booking can be edited" }, { status: 400 });
    }

    const amount = Number(body.amount);
    const trashAmount = Number(body.trash_amount || 0);

    if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(trashAmount) || trashAmount < 0) {
      return NextResponse.json({ error: "Invalid booking amount" }, { status: 400 });
    }

    const validationError = validateBookingAmount(amount, trashAmount);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Deposit!F${depositRowNumber}:G${depositRowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[amount, trashAmount]] },
    });

    await recordAdminActivity(req, {
      type: "update",
      module: "deposit",
      severity: "success",
      message: `Update booking snapshot ${deposit[2]} ${deposit[4]}`,
      metadata: {
        deposit_id: id,
        house: deposit[2],
        period: deposit[4],
        before: {
          amount: Number(deposit[5]) || 0,
          trash_amount: Number(deposit[6]) || 0,
        },
        after: { amount, trash_amount: trashAmount },
      },
    });

    return NextResponse.json({ success: true });
  }

  const person_id = deposit[1];
  const person_house = deposit[2];
  const person_name = deposit[3];
  const period = deposit[4];
  const amount = Number(deposit[5]) || 0;
  const trashAmount = Number(deposit[6]) || 0;

  const validationError = validateBookingAmount(amount, trashAmount);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const paymentRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Payment!A:G",
  });
  const paymentRows = paymentRes.data.values || [];
  const existingPayment = paymentRows.slice(1).find((r) => {
    const samePeriod = normalize(r[4]) === normalize(period);
    const samePerson = normalize(r[1]) === normalize(person_id);
    const sameHouse = normalize(r[2]) === normalize(person_house);
    return samePeriod && (samePerson || sameHouse);
  });

  if (normalize(deposit[7]).toLowerCase() === "paid" && normalize(deposit[10])) {
    await ensurePaymentCashflow({
      sheets,
      paymentId: deposit[10],
      personHouse: person_house,
      period,
      amount,
      date: deposit[9] || today,
    });
    await ensureTrashPayment({ sheets, paymentId: deposit[10], trashAmount, date: deposit[9] || today });

    return NextResponse.json({
      success: true,
      existing: true,
      payment_id: deposit[10],
    });
  }

  if (existingPayment) {
    const existingPaymentId = existingPayment[0];
    const existingPaymentDate = existingPayment[6] || today;
    const cashflowRecovered = await ensurePaymentCashflow({
      sheets,
      paymentId: existingPaymentId,
      personHouse: existingPayment[2] || person_house,
      period,
      amount: Number(existingPayment[5]) || amount,
      date: existingPaymentDate,
    });
    const trashRecovered = await ensureTrashPayment({
      sheets,
      paymentId: existingPaymentId,
      trashAmount,
      date: existingPaymentDate,
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Deposit!H${depositRowNumber}:K${depositRowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [["paid", deposit[8] || "", existingPaymentDate, existingPaymentId]] },
    });

    await recordAdminActivity(req, {
      type: "idempotent",
      module: "deposit",
      severity: "info",
      message: `Reuse existing payment for deposit ${person_house} ${period}`,
      metadata: {
        deposit_id: id,
        payment_id: existingPaymentId,
        person_id,
        house: person_house,
        name: person_name,
        period,
        amount: Number(existingPayment[5]) || amount,
        trash_amount: trashAmount,
        cashflow_recovered: cashflowRecovered,
        trash_recovered: trashRecovered,
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

  await ensurePaymentCashflow({ sheets, paymentId, personHouse: person_house, period, amount, date: today });
  await ensureTrashPayment({ sheets, paymentId, trashAmount, date: today });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Deposit!H${depositRowNumber}:K${depositRowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [["paid", deposit[8] || "", today, paymentId]] },
  });

  await recordAdminActivity(req, {
    type: "pay",
    module: "deposit",
    severity: "success",
    message: `Pay deposit ${person_house} ${period}`,
    metadata: {
      deposit_id: id,
      payment_id: paymentId,
      person_id,
      house: person_house,
      name: person_name,
      period,
      amount,
      trash_amount: trashAmount,
      paid_at: today,
      trash_recorded: trashAmount > 0,
    },
  });

  return NextResponse.json({
    success: true,
    payment_id: paymentId,
  });
}
