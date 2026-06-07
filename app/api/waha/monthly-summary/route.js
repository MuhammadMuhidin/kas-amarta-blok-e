import { GET as getCashSummary } from "@/app/api/sheets/summary/route";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { getWhatsAppWorkflowDefaults, triggerWhatsAppWorkflow } from "@/lib/whatsappWorkflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PUBLIC_KAS_URL = "https://amarta-residence.vercel.app/kas";
const money = (value) => `Rp${Number(value || 0).toLocaleString("id-ID")}`;

async function getSummary() {
  const response = await getCashSummary();

  if (!response.ok) {
    throw new Error("Gagal mengambil data dari API summary");
  }

  return response.json();
}

function countPaidHouses(data) {
  const payments = Array.isArray(data?.payments) ? data.payments : [];
  const periods = Array.isArray(data?.periods) ? data.periods : [];
  const currentPeriod = [...periods].sort((a, b) => a.localeCompare(b)).pop();

  if (!currentPeriod) return 0;

  return new Set(
    payments
      .filter((payment) => String(payment.period || "").slice(0, 7) === currentPeriod)
      .map((payment) => String(payment.person_house || payment.house || payment.person_id || ""))
      .filter(Boolean),
  ).size;
}

function getCurrentPeriod(data) {
  const periods = Array.isArray(data?.periods) ? data.periods : [];
  const currentPeriod = [...periods].sort((a, b) => a.localeCompare(b)).pop();

  return currentPeriod || new Date().toISOString().slice(0, 7);
}

function buildText(data) {
  const lastMonth = data?.insight?.lastMonth || {};
  const currentMonth = data?.insight?.currentMonth || {};
  const summary = data?.insight?.summary || {};
  const expenses = Array.isArray(lastMonth.expenses) ? lastMonth.expenses : [];
  const paidHouseCount = countPaidHouses(data);
  const expenseLines = expenses.length
    ? [...expenses]
        .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
        .map((item, index) => `${index + 1}. ${item.note || "-"} ${money(item.amount)}`)
    : [`Tidak ada pengeluaran pada bulan ${lastMonth.month || "lalu"}.`];

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
    `Kas masuk bulan ${currentMonth.month || "ini"} dari ${paidHouseCount} rumah ditambah sisa saldo bulan lalu: ${money(summary.currentIncomePlusLastRemaining)}`,
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

export async function POST(req) {
  try {
    if (!(await isAdmin(req))) {
      return unauthorized();
    }

    if (!validateCSRF(req)) {
      return Response.json({ error: "CSRF tidak valid" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const summary = await getSummary();
    const text = buildText(summary);
    const defaults = getWhatsAppWorkflowDefaults();
    const period = String(body.period || getCurrentPeriod(summary));
    const chatId = String(body.chatId || defaults.reportChatId || "").trim();
    const sessionId = String(body.sessionId || defaults.sessionId || "main").trim();
    const targetEnv = String(body.targetEnv || defaults.targetEnv || "development").trim();

    if (body.preview === true) {
      return Response.json({ ok: true, preview: true, source: "/api/sheets/summary", chatId, session: sessionId, targetEnv, period, text });
    }

    const workflow = await triggerWhatsAppWorkflow({
      chatId,
      message: text,
      period,
      sessionId,
      targetEnv,
      source: "admin-overview",
    });

    return Response.json({
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
    });
  } catch (err) {
    return Response.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
