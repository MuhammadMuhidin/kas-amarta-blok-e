import { getSheetData } from "@/lib/google";

export async function GET() {
  try {
    // Ambil semua data dari Google Sheets
    const rows = await getSheetData();

    // --- Transform (ini dari webhook kamu) ---
    const payments = rows.filter(r => r.person_id && r.period);

    const persons = rows.filter(
      r => r.house && r.name && r.active === "Y"
    );

    const periods = [
      ...new Set(payments.map(p => p.period))
    ];

    const cashflowsRaw = rows.filter(
      r => r.type === "income" || r.type === "expense"
    );

    const cashflows = cashflowsRaw.sort((a, b) =>
      (b.date || "").localeCompare(a.date || "")
    );

    // --- Response ---
    return Response.json({
      payments,
      cashflows,
      persons,
      periods
    });

  } catch (error) {
    return Response.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}