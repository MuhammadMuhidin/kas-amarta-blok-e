import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { getWhatsAppWorkflowDefaults, triggerWhatsAppWorkflow } from "@/lib/whatsappWorkflow";

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
    const defaults = getWhatsAppWorkflowDefaults();
    const message = String(body.message || "").trim();
    const period = String(body.period || "-").trim();
    const source = String(body.source || "admin").trim();
    const chatId = String(body.chatId || defaults.alertChatId || "").trim();
    const sessionId = String(body.sessionId || defaults.sessionId || "main").trim();
    const targetEnv = String(body.targetEnv || defaults.targetEnv || "development").trim();

    const workflow = await triggerWhatsAppWorkflow({
      chatId,
      message,
      period,
      sessionId,
      targetEnv,
      source,
    });

    return Response.json({
      ok: true,
      queued: true,
      jobId: workflow.jobId,
      workflow,
      chatId,
      session: sessionId,
      targetEnv,
      period,
      source,
      message,
    });
  } catch (err) {
    return Response.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
