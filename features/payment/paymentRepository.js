import { dbTable } from "@/lib/dbTable";

const PERSONAL_TABLE = dbTable("personal");
const PAYMENT_TABLE = dbTable("payment");

export function mapPayment(row) {
  return {
    id: row.id,
    person_id: row.person_id,
    person_house: row.person_house,
    person_name: row.person_name,
    period: row.period,
    amount: Number(row.amount) || 0,
    date: row.date,
  };
}

export async function listPayments(supabase) {
  const { data: rows, error } = await supabase
    .from(PAYMENT_TABLE)
    .select("id,person_id,person_house,person_name,period,amount,date");

  if (error) {
    throw new Error("Gagal membaca payment");
  }

  return (rows || []).map(mapPayment);
}

export async function findMemberByHouse(supabase, house) {
  const { data: rows, error } = await supabase
    .from(PERSONAL_TABLE)
    .select("id,house,name,trash,active,join_date")
    .eq("house", house)
    .limit(1);

  if (error) {
    throw new Error(error.message || "Gagal membaca data warga");
  }

  return rows?.[0] || null;
}

export async function listPaymentsByPeriod(supabase, period) {
  const { data: rows, error } = await supabase
    .from(PAYMENT_TABLE)
    .select("id,person_id,person_house,person_name,period,amount,date")
    .eq("period", period);

  if (error) {
    throw new Error(error.message || "Gagal membaca payment");
  }

  return rows || [];
}
