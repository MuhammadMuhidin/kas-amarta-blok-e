import { GET as getCashSummary } from "@/app/api/sheets/summary/route";
import { getIntegrationConfigString } from "@/lib/integrationConfig";
import { sendWaMessage } from "@/lib/waClient";

const FALLBACK_PUBLIC_KAS_URL = "https://www.amarta-2-blok-e.my.id/kas";
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

function sumCashflows(items) {
  return items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function getCurrentExpenseBreakdown(data) {
  const currentCashflows = getCurrentMonthCashflows(data);
  const expenseCashflows = currentCashflows.filter((cashflow) => cashflow.type === "expense");
  const operationalExpense = sumCashflows(expenseCashflows);

  return { operationalExpense };
}

function getOtherIncome(data) {
  const currentCashflows = getCurrentMonthCashflows(data);
  const currentPeriod = getCurrentPeriod(data);
  const payments = Array.isArray(data?.payments) ? data.payments : [];

  // 1. Cashflow with payment_id prefix "trash" and type income
  const trashIncome = currentCashflows
    .filter((cf) => cf.type === "income" && String(cf.payment_id || "").toLowerCase().startsWith("trash"))
    .reduce((sum, cf) => sum + Number(cf.amount || 0), 0);

  // 2. Direct income (type income, no payment_id or empty payment_id)
  const directIncome = currentCashflows
    .filter((cf) => cf.type === "income" && !String(cf.payment_id || "").trim())
    .reduce((sum, cf) => sum + Number(cf.amount || 0), 0);

  // 3. Last month payments paid in current month (cashflow in current month, payment period != current month)
  const paymentById = new Map(payments.map((p) => [String(p.id), p]));
  const lastMonthPaidInCurrent = currentCashflows
    .filter((cf) => cf.type === "income" && cf.payment_id)
    .filter((cf) => {
      const payment = paymentById.get(String(cf.payment_id));
      return payment && String(payment.period || "").slice(0, 7) !== currentPeriod;
    })
    .reduce((sum, cf) => sum + Number(cf.amount || 0), 0);

  return trashIncome + directIncome + lastMonthPaidInCurrent;
}

function buildText(data, publicKasUrl) {
  const lastMonth = data?.insight?.lastMonth || {};
  const currentMonth = data?.insight?.currentMonth || {};
  const summary = data?.insight?.summary || {};
  const expenses = Array.isArray(lastMonth.expenses) ? lastMonth.expenses : [];
  const paidHouseCount = countPaidHouses(data);
  const currentPaymentIncome = getCurrentPaymentIncome(data);
  const { operationalExpense } = getCurrentExpenseBreakdown(data);
  const otherIncome = getOtherIncome(data);
  const expenseLines = expenses.length
    ? [...expenses]
        .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
        .map((item, index) => `${index + 1}. ${item.note || "-"} ${money(item.amount)}`)
    : [`Tidak ada pengeluaran pada bulan ${lastMonth.month || "lalu"}.`];
  const currentSummaryLines = [
    `- Iuran kas warga: ${money(currentPaymentIncome)} dari ${paidHouseCount} rumah`,
    `- Pengeluaran bulan berjalan: ${money(operationalExpense)}`,
  ];

  if (otherIncome > 0) {
    currentSummaryLines.push(`- Pemasukan lainnya: ${money(otherIncome)}`);
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
