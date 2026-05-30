import { randomUUID } from "crypto";
import { GET as getSheetsSummary } from "@/app/api/sheets/summary/route";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WA_CHAT_ID = process.env.WA_CHAT_ID || process.env.WAHA_CHAT_ID;
const WA_SESSION_ID = process.env.WA_SESSION_ID || process.env.WAHA_SESSION || "main";
const WA_TARGET_ENV = process.env.WA_TARGET_ENV || "development";
const PUBLIC_KAS_URL = "https://amarta-residence.vercel.app/kas";
const GITHUB_OWNER = process.env.GITHUB_OWNER || "MuhammadMuhidin";
const GITHUB_REPO = process.env.GITHUB_REPO || "kas-amarta-blok-e";
const GITHUB_WORKFLOW_ID = process.env.GITHUB_WORKFLOW_ID || "send-wa-once.yml";
const GITHUB_WORKFLOW_REF = process.env.GITHUB_WORKFLOW_REF || "development";
const GITHUB_ACTIONS_TOKEN = process.env.GITHUB_ACTIONS_TOKEN;

const money = (value) => `Rp${Number(value || 0).toLocaleString("id-ID")}`;

async function getSummary() {
  const response = await getSheetsSummary();

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

async function triggerWhatsAppWorkflow({ jobId, chatId, message, period, sessionId, targetEnv }) {
  if (!GITHUB_ACTIONS_TOKEN) {
    throw new Error("GITHUB_ACTIONS_TOKEN belum dikonfigurasi.");
  }

  if (!chatId) {
    throw new Error("WA_CHAT_ID belum dikonfigurasi.");
  }

  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW_ID}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_ACTIONS_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: GITHUB_WORKFLOW_REF,
        inputs: {
          jobId,
          sessionId,
          targetEnv,
          chatId,
          message,
          period,
          source: "admin-overview",
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gagal trigger GitHub Actions (${response.status}): ${detail}`);
  }

  return { ok: true, status: response.status };
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
    const period = String(body.period || getCurrentPeriod(summary));
    const chatId = String(body.chatId || WA_CHAT_ID || "").trim();
    const sessionId = String(body.sessionId || WA_SESSION_ID || "main").trim();
    const targetEnv = String(body.targetEnv || WA_TARGET_ENV || "development").trim();

    if (body.preview === true) {
      return Response.json({ ok: true, preview: true, source: "/api/sheets/summary", chatId, session: sessionId, targetEnv, period, text });
    }

    const jobId = randomUUID();
    const workflow = await triggerWhatsAppWorkflow({
      jobId,
      chatId,
      message: text,
      period,
      sessionId,
      targetEnv,
    });

    return Response.json({
      ok: true,
      queued: true,
      jobId,
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
