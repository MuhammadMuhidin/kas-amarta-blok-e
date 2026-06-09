import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { runMonthlySummaryWorkflow } from "@/features/waha/monthlySummaryService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    if (!(await isAdmin(req))) {
      return unauthorized();
    }

    if (!validateCSRF(req)) {
      return Response.json({ error: "CSRF tidak valid" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const result = await runMonthlySummaryWorkflow(body);

    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
