import { getSheetData } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await getSheetData();

    /* ========================= */
    /* PAYMENTS */
    /* ========================= */
    const payments = rows.filter(
      (r) =>
        r.__type === "payment" &&
        r.person_id &&
        r.period
    );

    /* ========================= */
    /* PERSONS */
    /* ========================= */
    const persons = rows.filter(
      (r) =>
        r.__type === "personal" &&
        r.house &&
        r.name &&
        ["y", "yes", "true", "1"].includes(
          (r.active || "").toLowerCase()
        )
    );

    /* ========================= */
    /* PERIODS */
    /* ========================= */
    const periods = [
      ...new Set(
        payments.map((p) => p.period).filter(Boolean)
      ),
    ];

    /* ========================= */
    /* CASHFLOW */
    /* ========================= */
    const cashflows = rows
      .filter(
        (r) =>
          r.__type === "cashflow" &&
          ["income", "expense"].includes(
            (r.type || "").toLowerCase()
          )
      )
      .sort(
        (a, b) =>
          new Date(b.date || 0) - new Date(a.date || 0)
      );

    /* ========================= */
    /* MONTHLY INSIGHT */
    /* ========================= */

    const now = new Date();

    /* ========================= */
    /* MONTH KEY */
    /* ========================= */

    const lastMonthDate = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );

    const currentMonthDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

    const lastMonthKey =
      lastMonthDate.toISOString().slice(0, 7);

    const currentMonthKey =
      currentMonthDate.toISOString().slice(0, 7);

    const lastMonthName =
      lastMonthDate.toLocaleString("id-ID", {
        month: "long",
      });

    const currentMonthName =
      currentMonthDate.toLocaleString("id-ID", {
        month: "long",
      });

    /* ========================= */
    /* FILTER CASHFLOW */
    /* ========================= */

    const lastMonthCashflow =
      cashflows.filter(
        (c) =>
          (c.date || "").slice(0, 7) ===
          lastMonthKey
      );

    const currentMonthCashflow =
      cashflows.filter(
        (c) =>
          (c.date || "").slice(0, 7) ===
          currentMonthKey
      );

    /* ========================= */
    /* LAST MONTH INCOME */
    /* ========================= */

    const lastMonthIncome =
      lastMonthCashflow
        .filter((c) => c.type === "income")
        .reduce(
          (sum, c) =>
            sum + Number(c.amount || 0),
          0
        );

    /* ========================= */
    /* LAST MONTH EXPENSE */
    /* ========================= */

    const lastMonthExpenses =
      lastMonthCashflow
        .filter((c) => c.type === "expense")
        .map((c) => ({
          date: c.date || "-",
          note: c.note || "-",
          amount: Number(c.amount || 0),
        }));

    const lastMonthExpenseTotal =
      lastMonthExpenses.reduce(
        (sum, item) =>
          sum + Number(item.amount || 0),
        0
      );

    /* ========================= */
    /* LAST MONTH REMAINING */
    /* ========================= */

    const lastMonthRemaining =
      lastMonthIncome -
      lastMonthExpenseTotal;

    /* ========================= */
    /* CURRENT MONTH INCOME */
    /* ========================= */

    const currentMonthIncome =
      currentMonthCashflow
        .filter((c) => c.type === "income")
        .reduce(
          (sum, c) =>
            sum + Number(c.amount || 0),
          0
        );

    /* ========================= */
    /* CURRENT MONTH EXPENSE */
    /* ========================= */

    const currentMonthExpenses =
      currentMonthCashflow
        .filter((c) => c.type === "expense")
        .map((c) => ({
          date: c.date || "-",
          note: c.note || "-",
          amount: Number(c.amount || 0),
        }));

    const currentMonthExpenseTotal =
      currentMonthExpenses.reduce(
        (sum, item) =>
          sum + Number(item.amount || 0),
        0
      );

    /* ========================= */
    /* CURRENT BALANCE */
    /* ========================= */

    const currentBalance =
      currentMonthIncome +
      lastMonthRemaining -
      currentMonthExpenseTotal;

    /* ========================= */
    /* INSIGHT */
    /* ========================= */

    const insight = {
      lastMonth: {
        key: lastMonthKey,
        month: lastMonthName,

        income: lastMonthIncome,

        expenses: lastMonthExpenses,

        expenseTotal:
          lastMonthExpenseTotal,

        remaining:
          lastMonthRemaining,
      },

      currentMonth: {
        key: currentMonthKey,
        month: currentMonthName,

        income: currentMonthIncome,

        expenses: currentMonthExpenses,

        expenseTotal:
          currentMonthExpenseTotal,
      },

      summary: {
        currentIncomePlusLastRemaining:
          currentMonthIncome +
          lastMonthRemaining,

        currentBalance,
      },
    };

    /* ========================= */
    /* RETURN */
    /* ========================= */

    return Response.json({
      payments,
      persons,
      cashflows,
      periods,
      insight
    });

  } catch (error) {
    console.error("SUMMARY ERROR:", error);

    return Response.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}
