import { getAppConfig } from "@/lib/appConfig";
import { getReportSummary } from "@/lib/reportSummary";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [summary, appConfig] = await Promise.all([getReportSummary(), getAppConfig()]);
    return Response.json({ ...summary, appConfig });
  } catch (error) {
    console.error("SUMMARY ERROR:", error);

    return Response.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
