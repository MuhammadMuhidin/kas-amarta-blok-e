import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { runWhatsAppWorkflow } from "@/features/waha/wahaWorkflowService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    if (!(await isAdmin(req))) {
      return unauthorized();
    }

    if (!validateCSRF(req)) {
      return Response.json({ error: "Invalid CSRF token" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const result = await runWhatsAppWorkflow(body);

    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
