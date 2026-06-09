import { dbTable } from "@/lib/dbTable";

const PERSONAL_TABLE = dbTable("personal");
const PAYMENT_TABLE = dbTable("payment");
const CASHFLOW_TABLE = dbTable("cashflow");
const TRASH_TABLE = dbTable("trash");

export async function loadTrashAdvanceData(supabase) {
  const [personalRes, paymentRes, trashRes, cashflowRes] = await Promise.all([
    supabase.from(PERSONAL_TABLE).select("id,house,name,trash,active,join_date"),
    supabase.from(PAYMENT_TABLE).select("id,person_id,person_house,person_name,period,amount,date"),
    supabase.from(TRASH_TABLE).select("id,payment_id,amount,date"),
    supabase.from(CASHFLOW_TABLE).select("id,payment_id,type,amount,note,date,receipt_url"),
  ]);

  if (personalRes.error) throw personalRes.error;
  if (paymentRes.error) throw paymentRes.error;
  if (trashRes.error) throw trashRes.error;
  if (cashflowRes.error) throw cashflowRes.error;

  return {
    personal: personalRes.data || [],
    payments: paymentRes.data || [],
    trashRecords: trashRes.data || [],
    cashflows: cashflowRes.data || [],
  };
}

export async function insertTrashAdvanceCashflows(supabase, values) {
  if (!values.length) return;

  const { error } = await supabase.from(CASHFLOW_TABLE).insert(values);

  if (error) throw error;
}
