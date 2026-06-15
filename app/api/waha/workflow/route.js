import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { sendAlertEmail } from "@/lib/emailAlert";
import { getIntegrationConfigString } from "@/lib/integrationConfig";
import { sendWaMessage } from "@/lib/waClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    if (!(await isAdmin(req))) return unauthorized();
    if (!validateCSRF(req)) {
      return Response.json({ error: "Invalid CSRF token" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const message = String(body.message || "").trim();
    const period = String(body.period || "-").trim();
    const source = String(body.source || "admin").trim();
    const configuredChatId = await getIntegrationConfigString("WA_ALERT_CHAT_ID");
    const chatId = String(
      body.chatId || configuredChatId || process.env.WA_ERROR_CHAT_ID || "",
    ).trim();

    await sendWaMessage({ chatId, text: message, source });
    const email = await sendAlertEmail({
      message,
      period,
      source,
      subject: body.emailSubject,
    });

    return Response.json({
      ok: true,
      sent: true,
      delivery: "external-api",
      email,
      chatId,
      period,
      source,
    });
  } catch (err) {
    return Response.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
