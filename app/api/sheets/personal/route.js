import { NextResponse } from "next/server";
import { dbTable } from "@/lib/dbTable";
import { generateId } from "@/lib/id";
import { recordAdminActivity } from "@/lib/adminActivity";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const PERSONAL_TABLE = dbTable("personal");

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

function mapPersonal(row) {
  return {
    id: row.id,
    house: row.house,
    name: row.name,
    trash: row.trash,
    active: row.active,
    join_date: row.join_date,
  };
}

export async function GET(req) {
  if (!(await isAdmin(req))) {
    return unauthorized();
  }

  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await supabase
    .from(PERSONAL_TABLE)
    .select("id,house,name,trash,active,join_date");

  if (error) {
    return NextResponse.json({ error: "Gagal membaca data warga" }, { status: 500 });
  }

  const data = sortByHouse((rows || []).map(mapPersonal));

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
  const trash = clean(body.trash);
  const joinDate = normalize(body.join_date);

  if (!house || !name || !trash || !joinDate) {
    return NextResponse.json(
      { error: "All member fields are required" },
      { status: 400 },
    );
  }

  if (trash !== "Y" && trash !== "N") {
    return NextResponse.json({ error: "Trash must be Y or N" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const id = generateId();
  const payload = {
    id,
    house,
    name,
    trash,
    active: "Y",
    join_date: joinDate,
  };

  const { error } = await supabase
    .from(PERSONAL_TABLE)
    .insert(payload);

  if (error) {
    return NextResponse.json({ error: error.message || "Gagal menyimpan data warga" }, { status: 500 });
  }

  await recordAdminActivity(req, {
    type: "create",
    module: "personal",
    severity: "success",
    message: `Add member ${house} - ${name}`,
    metadata: payload,
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
  const value = clean(body.value);

  if (!id || !["trash", "active"].includes(field)) {
    return NextResponse.json({ error: "Data update tidak valid" }, { status: 400 });
  }

  if (value !== "Y" && value !== "N") {
    return NextResponse.json({ error: "Nilai harus Y atau N" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: currentRows, error: readError } = await supabase
    .from(PERSONAL_TABLE)
    .select("id,house,name,trash,active,join_date")
    .eq("id", id)
    .limit(1);

  if (readError) {
    return NextResponse.json({ error: readError.message || "Gagal membaca data warga" }, { status: 500 });
  }

  const current = currentRows?.[0];

  if (!current) {
    return NextResponse.json({ error: "Data warga tidak ditemukan" }, { status: 404 });
  }

  const oldValue = normalize(current[field]);
  const { error } = await supabase
    .from(PERSONAL_TABLE)
    .update({ [field]: value, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message || "Gagal mengubah data warga" }, { status: 500 });
  }

  await recordAdminActivity(req, {
    type: "update",
    module: "personal",
    severity: "success",
    message: `Update member ${field} ${current.house || id}`,
    metadata: {
      id,
      field,
      old_value: oldValue,
      new_value: value,
      house: current.house || null,
      name: current.name || null,
    },
  });

  return NextResponse.json({
    ok: true,
    id,
    field,
    value,
  });
}
