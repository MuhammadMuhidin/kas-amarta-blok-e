import { NextResponse } from "next/server";
import { getSheets } from "@/lib/google";
import { generateId } from "@/lib/id";
import { recordAdminActivity } from "@/lib/adminActivity";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";

export const dynamic = "force-dynamic";

const spreadsheetId = process.env.SPREADSHEET_ID;

function toTitleCase(str = "") {
  return str
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function GET() {
  const sheets = await getSheets();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Cashflow!A:F",
  });

  const rows = res.data.values || [];

  const data = rows.slice(1).map((r) => ({
    id: r[0],
    ref_id: r[1],
    type: (r[2] || "").toLowerCase(),
    amount: Number(r[3]) || 0,
    note: r[4],
    date: r[5],
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

  const type = String(body.type || "").trim().toLowerCase();
  const amount = Number(body.amount || 0);
  const rawNote = String(body.note || "").trim();

  if (!type || !amount || !rawNote) {
    return NextResponse.json(
      {
        error: "Type, amount, and note are required",
      },
      {
        status: 400,
      },
    );
  }

  const sheets = await getSheets();

  const today = new Date().toISOString().slice(0, 10);

  const cashflowId = generateId("CSFLOW-");
  const refId = generateId("DIRECT-");
  const note = toTitleCase(rawNote);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "cashflow!A:F",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[cashflowId, refId, type, amount, note, today]],
    },
  });

  await recordAdminActivity(req, {
    type: "create",
    module: "cashflow",
    severity: type === "expense" ? "warning" : "success",
    message: `Record ${type} cashflow ${note}`,
    metadata: {
      cashflow_id: cashflowId,
      ref_id: refId,
      type,
      amount,
      note,
      date: today,
    },
  });

  return NextResponse.json({ success: true });
}
