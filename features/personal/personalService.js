import { generateId } from "@/lib/id";
import { recordAdminActivity } from "@/lib/adminActivity";
import {
  findPersonalById,
  insertPersonal,
  listPersonal,
  updatePersonalField,
} from "@/features/personal/personalRepository";

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

export async function listPersonalRecords({ supabase, searchParams }) {
  const data = sortByHouse(await listPersonal(supabase));
  const paginated = searchParams.has("page") || searchParams.has("limit");

  if (!paginated) {
    return data;
  }

  const page = Math.max(numberParam(searchParams.get("page"), 1), 1);
  const limitRaw = numberParam(searchParams.get("limit"), 10);
  const limit = Math.min(Math.max(limitRaw, 5), 50);
  const filter = clean(searchParams.get("filter"));
  const search = normalize(searchParams.get("search"));
  const from = (page - 1) * limit;
  const to = from + limit;
  const filtered = filterRows(data, filter, search);

  return {
    ok: true,
    personal: filtered.slice(from, to),
    pagination: {
      page,
      limit,
      total: filtered.length,
      total_pages: Math.max(Math.ceil(filtered.length / limit), 1),
    },
  };
}

export async function createPersonal({ supabase, req, body }) {
  const house = normalize(body.house);
  const name = normalize(body.name);
  const trash = clean(body.trash);
  const joinDate = normalize(body.join_date);

  if (!house || !name || !trash || !joinDate) {
    return {
      status: 400,
      body: { error: "All member fields are required" },
    };
  }

  if (trash !== "Y" && trash !== "N") {
    return { status: 400, body: { error: "Trash must be Y or N" } };
  }

  const id = generateId();
  const payload = {
    id,
    house,
    name,
    trash,
    active: "Y",
    join_date: joinDate,
  };

  await insertPersonal(supabase, payload);

  await recordAdminActivity(req, {
    type: "create",
    module: "personal",
    severity: "success",
    message: `Add member ${house} - ${name}`,
    metadata: payload,
  });

  return { status: 200, body: { success: true } };
}

export async function updatePersonalFlag({ supabase, req, body }) {
  const id = normalize(body.id);
  const field = normalize(body.field);
  const value = clean(body.value);

  if (!id || !["trash", "active"].includes(field)) {
    return { status: 400, body: { error: "Data update tidak valid" } };
  }

  if (value !== "Y" && value !== "N") {
    return { status: 400, body: { error: "Nilai harus Y atau N" } };
  }

  const current = await findPersonalById(supabase, id);

  if (!current) {
    return { status: 404, body: { error: "Data warga tidak ditemukan" } };
  }

  const oldValue = normalize(current[field]);
  await updatePersonalField(supabase, id, field, value);

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

  return {
    status: 200,
    body: {
      ok: true,
      id,
      field,
      value,
    },
  };
}
