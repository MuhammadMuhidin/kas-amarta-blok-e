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

function clean(value) {
  return normalize(value).toUpperCase();
}

function numberParam(value, fallback) {
  const parsed = Number(value || fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sortByHouse(rows) {
  return [...rows].sort((a, b) =>
    String(a.house || "").localeCompare(String(b.house || ""), undefined, {
      numeric: true,
    }),
  );
}

function filterRows(rows, filter, search) {
  let result = rows;

  if (filter === "ACTIVE") {
    result = result.filter((item) => item.active === "Y");
  }

  if (filter === "INACTIVE") {
    result = result.filter((item) => item.active === "N");
  }

  if (filter === "TRASH_ACTIVE") {
    result = result.filter((item) => item.trash === "Y");
  }

  if (filter === "TRASH_INACTIVE") {
    result = result.filter((item) => item.trash === "N");
  }

  if (search) {
    const keyword = String(search || "").toLowerCase();

    result = result.filter((item) => {
      return [item.house, item.name, item.id]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }

  return result;
}

export async function GET(req) {
  if (!(await isAdmin(req))) {
    return unauthorized();
  }

  const sheets = await getSheets();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "personal!A:F",
  });

  const rows = res.data.values || [];

  const data = sortByHouse(
    rows.slice(1).map((r) => ({
      id: r[0],
      house: r[1],
      name: r[2],
      trash: r[3],
      active: r[4],
      join_date: r[5],
    })),
  );

  const { searchParams } = new URL(req.url);
  const paginated = searchParams.has("page") || searchParams.has("limit");

  if (!paginated) {
    return NextResponse.json(data);
  }

  const page = Math.max(numberParam(searchParams.get("page"), 1), 1);
  const limitRaw = numberParam(searchParams.get("limit"), 10);
  const limit = Math.min(Math.max(limitRaw, 5), 50);
  const filter = clean(searchParams.get("filter"));
  const search = normalize(searchParams.get("search"));
  const from = (page - 1) * limit;
  const to = from + limit;
  const filtered = filterRows(data, filter, search);

  return NextResponse.json({
    ok: true,
    personal: filtered.slice(from, to),
    pagination: {
      page,
      limit,
      total: filtered.length,
      total_pages: Math.max(Math.ceil(filtered.length / limit), 1),
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
