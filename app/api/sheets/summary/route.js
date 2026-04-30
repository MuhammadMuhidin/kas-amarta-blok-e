import { getSheetData } from "@/lib/google";

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

    return Response.json({
      payments,
      persons,
      cashflows,
      periods,
    });

  } catch (error) {
    console.error("SUMMARY ERROR:", error);

    return Response.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}