import { GET as getSheetsSummary } from "@/app/api/sheets/summary/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WAHA_SEND_TEXT_URI =
  process.env.WAHA_SEND_TEXT_URI ||
  process.env.WAHA_SEND_TEXT_URL ||
  "https://geh929l.waha.bocindonesia.com/api/sendText";
const WAHA_API_KEY = process.env.WAHA_API_KEY;
const WAHA_CHAT_ID = process.env.WAHA_CHAT_ID;
const WAHA_SESSION = process.env.WAHA_SESSION || "default";

function formatMoney(value) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

function getDryRun(req) {
  const { searchParams } = new URL(req.url);

  return searchParams.get("dryRun") === "1";
}

function validateWahaEnv({ dryRun }) {
  if (!WAHA_SEND_TEXT_URI) return "WAHA_SEND_TEXT_URI belum diset di environment";
  if (!WAHA_CHAT_ID) return "WAHA_CHAT_ID belum diset di environment";
  if (!dryRun && !WAHA_API_KEY) return "WAHA_API_KEY belum diset di environment";

  return null;
}

async function loadSummaryFromApi() {
  const response = await getSheetsSummary();

  if (!response.ok) {
    throw new Error("Gagal mengambil data dari API summary");
  }

  return response.json();
}

function buildMonthlySummaryMessage(summaryData) {
  const insight = summaryData?.insight || {};
  const lastMonth = insight.lastMonth || {};
  const currentMonth = insight.currentMonth || {};
  const summary = insight.summary || {};
  const expenses = Array.isArray(lastMonth.expenses) ? lastMonth.expenses : [];

  const expenseLines = expenses.length
    ? [...expenses]
        .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
        .map(
          (item, index) =>
            `${index + 1}. ${formatDate(item.date)} | ${formatMoney(item.amount)} | ${item.note || "-"}`,
        )
    : [`Tidak ada pengeluaran pada bulan ${lastMonth.month || "lalu"}.`];

  return [
    `*Laporan Kas Amarta Residence 2 Blok E*`,
    ``,
    `*Detail pengeluaran bulan ${lastMonth.month || "lalu"}:*`,
    ...expenseLines,
    ``,
    `Total pengeluaran ${lastMonth.month || "bulan lalu"}: ${formatMoney(lastMonth.expenseTotal)}`,
    `Sisa saldo kumulatif per ${lastMonth.month || "bulan lalu"}: ${formatMoney(lastMonth.remaining)}`,
    `Kas bulan ${currentMonth.month || "berjalan"} + sisa bulan lalu: ${formatMoney(summary.currentIncomePlusLastRemaining)}`,
    `Pengeluaran bulan ini: ${formatMoney(currentMonth.expenseTotal)}`,
    ``,
    `*Total saldo saat ini:*`,
    `${formatMoney(summary.currentBalance)}`,
  ].join("\n");
}

async function sendToWaha(text) {
  const res = await fetch(WAHA_SEND_TEXT_URI, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": WAHA_API_KEY,
    },
    body: JSON.stringify({
      chatId: WAHA_CHAT_ID,
      text,
      session: WAHA_SESSION,
    }),
  });

  const responseText = await res.text();
  let responseBody = responseText;

  try {
    responseBody = JSON.parse(responseText);
  } catch {
    // Keep plain text response.
  }

  return {
    ok: res.ok,
    status: res.status,
    detail: responseBody,
  };
}

export async function GET(req) {
  try {
    const dryRun = getDryRun(req);
    const envError = validateWahaEnv({ dryRun });

    if (envError) {
      return Response.json(
        {
          error: envError,
        },
        {
          status: 500,
        },
      );
    }

    const summaryData = await loadSummaryFromApi();
    const text = buildMonthlySummaryMessage(summaryData);

    if (dryRun) {
      return Response.json({
        ok: true,
        dryRun: true,
        source: "/api/sheets/summary",
        chatId: WAHA_CHAT_ID,
        session: WAHA_SESSION,
        text,
      });
    }

    const waha = await sendToWaha(text);

    if (!waha.ok) {
      return Response.json(
        {
          error: "Gagal mengirim pesan ke WAHA",
          status: waha.status,
          detail: waha.detail,
        },
        {
          status: 502,
        },
      );
    }

    return Response.json({
      ok: true,
      source: "/api/sheets/summary",
      chatId: WAHA_CHAT_ID,
      session: WAHA_SESSION,
      text,
      waha: waha.detail,
    });
  } catch (err) {
    return Response.json(
      {
        error: err.message || "Internal Server Error",
      },
      {
        status: 500,
      },
    );
  }
}
