import { dbTable } from "@/lib/dbTable";

const PERSONAL_TABLE = dbTable("personal");
const PAYMENT_TABLE = dbTable("payment");
const CASHFLOW_TABLE = dbTable("cashflow");
const TRASH_TABLE = dbTable("trash");

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

export async function insertPayment(supabase, payment) {
  const { error } = await supabase.from(PAYMENT_TABLE).insert(payment);

  if (error) {
    throw new Error(error.message || "Gagal menyimpan payment");
  }
}

export async function hasCashflowByPaymentId(supabase, paymentId) {
  const { data: rows, error } = await supabase
    .from(CASHFLOW_TABLE)
    .select("id")
    .eq("payment_id", paymentId)
    .limit(1);

  if (error) {
    throw new Error(error.message || "Gagal membaca cashflow");
  }

  return Boolean(rows?.length);
}

export async function insertCashflow(supabase, cashflow) {
  const { error } = await supabase.from(CASHFLOW_TABLE).insert(cashflow);

  if (error) {
    throw new Error(error.message || "Gagal menyimpan cashflow");
  }
}

export async function hasTrashByPaymentId(supabase, paymentId) {
  const { data: rows, error } = await supabase
    .from(TRASH_TABLE)
    .select("id")
    .eq("payment_id", paymentId)
    .limit(1);

  if (error) {
    throw new Error(error.message || "Gagal membaca data sampah");
  }

  return Boolean(rows?.length);
}

export async function insertTrash(supabase, trash) {
  const { error } = await supabase.from(TRASH_TABLE).insert(trash);

  if (error) {
    throw new Error(error.message || "Gagal menyimpan data sampah");
  }
}
