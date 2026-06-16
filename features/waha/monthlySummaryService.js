import { GET as getCashSummary } from "@/app/api/sheets/summary/route";
import { getIntegrationConfigString } from "@/lib/integrationConfig";
import { sendWaMessage } from "@/lib/waClient";

const FALLBACK_PUBLIC_KAS_URL = "https://amarta-residence.vercel.app/kas";
const money = (value) => `Rp${Number(value || 0).toLocaleString("id-ID")}`;

async function getSummary() {
  const response = await getCashSummary();

  if (!response.ok) {
    throw new Error("Gagal mengambil data dari API summary");
  }

  return response.json();
}

function normalize(value) {
  return String(value || "").trim();
}

function normalizeLower(value) {
  return normalize(value).toLowerCase();
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

function getCurrentMonthCashflows(data) {
  const cashflows = Array.isArray(data?.cashflows) ? data.cashflows : [];
  const currentPeriod = getCurrentPeriod(data);

  return cashflows.filter((cashflow) => String(cashflow.date || "").slice(0, 7) === currentPeriod);
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

function isAdvanceExpense(cashflow) {
  const note = normalizeLower(cashflow?.note);
  const refId = normalizeLower(cashflow?.ref_id || cashflow?.payment_id);

  return note.includes("talangan") || note.includes("advance") || refId.startsWith("trashadv-");
}

function sumCashflows(items) {
  return items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function getCurrentExpenseBreakdown(data) {
  const currentCashflows = getCurrentMonthCashflows(data);
  const expenseCashflows = currentCashflows.filter((cashflow) => cashflow.type === "expense");
  const trashAdvanceExpense = sumCashflows(expenseCashflows.filter(isAdvanceExpense));
  const operationalExpense = Math.max(0, sumCashflows(expenseCashflows) - trashAdvanceExpense);

  return { operationalExpense, trashAdvanceExpense };
}

function buildText(data, publicKasUrl) {
  const lastMonth = data?.insight?.lastMonth || {};
  const currentMonth = data?.insight?.currentMonth || {};
  const summary = data?.insight?.summary || {};
  const expenses = Array.isArray(lastMonth.expenses) ? lastMonth.expenses : [];
  const paidHouseCount = countPaidHouses(data);
  const currentPaymentIncome = getCurrentPaymentIncome(data);
  const { operationalExpense, trashAdvanceExpense } = getCurrentExpenseBreakdown(data);
  const expenseLines = expenses.length
    ? [...expenses]
        .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
        .map((item, index) => `${index + 1}. ${item.note || "-"} ${money(item.amount)}`)
    : [`Tidak ada pengeluaran pada bulan ${lastMonth.month || "lalu"}.`];
  const currentSummaryLines = [
    `- Iuran kas warga: ${money(currentPaymentIncome)} dari ${paidHouseCount} rumah`,
    `- Pengeluaran operasional: ${money(operationalExpense)}`,
  ];

  if (trashAdvanceExpense > 0) {
    currentSummaryLines.push(`- Talangan iuran sampah: ${money(trashAdvanceExpense)}`);
  }

  return [
    "Assalamu’alaikum, selamat malam Bapak-Bapak.",
    "",
    "Izin menyampaikan rekap uang kas Amarta Residence 2 Blok E.",
    "",
    "Rincian pengeluaran bulan lalu:",
    ...expenseLines,
    "",
    `Total pengeluaran bulan lalu: ${money(lastMonth.expenseTotal)}`,
    `Sisa saldo bulan lalu: ${money(lastMonth.remaining)}`,
    "",
    `Rekap kas bulan ${currentMonth.month || "ini"}:`,
    ...currentSummaryLines,
    "",
    `Sisa saldo saat ini: ${money(summary.currentBalance)}`,
    "",
    "Rincian lengkap:",
    publicKasUrl,
    "",
    "Terima kasih.",
    "",
    "_Pesan ini dikirim secara otomatis._",
  ].join("\n");
}

export async function runMonthlySummaryWorkflow(body = {}) {
  const [summary, configuredChatId, configuredSessionId, appUrl] = await Promise.all([
    getSummary(),
    getIntegrationConfigString("WA_REPORT_CHAT_ID"),
    getIntegrationConfigString("WA_SESSION_ID", "main"),
    getIntegrationConfigString("APP_URL"),
  ]);
  const publicKasUrl = appUrl ? `${appUrl.replace(/\/$/, "")}/kas` : FALLBACK_PUBLIC_KAS_URL;
  const text = buildText(summary, publicKasUrl);
  const period = String(body.period || getCurrentPeriod(summary));
  const chatId = normalize(body.chatId || configuredChatId || process.env.WA_CHAT_ID);
  const sessionId = normalize(configuredSessionId) || "main";

  if (body.preview === true) {
    return {
      ok: true,
      preview: true,
      delivery: "external-api",
      source: "/api/sheets/summary",
      chatId,
      session: sessionId,
      period,
      text,
    };
  }

  await sendWaMessage({
    chatId,
    text,
    source: "admin-overview",
  });

  return {
    ok: true,
    sent: true,
    delivery: "external-api",
    source: "/api/sheets/summary",
    chatId,
    session: sessionId,
    period,
    text,
  };
}
