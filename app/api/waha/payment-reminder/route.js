import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { recordAdminActivity } from "@/lib/adminActivity";
import { getIntegrationConfigString } from "@/lib/integrationConfig";
import { enforceRateLimit, RATE_LIMIT_SCOPES } from "@/lib/rateLimit";
import { sendWaMessage } from "@/lib/waClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_PAYMENT_REMINDER_MESSAGE = [
  "Assalamu’alaikum bapak/ibu warga Amarta Residence 2 Blok E.",
  "",
  "Izin mengingatkan bahwa pembayaran kas dan sampah bulan ini jatuh tempo hari ini. Bagi bapak/ibu yang belum melakukan pembayaran, mohon dapat segera melakukan pembayaran.",
  "",
  "Terima kasih 🙏",
  "",
  "_Pesan ini dikirim secara otomatis._",
].join("\n");

function normalize(value) {
  return String(value || "").trim();
}

function getCurrentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

export async function POST(req) {
  try {
    if (!(await isAdmin(req))) return unauthorized();

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
    const text = normalize(body.message) || DEFAULT_PAYMENT_REMINDER_MESSAGE;
    const period = normalize(body.period) || getCurrentPeriod();
    const [configuredChatId, configuredSessionId] = await Promise.all([
      getIntegrationConfigString("WA_REPORT_CHAT_ID"),
      getIntegrationConfigString("WA_SESSION_ID", "main"),
    ]);
    const chatId = normalize(body.chatId || configuredChatId || process.env.WA_CHAT_ID);
    const sessionId = normalize(configuredSessionId) || "main";

    if (body.preview === true) {
      return Response.json({
        ok: true,
        preview: true,
        delivery: "external-api",
        chatId,
        session: sessionId,
        period,
        text,
      });
    }

    await sendWaMessage({
      chatId,
      text,
      source: "admin-payment-reminder",
    });

    await recordAdminActivity(req, {
      type: "send",
      module: "whatsapp",
      severity: "success",
      message: "Send payment reminder WhatsApp",
      metadata: {
        target: "resident_group",
        delivery: "external-api",
        message_length: text.length,
        period,
        source: "admin-payment-reminder",
      },
    });

    return Response.json({
      ok: true,
      sent: true,
      delivery: "external-api",
      chatId,
      session: sessionId,
      period,
      text,
    });
  } catch (err) {
    return Response.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
