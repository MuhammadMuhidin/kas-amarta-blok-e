import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { sendAlertEmail } from "@/lib/emailAlert";
import { getWhatsAppWorkflowDefaults, triggerWhatsAppWorkflow } from "@/lib/whatsappWorkflow";

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

    let email = null;

    try {
      email = await sendAlertEmail({
        message,
        period,
        source,
        subject: body.emailSubject,
      });
    } catch (err) {
      email = {
        ok: false,
        error: err.message || "Failed to send email alert",
      };
    }

    return Response.json({
      ok: true,
      queued: true,
      jobId: workflow.jobId,
      workflow,
      email,
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