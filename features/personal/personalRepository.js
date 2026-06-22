import { dbTable } from "@/lib/dbTable";

const PERSONAL_TABLE = dbTable("personal");

export function mapPersonal(row) {
  return {
    id: row.id,
    house: row.house,
    name: row.name,
    trash: row.trash,
    active: row.active,
    join_date: row.join_date,
  };
}

export async function listPersonal(supabase) {
  const { data: rows, error } = await supabase
    .from(PERSONAL_TABLE)
    .select("id,house,name,trash,active,join_date");

  if (error) {
    throw new Error("Gagal membaca data warga");
  }

  return (rows || []).map(mapPersonal);
}

export async function insertPersonal(supabase, payload) {
  const { error } = await supabase
    .from(PERSONAL_TABLE)
    .insert(payload);

  if (error) {
    throw new Error(error.message || "Gagal menyimpan data warga");
  }
}

export async function listActiveMembers(supabase) {
  const { data: rows, error } = await supabase
    .from(PERSONAL_TABLE)
    .select("id,house,name,trash,active,join_date")
    .eq("active", "Y");

  if (error) {
    throw new Error("Gagal membaca data warga aktif");
  }

  return (rows || []).map(mapPersonal);
}

export async function findPersonalById(supabase, id) {
  const { data: rows, error } = await supabase
    .from(PERSONAL_TABLE)
    .select("id,house,name,trash,active,join_date")
    .eq("id", id)
    .limit(1);

  if (error) {
    throw new Error(error.message || "Gagal membaca data warga");
  }

  return rows?.[0] || null;
}

export async function updatePersonalField(supabase, id, field, value) {
  const { error } = await supabase
    .from(PERSONAL_TABLE)
    .update({ [field]: value, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error(error.message || "Gagal mengubah data warga");
  }
}
