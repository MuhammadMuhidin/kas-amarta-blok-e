import { dbTable } from "@/lib/dbTable";

const PERSONAL_TABLE = dbTable("personal");
const PAYMENT_TABLE = dbTable("payment");
const CASHFLOW_TABLE = dbTable("cashflow");
const TRASH_TABLE = dbTable("trash");
const DEPOSIT_TABLE = dbTable("deposit");

export function mapDeposit(row) {
  return {
    id: row.id,
    person_id: row.person_id,
    house: row.house,
    name: row.name,
    period: row.period,
    amount: Number(row.amount) || 0,
    trash_amount: Number(row.trash_amount) || 0,
    status: row.status,
    created_at: row.created_at,
    paid_at: row.paid_at || "",
    payment_id: row.payment_id || "",
  };
}

export async function listDeposits(supabase) {
  const { data: rows, error } = await supabase
    .from(DEPOSIT_TABLE)
    .select("id,person_id,house,name,period,amount,trash_amount,status,created_at,paid_at,payment_id");

  if (error) {
    throw new Error("Gagal membaca booking payment");
  }

  return (rows || []).map(mapDeposit);
}

export async function findMemberById(supabase, personId) {
  const { data: rows, error } = await supabase
    .from(PERSONAL_TABLE)
    .select("id,house,name,trash,active,join_date")
    .eq("id", personId)
    .limit(1);

  if (error) {
    throw new Error(error.message || "Gagal membaca data warga");
  }

  return rows?.[0] || null;
}

export async function listExistingDepositsForPeriods(supabase, personId, periods) {
  const { data: rows, error } = await supabase
    .from(DEPOSIT_TABLE)
    .select("id,person_id,period,status")
    .eq("person_id", personId)
    .in("period", periods);

  if (error) {
    throw new Error(error.message || "Gagal membaca booking payment");
  }

  return rows || [];
}

export async function insertDeposits(supabase, deposits) {
  if (!deposits.length) return;

  const { error } = await supabase.from(DEPOSIT_TABLE).insert(deposits);

  if (error) {
    throw new Error(error.message || "Gagal menyimpan booking payment");
  }
}

export async function findDepositById(supabase, id) {
  const { data: rows, error } = await supabase
    .from(DEPOSIT_TABLE)
    .select("id,person_id,house,name,period,amount,trash_amount,status,created_at,paid_at,payment_id")
    .eq("id", id)
    .limit(1);

  if (error) {
    throw new Error(error.message || "Gagal membaca booking payment");
  }

  return rows?.[0] || null;
}

export async function updateDeposit(supabase, id, payload) {
  const { error } = await supabase
    .from(DEPOSIT_TABLE)
    .update(payload)
    .eq("id", id);

  if (error) {
    throw new Error(error.message || "Gagal mengubah booking payment");
  }
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

export async function findTrashAdvanceCashflow(supabase, advancePaymentId) {
  const { data: rows, error } = await supabase
    .from(CASHFLOW_TABLE)
    .select("id,amount")
    .eq("payment_id", advancePaymentId)
    .eq("type", "expense")
    .limit(1);

  if (error) {
    throw new Error(error.message || "Gagal membaca cashflow talangan sampah");
  }

  return rows?.[0] || null;
}
