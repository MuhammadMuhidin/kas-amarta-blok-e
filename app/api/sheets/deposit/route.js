import { NextResponse } from "next/server";
import { getSheets } from "@/lib/google";
import { generateId } from "@/lib/id";
import { getAppConfig } from "@/lib/appConfig";
import { recordAdminActivity } from "@/lib/adminActivity";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";

export const dynamic = "force-dynamic";

const spreadsheetId = process.env.SPREADSHEET_ID;

export async function GET() {
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

  return NextResponse.json(data);
}

export async function POST(req) {
  if (!(await isAdmin(req))) {
    return unauthorized();
  }

  if (!validateCSRF(req)) {
    return NextResponse.json(
      { error: "Invalid CSRF" },
      { status: 403 },
    );
  }

  const body = await req.json();
  const sheets = await getSheets();

  const { person_id, house, name, periods, amount } = body;

  if (!person_id || !house || !name || !Array.isArray(periods)) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400 },
    );
  }

  const personalRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Personal!A:F",
  });

  const personalRows = personalRes.data.values || [];
  const member = personalRows.slice(1).find((r) => r[0] === person_id);

  if (!member) {
    return NextResponse.json(
      { error: "Member not found" },
      { status: 404 },
    );
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
        (r) =>
          r[1] === person_id &&
          r[4] === period &&
          r[7] !== "cancelled",
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
      requestBody: {
        values,
      },
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

  return NextResponse.json({
    success: true,
    inserted: values.length,
  });
}

export async function PATCH(req) {
  if (!(await isAdmin(req))) {
    return unauthorized();
  }

  if (!validateCSRF(req)) {
    return NextResponse.json(
      { error: "Invalid CSRF" },
      { status: 403 },
    );
  }

  const body = await req.json();
  const sheets = await getSheets();

  const { id, action } = body;

  if (action !== "PAY_NOW") {
    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 },
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  const depositRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Deposit!A:K",
  });

  const depositRows = depositRes.data.values || [];

  const depositIndex = depositRows.slice(1).findIndex((r) => r[0] === id);

  if (depositIndex === -1) {
    return NextResponse.json(
      { error: "Deposit not found" },
      { status: 404 },
    );
  }

  const depositRowNumber = depositIndex + 2;
  const deposit = depositRows[depositRowNumber - 1];

  if (deposit[7] === "paid") {
    return NextResponse.json(
      { error: "Deposit already paid" },
      { status: 400 },
    );
  }

  const person_id = deposit[1];
  const person_house = deposit[2];
  const person_name = deposit[3];
  const period = deposit[4];
  const amount = Number(deposit[5]) || 0;
  const trashAmount = Number(deposit[6]) || 0;

  const paymentRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Payment!A:G",
  });

  const paymentRows = paymentRes.data.values || [];

  const duplicatePayment = paymentRows
    .slice(1)
    .some((r) => r[1] === person_id && r[4] === period);

  if (duplicatePayment) {
    return NextResponse.json(
      { error: "Period already paid" },
      { status: 400 },
    );
  }

  if (trashAmount > 0) {
    const appConfig = await getAppConfig();
    const currentTrashFee = Number(appConfig?.trash_fee) || 0;

    if (trashAmount !== currentTrashFee) {
      return NextResponse.json(
        {
          error: `Trash booking Rp${trashAmount.toLocaleString("id-ID")} berbeda dengan tarif aktif Rp${currentTrashFee.toLocaleString("id-ID")}`,
        },
        { status: 400 },
      );
    }
  }

  const paymentId = generateId("PAY-");

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Payment!A:G",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          paymentId,
          person_id,
          person_house,
          person_name,
          period,
          amount,
          today,
        ],
      ],
    },
  });

  const note = `Pembayaran Kas ${person_house} Periode ${period}`;

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Cashflow!A:F",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          generateId("CSFLOW-"),
          paymentId,
          "income",
          amount,
          note,
          today,
        ],
      ],
    },
  });

  if (trashAmount > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Trash!A:D",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            generateId("TRASH-"),
            paymentId,
            trashAmount,
            today,
          ],
        ],
      },
    });
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Deposit!H${depositRowNumber}:K${depositRowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [["paid", deposit[8] || "", today, paymentId]],
    },
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
