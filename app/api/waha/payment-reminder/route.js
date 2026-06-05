import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { recordAdminActivity } from "@/lib/adminActivity";
import {
  enforceRateLimit,
  RATE_LIMIT_SCOPES,
} from "@/lib/rateLimit";
import { getWhatsAppWorkflowDefaults, triggerWhatsAppWorkflow } from "@/lib/whatsappWorkflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_PAYMENT_REMINDER_MESSAGE = [
  "Assalamu’alaikum bapak/ibu warga Amarta Residence 2 Blok E.",
  "",
  "Izin mengingatkan bahwa pembayaran kas dan sampah bulan ini jatuh tempo hari ini. Bagi bapak/ibu yang belum melakukan pembayaran, mohon dapat segera melakukan pembayaran.",
  "",
  "Terima kasih 🙏",
  "@semua",
].join("\n");

function normalize(value) {
  return String(value || "").trim();
}

function getCurrentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

export async function POST(req) {
  try {
    if (!(await isAdmin(req))) {
      return unauthorized();
    }

    if (!validateCSRF(req)) {
      return Response.json({ error: "CSRF tidak valid" }, { status: 403 });
    }

    const rateLimit = await enforceRateLimit(
      req,
      RATE_LIMIT_SCOPES.whatsappPaymentReminder,
      { identity: "session", targetId: "payment-reminder" },
    );

    if (rateLimit) return rateLimit;

    const body = await req.json().catch(() => ({}));
    const defaults = getWhatsAppWorkflowDefaults();
    const text = normalize(body.message) || DEFAULT_PAYMENT_REMINDER_MESSAGE;
    const period = normalize(body.period) || getCurrentPeriod();
    const chatId = normalize(body.chatId) || defaults.reportChatId;
    const sessionId = normalize(body.sessionId) || defaults.sessionId || "main";
    const targetEnv = normalize(body.targetEnv) || defaults.targetEnv || "development";

    if (body.preview === true) {
      return Response.json({
        ok: true,
        preview: true,
        chatId,
        session: sessionId,
        targetEnv,
        period,
        text,
      });
    }

    const workflow = await triggerWhatsAppWorkflow({
      chatId,
      message: text,
      period,
      sessionId,
      targetEnv,
      source: "admin-payment-reminder",
    });

    await recordAdminActivity(req, {
      type: "send",
      module: "whatsapp",
      severity: "success",
      message: "Send payment reminder WhatsApp",
      metadata: {
        target: "resident_group",
        job_id: workflow.jobId,
        message_length: text.length,
        period,
        source: "admin-payment-reminder",
      },
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
      text,
    });
  } catch (err) {
    return Response.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
