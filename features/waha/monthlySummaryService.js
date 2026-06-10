import { GET as getCashSummary } from "@/app/api/sheets/summary/route";
import {
  getWhatsAppWorkflowDefaults,
  triggerWhatsAppWorkflow,
} from "@/lib/whatsappWorkflow";

const PUBLIC_KAS_URL = "https://amarta-residence.vercel.app/kas";
const money = (value) => `Rp${Number(value || 0).toLocaleString("id-ID")}`;

async function getSummary() {
  const response = await getCashSummary();

  if (!response.ok) {
    throw new Error("Gagal mengambil data dari API summary");
  }

  return response.json();
}

function getCurrentPeriod(data) {
  const periods = Array.isArray(data?.periods) ? data.periods : [];
  const currentPeriod = [...periods].sort((a, b) => a.localeCompare(b)).pop();

  return currentPeriod || new Date().toISOString().slice(0, 7);
}

function getCurrentPeriodPayments(data) {
  const payments = Array.isArray(data?.payments) ? data.payments : [];
  const currentPeriod = getCurrentPeriod(data);

  return payments.filter((payment) => String(payment.period || "").slice(0, 7) === currentPeriod);
}

function countPaidHouses(data) {
  return new Set(
    getCurrentPeriodPayments(data)
      .map((payment) => String(payment.person_house || payment.house || payment.person_id || ""))
      .filter(Boolean),
  ).size;
}

function getCurrentPaymentIncome(data) {
  return getCurrentPeriodPayments(data).reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );
}

function buildText(data) {
  const lastMonth = data?.insight?.lastMonth || {};
  const currentMonth = data?.insight?.currentMonth || {};
  const summary = data?.insight?.summary || {};
  const expenses = Array.isArray(lastMonth.expenses) ? lastMonth.expenses : [];
  const paidHouseCount = countPaidHouses(data);
  const currentPaymentIncome = getCurrentPaymentIncome(data);
  const currentOtherIncome = Math.max(0, Number(currentMonth.income || 0) - currentPaymentIncome);
  const availableCash = Number(summary.currentIncomePlusLastRemaining || 0);
  const expenseLines = expenses.length
    ? [...expenses]
        .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
        .map((item, index) => `${index + 1}. ${item.note || "-"} ${money(item.amount)}`)
    : [`Tidak ada pengeluaran pada bulan ${lastMonth.month || "lalu"}.`];
  const incomeLines = [
    `Pembayaran kas warga: ${money(currentPaymentIncome)} dari ${paidHouseCount} rumah`,
  ];

  if (currentOtherIncome > 0) {
    incomeLines.push(`Pemasukan lainnya: ${money(currentOtherIncome)}`);
  }

  incomeLines.push(`Sisa saldo bulan lalu: ${money(lastMonth.remaining)}`);

  return [
    "Assalamu’alaikum, selamat malam Bapak-Bapak.",
    "",
    "Izin menyampaikan rekap uang kas Amarta Residence 2 Blok E.",
    "",
    "Rincian pengeluaran bulan lalu:",
    ...expenseLines,
    "",
    `Total pengeluaran: ${money(lastMonth.expenseTotal)}`,
    `Sisa saldo bulan lalu: ${money(lastMonth.remaining)}`,
    "",
    `Kas tersedia bulan ${currentMonth.month || "ini"} terdiri dari:`,
    ...incomeLines,
    `Total kas tersedia: ${money(availableCash)}`,
    "",
    `Pengeluaran bulan ini: ${money(currentMonth.expenseTotal)}`,
    `Saldo kas saat ini: ${money(summary.currentBalance)}`,
    "",
    "Bagi Bapak-Bapak yang ingin mengecek rincian pemasukan dan pengeluaran dana kas, dapat melihatnya melalui tautan berikut:",
    "",
    PUBLIC_KAS_URL,
    "",
    "Terima kasih.",
    "",
    "_Pesan ini dikirim secara otomatis._",
  ].join("\n");
}

export async function runMonthlySummaryWorkflow(body = {}) {
  const summary = await getSummary();
  const text = buildText(summary);
  const defaults = getWhatsAppWorkflowDefaults();
  const period = String(body.period || getCurrentPeriod(summary));
  const chatId = String(body.chatId || defaults.reportChatId || "").trim();
  const sessionId = String(body.sessionId || defaults.sessionId || "main").trim();
  const targetEnv = String(body.targetEnv || defaults.targetEnv || "development").trim();

  if (body.preview === true) {
    return {
      ok: true,
      preview: true,
      source: "/api/sheets/summary",
      chatId,
      session: sessionId,
      targetEnv,
      period,
      text,
    };
  }

  const workflow = await triggerWhatsAppWorkflow({
    chatId,
    message: text,
    period,
    sessionId,
    targetEnv,
    source: "admin-overview",
  });

  return {
    ok: true,
    queued: true,
    jobId: workflow.jobId,
    workflow,
    source: "/api/sheets/summary",
    chatId,
    session: sessionId,
    targetEnv,
    period,
    text,
  };
}
