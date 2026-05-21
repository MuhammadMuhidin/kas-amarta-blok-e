import { NextResponse } from "next/server";
import { getSheets } from "@/lib/google";
import { generateId } from "@/lib/id";
import { recordAdminActivity } from "@/lib/adminActivity";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";

export const dynamic = "force-dynamic";

const spreadsheetId = process.env.SPREADSHEET_ID;

export async function GET() {
  const sheets = await getSheets();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "personal!A:F",
  });

  const rows = res.data.values || [];

  const data = rows.slice(1).map((r) => ({
    id: r[0],
    house: r[1],
    name: r[2],
    trash: r[3],
    active: r[4],
    join_date: r[5],
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

  const house = String(body.house || "").trim();
  const name = String(body.name || "").trim();
  const trash = String(body.trash || "").trim();
  const joinDate = String(body.join_date || "").trim();

  if (!house || !name || !trash || !joinDate) {
    return NextResponse.json(
      {
        error: "All member fields are required",
      },
      {
        status: 400,
      },
    );
  }

  const sheets = await getSheets();

  const id = generateId();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "personal!A:F",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[id, house, name, trash, "Y", joinDate]],
    },
  });

  await recordAdminActivity(req, {
    type: "create",
    module: "personal",
    severity: "success",
    message: `Add member ${house} - ${name}`,
    metadata: {
      id,
      house,
      name,
      trash,
      active: "Y",
      join_date: joinDate,
    },
  });

  return NextResponse.json({ success: true });
}
