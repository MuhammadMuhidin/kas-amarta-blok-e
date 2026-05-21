import { NextResponse } from "next/server";
import { getSheets } from "@/lib/google";
import { generateId } from "@/lib/id";
import { recordAdminActivity } from "@/lib/adminActivity";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";

export const dynamic = "force-dynamic";

const spreadsheetId = process.env.SPREADSHEET_ID;

function normalize(value) {
  return String(value || "").trim();
}

export async function GET() {
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

  if (!house || !period || !amount) {
    return NextResponse.json(
      { error: "House, period, and amount are required" },
      { status: 400 },
    );
  }

  const sheets = await getSheets();
  const today = new Date().toISOString().slice(0, 10);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "personal!A:F",
  });

  const rows = res.data.values || [];
  const member = rows.slice(1).find((r) => normalize(r[1]) === house);

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

  const duplicatePayment = paymentRows.slice(1).some((r) => {
    const samePerson = normalize(r[1]) === normalize(person_id);
    const sameHouse = normalize(r[2]) === normalize(person_house);
    const samePeriod = normalize(r[4]) === period;

    return samePeriod && (samePerson || sameHouse);
  });

  if (duplicatePayment) {
    return NextResponse.json(
      { error: "Period already paid for this house" },
      { status: 409 },
    );
  }

  const paymentId = generateId("PAY-");

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "payment!A:G",
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
    range: "cashflow!A:F",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[generateId("CSFLOW-"), paymentId, "income", amount, note, today]],
    },
  });

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
    },
  });

  return NextResponse.json({
    success: true,
    payment_id: paymentId,
  });
}
