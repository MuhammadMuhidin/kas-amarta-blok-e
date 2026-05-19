import { getSheetData } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await getSheetData();

    /* ========================= */
    /* PAYMENTS */
    /* ========================= */
    const payments = rows.filter(
      (r) => r.__type === "payment" && r.person_id && r.period,
    );

    /* ========================= */
    /* PERSONS */
    /* ========================= */
    const persons = rows.filter(
      (r) =>
        r.__type === "personal" &&
        r.house &&
        r.name &&
        ["y", "yes", "true", "1"].includes((r.active || "").toLowerCase()),
    );

    /* ========================= */
    /* PERIODS */
    /* ========================= */
    const periods = [...new Set(payments.map((p) => p.period).filter(Boolean))];

    /* ========================= */
    /* CASHFLOW */
    /* ========================= */
    const cashflows = rows
      .filter(
        (r) =>
          r.__type === "cashflow" &&
          ["income", "expense"].includes((r.type || "").toLowerCase()),
      )
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    /* ========================= */
    /* 1. PENENTUAN TANGGAL & BULAN */
    /* ========================= */
    const now = new Date();
    // Akhir bulan lalu (Contoh: jika sekarang Mei, ini adalah 30 April)
    const endOfLastMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
    );
    // Awal bulan ini (1 Mei)
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

    /* ========================= */
    /* 2. SALDO KUMULATIF SAMPAI BULAN LALU */
    /* ========================= */
    // Menghitung semua uang masuk & keluar SEBELUM bulan ini dimulai
    const totalIncomeUntilLastMonth = cashflows
      .filter((c) => c.type === "income" && new Date(c.date) <= endOfLastMonth)
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const totalExpenseUntilLastMonth = cashflows
      .filter((c) => c.type === "expense" && new Date(c.date) <= endOfLastMonth)
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    // Inilah angka "Total Seluruh Saldo per April"
    const lastMonthRemaining =
      totalIncomeUntilLastMonth - totalExpenseUntilLastMonth;

    /* ========================= */
    /* 3. TRANSAKSI KHUSUS BULAN LALU (Untuk Detail) */
    /* ========================= */
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
      }));

    const lastMonthExpenseTotal = lastMonthExpenses.reduce(
      (sum, item) => sum + item.amount,
      0,
    );

    /* ========================= */
    /* 4. TRANSAKSI BULAN INI */
    /* ========================= */
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
      }));

    /* ========================= */
    /* 5. TOTAL SALDO SAAT INI (ALL TIME) */
    /* ========================= */
    const totalIncomeAllTime = cashflows
      .filter((c) => c.type === "income")
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const totalExpenseAllTime = cashflows
      .filter((c) => c.type === "expense")
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const currentBalance = totalIncomeAllTime - totalExpenseAllTime;

    /* ========================= */
    /* 6. MENGIRIM DATA KE FRONTEND */
    /* ========================= */
    const insight = {
      lastMonth: {
        month: lastMonthName,
        income: lastMonthIncomeOnly, // Hanya income di bulan April saja
        expenseTotal: lastMonthExpenseTotal,
        expenses: lastMonthExpenses,
        remaining: lastMonthRemaining, // Kumulatif sisa saldo April
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

    /* ========================= */
    /* RETURN */
    /* ========================= */

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
