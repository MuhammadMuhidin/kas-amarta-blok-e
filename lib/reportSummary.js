import { dbTable } from "@/lib/dbTable";
import { withMediaReceiptUrl } from "@/lib/mediaUrl";
import { supabase } from "@/lib/supabase";

const PERSONAL_TABLE = dbTable("personal");
const PAYMENT_TABLE = dbTable("payment");
const CASHFLOW_TABLE = dbTable("cashflow");

function normalize(value) {
  return String(value || "").trim();
}

function mapPersonal(row) {
  return {
    __type: "personal",
    id: row.id,
    house: row.house,
    name: row.name,
    trash: row.trash,
    active: row.active,
    join_date: row.join_date,
  };
}

function mapPayment(row) {
  return {
    __type: "payment",
    id: row.id,
    person_id: row.person_id,
    person_house: row.person_house,
    person_name: row.person_name,
    period: row.period,
    amount: Number(row.amount) || 0,
    date: row.date,
  };
}

function mapCashflow(row) {
  return withMediaReceiptUrl({
    __type: "cashflow",
    id: row.id,
    ref_id: row.payment_id,
    payment_id: row.payment_id,
    type: normalize(row.type).toLowerCase(),
    amount: Number(row.amount) || 0,
    note: row.note,
    date: row.date,
    receipt_url: row.receipt_url || "",
  });
}

export async function getReportSummary() {
  const [personalRes, paymentRes, cashflowRes] = await Promise.all([
    supabase
      .from(PERSONAL_TABLE)
      .select("id,house,name,trash,active,join_date"),
    supabase
      .from(PAYMENT_TABLE)
      .select("id,person_id,person_house,person_name,period,amount,date"),
    supabase
      .from(CASHFLOW_TABLE)
      .select("id,payment_id,type,amount,note,date,receipt_url"),
  ]);

  if (personalRes.error) throw personalRes.error;
  if (paymentRes.error) throw paymentRes.error;
  if (cashflowRes.error) throw cashflowRes.error;

  const payments = (paymentRes.data || [])
    .map(mapPayment)
    .filter((row) => row.person_id && row.period);

  const persons = (personalRes.data || [])
    .map(mapPersonal)
    .filter(
      (row) =>
        row.house &&
        row.name &&
        ["y", "yes", "true", "1"].includes((row.active || "").toLowerCase()),
    );

  const periods = [...new Set(payments.map((payment) => payment.period).filter(Boolean))];

  const cashflows = (cashflowRes.data || [])
    .map(mapCashflow)
    .filter((row) => ["income", "expense"].includes((row.type || "").toLowerCase()))
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  const now = new Date();
  const endOfLastMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    0,
    23,
    59,
    59,
  );
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthName = endOfLastMonth.toLocaleString("id-ID", {
    month: "long",
    year: "numeric",
  });
  const currentMonthName = startOfCurrentMonth.toLocaleString("id-ID", {
    month: "long",
    year: "numeric",
  });
  const currentMonthKey = startOfCurrentMonth.toISOString().slice(0, 7);
  const lastMonthKey = endOfLastMonth.toISOString().slice(0, 7);

  const totalIncomeUntilLastMonth = cashflows
    .filter((cashflow) => cashflow.type === "income" && new Date(cashflow.date) <= endOfLastMonth)
    .reduce((sum, cashflow) => sum + Number(cashflow.amount || 0), 0);

  const totalExpenseUntilLastMonth = cashflows
    .filter((cashflow) => cashflow.type === "expense" && new Date(cashflow.date) <= endOfLastMonth)
    .reduce((sum, cashflow) => sum + Number(cashflow.amount || 0), 0);

  const lastMonthRemaining = totalIncomeUntilLastMonth - totalExpenseUntilLastMonth;

  const lastMonthCashflow = cashflows.filter(
    (cashflow) => (cashflow.date || "").slice(0, 7) === lastMonthKey,
  );

  const lastMonthIncomeOnly = lastMonthCashflow
    .filter((cashflow) => cashflow.type === "income")
    .reduce((sum, cashflow) => sum + Number(cashflow.amount || 0), 0);

  const lastMonthExpenses = lastMonthCashflow
    .filter((cashflow) => cashflow.type === "expense")
    .map((cashflow) => ({
      date: cashflow.date || "-",
      note: cashflow.note || "-",
      amount: Number(cashflow.amount || 0),
      receipt_url: cashflow.receipt_url || "",
    }));

  const lastMonthExpenseTotal = lastMonthExpenses.reduce(
    (sum, item) => sum + item.amount,
    0,
  );

  const currentMonthCashflow = cashflows.filter(
    (cashflow) => (cashflow.date || "").slice(0, 7) === currentMonthKey,
  );

  const currentMonthIncome = currentMonthCashflow
    .filter((cashflow) => cashflow.type === "income")
    .reduce((sum, cashflow) => sum + Number(cashflow.amount || 0), 0);

  const currentMonthExpenseTotal = currentMonthCashflow
    .filter((cashflow) => cashflow.type === "expense")
    .reduce((sum, cashflow) => sum + Number(cashflow.amount || 0), 0);

  const currentMonthExpenses = currentMonthCashflow
    .filter((cashflow) => cashflow.type === "expense")
    .map((cashflow) => ({
      date: cashflow.date || "-",
      note: cashflow.note || "-",
      amount: Number(cashflow.amount || 0),
      receipt_url: cashflow.receipt_url || "",
    }));

  const totalIncomeAllTime = cashflows
    .filter((cashflow) => cashflow.type === "income")
    .reduce((sum, cashflow) => sum + Number(cashflow.amount || 0), 0);

  const totalExpenseAllTime = cashflows
    .filter((cashflow) => cashflow.type === "expense")
    .reduce((sum, cashflow) => sum + Number(cashflow.amount || 0), 0);

  const currentBalance = totalIncomeAllTime - totalExpenseAllTime;

  const insight = {
    lastMonth: {
      month: lastMonthName,
      income: lastMonthIncomeOnly,
      expenseTotal: lastMonthExpenseTotal,
      expenses: lastMonthExpenses,
      remaining: lastMonthRemaining,
    },
    currentMonth: {
      month: currentMonthName,
      income: currentMonthIncome,
      expenseTotal: currentMonthExpenseTotal,
      expenses: currentMonthExpenses,
    },
    summary: {
      currentIncomePlusLastRemaining: currentMonthIncome + lastMonthRemaining,
      currentBalance,
    },
  };

  return {
    payments,
    persons,
    cashflows,
    periods,
    insight,
  };
}
