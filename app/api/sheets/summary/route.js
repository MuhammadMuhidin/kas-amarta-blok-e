import { dbTable } from "@/lib/dbTable";
import { withMediaReceiptUrl } from "@/lib/mediaUrl";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

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

export async function GET() {
  try {
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
      .filter((r) => r.person_id && r.period);

    const persons = (personalRes.data || [])
      .map(mapPersonal)
      .filter(
        (r) =>
          r.house &&
          r.name &&
          ["y", "yes", "true", "1"].includes((r.active || "").toLowerCase()),
      );

    const periods = [...new Set(payments.map((p) => p.period).filter(Boolean))];

    const cashflows = (cashflowRes.data || [])
      .map(mapCashflow)
      .filter((r) => ["income", "expense"].includes((r.type || "").toLowerCase()))
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
      .filter((c) => c.type === "income" && new Date(c.date) <= endOfLastMonth)
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const totalExpenseUntilLastMonth = cashflows
      .filter((c) => c.type === "expense" && new Date(c.date) <= endOfLastMonth)
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const lastMonthRemaining =
      totalIncomeUntilLastMonth - totalExpenseUntilLastMonth;

    const lastMonthCashflow = cashflows.filter(
      (c) => (c.date || "").slice(0, 7) === lastMonthKey,
    );

    const lastMonthIncomeOnly = lastMonthCashflow
      .filter((c) => c.type === "income")
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const lastMonthExpenses = lastMonthCashflow
      .filter((c) => c.type === "expense")
      .map((c) => ({
        date: c.date || "-",
        note: c.note || "-",
        amount: Number(c.amount || 0),
        receipt_url: c.receipt_url || "",
      }));

    const lastMonthExpenseTotal = lastMonthExpenses.reduce(
      (sum, item) => sum + item.amount,
      0,
    );

    const currentMonthCashflow = cashflows.filter(
      (c) => (c.date || "").slice(0, 7) === currentMonthKey,
    );

    const currentMonthIncome = currentMonthCashflow
      .filter((c) => c.type === "income")
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const currentMonthExpenseTotal = currentMonthCashflow
      .filter((c) => c.type === "expense")
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const currentMonthExpenses = currentMonthCashflow
      .filter((c) => c.type === "expense")
      .map((c) => ({
        date: c.date || "-",
        note: c.note || "-",
        amount: Number(c.amount || 0),
        receipt_url: c.receipt_url || "",
      }));

    const totalIncomeAllTime = cashflows
      .filter((c) => c.type === "income")
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const totalExpenseAllTime = cashflows
      .filter((c) => c.type === "expense")
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

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

    return Response.json({
      payments,
      persons,
      cashflows,
      periods,
      insight,
    });
  } catch (error) {
    console.error("SUMMARY ERROR:", error);

    return Response.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
