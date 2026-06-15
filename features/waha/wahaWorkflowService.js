import { sendAlertEmail } from "@/lib/emailAlert";
import {
  getWhatsAppWorkflowDefaults,
  triggerWhatsAppWorkflow,
} from "@/lib/whatsappWorkflow";

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function formatPeriod(value) {
  const normalized = String(value || "").trim();
  const match = /^(\d{4})-(\d{2})$/.exec(normalized);
  if (!match) return normalized || "-";
  const month = MONTH_NAMES[Number(match[2]) - 1];
  return month ? `${month} ${match[1]}` : normalized;
}

function buildEmailMessage({ message, period, source }) {
  if (source !== "admin-test-alert") return message;
  return [
    "Uji Notifikasi Sistem",
    "",
    "Status: Berhasil",
    "Keterangan: Permintaan uji notifikasi dari menu Monitoring berhasil diproses.",
    `Periode: ${formatPeriod(period)}`,
    "Sumber: Aplikasi",
  ].join("\n");
}

export async function runWhatsAppWorkflow(body = {}) {
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

  const email = await sendAlertEmail({
    message: buildEmailMessage({ message, period, source }),
    period,
    source,
    subject: source === "admin-test-alert"
      ? `[Amarta Kas] Uji Notifikasi Sistem - ${formatPeriod(period)}`
      : body.emailSubject,
  });

  return {
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
  };
}
