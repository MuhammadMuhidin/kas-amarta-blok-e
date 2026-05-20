import { NextResponse } from "next/server";
import { getSheets } from "@/lib/google";
import { generateId } from "@/lib/id";
import { getAppConfig } from "@/lib/appConfig";

export const dynamic = "force-dynamic";

const spreadsheetId = process.env.SPREADSHEET_ID;

function verifyCSRF(req) {
  const csrfCookie = req.cookies.get("csrf_token")?.value;
  const csrfHeader = req.headers.get("x-csrf-token");

  return csrfCookie && csrfHeader && csrfCookie === csrfHeader;
}

export async function GET() {
  const sheets = await getSheets();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Deposit!A:J",
  });

  const rows = res.data.values || [];

  const data = rows.slice(1).map((r) => ({
    id: r[0],
    person_id: r[1],
    house: r[2],
    name: r[3],
    period: r[4],
    amount: Number(r[5]) || 0,
    status: r[6],
    created_at: r[7],
    paid_at: r[8],
    payment_id: r[9],
  }));

  return NextResponse.json(data);
}

export async function POST(req) {
  const body = await req.json();
  const sheets = await getSheets();

  if (!verifyCSRF(req)) {
    return Response.json({ error: "Invalid CSRF" }, { status: 403 });
  }

  const { person_id, house, name, periods, amount } = body;

  if (!person_id || !house || !name || !Array.isArray(periods)) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400 },
    );
  }

  const existingRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Deposit!A:J",
  });

  const existing = (existingRes.data.values || []).slice(1);
  const now = new Date().toISOString();

  const values = periods
    .filter((period) => {
      return !existing.some(
        (r) =>
          r[1] === person_id &&
          r[4] === period &&
          r[6] !== "cancelled",
      );
    })
    .map((period) => [
      generateId("DEP-"),
      person_id,
      house,
      name,
      period,
      amount,
      "pending",
      now,
      "",
      "",
    ]);

  if (values.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Deposit!A:J",
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });
  }

  return NextResponse.json({
    success: true,
    inserted: values.length,
  });
}