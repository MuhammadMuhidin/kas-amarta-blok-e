import { getReportSummary } from "@/lib/reportSummary";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const summary = await getReportSummary();
    return Response.json(summary);
  } catch (error) {
    console.error("SUMMARY ERROR:", error);

    return Response.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
