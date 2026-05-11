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

    const previousDate = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );

    const currentDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

    const previousMonthKey =
      previousDate.toISOString().slice(0, 7);

    const currentMonthKey =
      currentDate.toISOString().slice(0, 7);

    const previousMonthName =
      previousDate.toLocaleString("id-ID", {
        month: "long",
      });

    const currentMonthName =
      currentDate.toLocaleString("id-ID", {
        month: "long",
      });

    /* ========================= */
    /* PREVIOUS MONTH */
    /* ========================= */

    const previousMonthCashflow = cashflows.filter(
      (c) =>
        (c.date || "").slice(0, 7) ===
        previousMonthKey
    );

    const previousIncome =
      previousMonthCashflow
        .filter((c) => c.type === "income")
        .reduce(
          (sum, c) => sum + Number(c.amount || 0),
          0
        );

    const previousExpenses =
      previousMonthCashflow.filter(
        (c) => c.type === "expense"
      );

    const previousExpenseItems =
      previousExpenses.map((e) => {
        const qty = Number(e.qty || 1);

        const total = Number(e.amount || 0);

        return {
          name: e.note || "-",
          qty,
          price: total / qty,
          total,
        };
      });

    const previousExpenseTotal =
      previousExpenseItems.reduce(
        (sum, e) => sum + e.total,
        0
      );

    const previousRemaining =
      previousIncome - previousExpenseTotal;

    /* ========================= */
    /* CURRENT MONTH */
    /* ========================= */

    const currentMonthCashflow = cashflows.filter(
      (c) =>
        (c.date || "").slice(0, 7) ===
        currentMonthKey
    );

    const currentIncome =
      currentMonthCashflow
        .filter((c) => c.type === "income")
        .reduce(
          (sum, c) => sum + Number(c.amount || 0),
          0
        );

    /* ========================= */
    /* FINAL */
    /* ========================= */

    const insight = {
      previousMonth: {
        key: previousMonthKey,
        month: previousMonthName,
        income: previousIncome,
        expenses: previousExpenseItems,
        expenseTotal: previousExpenseTotal,
        remaining: previousRemaining,
      },

      currentMonth: {
        key: currentMonthKey,
        month: currentMonthName,
        income: currentIncome,
      },

      carryForward:
        currentIncome + previousRemaining,
    };

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
