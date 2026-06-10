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

function isReimbursementIncome(cashflow) {
  const note = normalizeLower(cashflow?.note);
  const refId = normalizeLower(cashflow?.ref_id || cashflow?.payment_id);

  return (
    note.includes("pengembalian talangan") ||
    note.includes("reimbursement") ||
    refId.startsWith("trashadv-")
  );
}

function isAdvanceExpense(cashflow) {
  const note = normalizeLower(cashflow?.note);
  const refId = normalizeLower(cashflow?.ref_id || cashflow?.payment_id);

  return (
    note.includes("talangan") ||
    note.includes("advance") ||
    refId.startsWith("trashadv-")
  );
}

function sumCashflows(items) {
  return items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function getCurrentCashflowBreakdown(data) {
  const currentCashflows = getCurrentMonthCashflows(data);
  const incomeCashflows = currentCashflows.filter((cashflow) => cashflow.type === "income");
  const expenseCashflows = currentCashflows.filter((cashflow) => cashflow.type === "expense");
  const reimbursementIncome = sumCashflows(incomeCashflows.filter(isReimbursementIncome));
  const currentPaymentIncome = getCurrentPaymentIncome(data);
  const nonDuesIncome = Math.max(
    0,
    sumCashflows(incomeCashflows) - currentPaymentIncome - reimbursementIncome,
  );
  const advanceExpense = sumCashflows(expenseCashflows.filter(isAdvanceExpense));
  const operationalExpense = Math.max(0, sumCashflows(expenseCashflows) - advanceExpense);

  return {
    currentPaymentIncome,
    reimbursementIncome,
    nonDuesIncome,
    advanceExpense,
    operationalExpense,
  };
}

function buildText(data) {
  const lastMonth = data?.insight?.lastMonth || {};
  const currentMonth = data?.insight?.currentMonth || {};
  const summary = data?.insight?.summary || {};
  const expenses = Array.isArray(lastMonth.expenses) ? lastMonth.expenses : [];
  const paidHouseCount = countPaidHouses(data);
  const {
    currentPaymentIncome,
    reimbursementIncome,
    nonDuesIncome,
    advanceExpense,
    operationalExpense,
  } = getCurrentCashflowBreakdown(data);
  const availableCash = Number(summary.currentIncomePlusLastRemaining || 0);
  const expenseLines = expenses.length
    ? [...expenses]
        .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
        .map((item, index) => `${index + 1}. ${item.note || "-"} ${money(item.amount)}`)
    : [`Tidak ada pengeluaran pada bulan ${lastMonth.month || "lalu"}.`];
  const incomeLines = [
    `- Pembayaran kas warga: ${money(currentPaymentIncome)} dari ${paidHouseCount} rumah`,
  ];
  const currentExpenseLines = [];
  const notes = [];

  if (reimbursementIncome > 0) {
    incomeLines.push(`- Pengembalian talangan: ${money(reimbursementIncome)}`);
    notes.push("Pengembalian talangan adalah dana kas yang sebelumnya dipakai sementara dan sudah dikembalikan oleh warga terkait.");
  }

  if (nonDuesIncome > 0) {
    incomeLines.push(`- Pemasukan non-iuran: ${money(nonDuesIncome)}`);
  }

  incomeLines.push(`- Saldo awal bulan: ${money(lastMonth.remaining)}`);

  if (operationalExpense > 0) {
    currentExpenseLines.push(`- Pengeluaran operasional: ${money(operationalExpense)}`);
  }

  if (advanceExpense > 0) {
    currentExpenseLines.push(`- Talangan sementara: ${money(advanceExpense)}`);
    notes.push("Talangan sementara dicatat sebagai pengeluaran kas, namun bukan beban akhir karena akan dikembalikan oleh warga terkait.");
  }

  if (!currentExpenseLines.length) {
    currentExpenseLines.push("- Tidak ada pengeluaran bulan ini.");
  }

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
    "",
    `Total kas tersedia: ${money(availableCash)}`,
    "",
    "Pengeluaran bulan ini:",
    ...currentExpenseLines,
    `Total pengeluaran bulan ini: ${money(currentMonth.expenseTotal)}`,
    `Sisa saldo saat ini: ${money(summary.currentBalance)}`,
    ...(notes.length ? ["", "Catatan:", ...notes.map((note) => `- ${note}`)] : []),
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
