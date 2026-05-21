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

  const house = normalize(body.house);
  const name = normalize(body.name);
  const trash = normalize(body.trash);
  const joinDate = normalize(body.join_date);

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

export async function PATCH(req) {
  if (!(await isAdmin(req))) {
    return unauthorized();
  }

  if (!validateCSRF(req)) {
    return NextResponse.json({ error: "Invalid CSRF" }, { status: 403 });
  }

  const body = await req.json();

  const id = normalize(body.id);
  const field = normalize(body.field);
  const value = normalize(body.value).toUpperCase();

  const allowedFields = {
    trash: "D",
    active: "E",
  };

  if (!id || !allowedFields[field]) {
    return NextResponse.json(
      {
        error: "Data update tidak valid",
      },
      {
        status: 400,
      },
    );
  }

  if (value !== "Y" && value !== "N") {
    return NextResponse.json(
      {
        error: "Nilai harus Y atau N",
      },
      {
        status: 400,
      },
    );
  }

  const sheets = await getSheets();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "personal!A:F",
  });

  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((row, index) => index > 0 && row[0] === id);

  if (rowIndex === -1) {
    return NextResponse.json(
      {
        error: "Data warga tidak ditemukan",
      },
      {
        status: 404,
      },
    );
  }

  const rowNumber = rowIndex + 1;
  const targetRange = `personal!${allowedFields[field]}${rowNumber}`;
  const oldValue = normalize(rows[rowIndex]?.[field === "trash" ? 3 : 4]);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: targetRange,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[value]],
    },
  });

  await recordAdminActivity(req, {
    type: "update",
    module: "personal",
    severity: "success",
    message: `Update member ${field} ${rows[rowIndex]?.[1] || id}`,
    metadata: {
      id,
      field,
      old_value: oldValue,
      new_value: value,
      house: rows[rowIndex]?.[1] || null,
      name: rows[rowIndex]?.[2] || null,
    },
  });

  return NextResponse.json({
    ok: true,
    id,
    field,
    value,
  });
}
