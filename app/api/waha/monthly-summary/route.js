import { getSheetData } from "@/lib/google";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WAHA_SEND_TEXT_URL =
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

function getJakartaMonthStart() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "Asia/Jakarta",
  }).formatToParts(new Date());

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);

  return new Date(year, month - 1, 1);
}

function getMonthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function getMonthLabel(date) {
  return date.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

function normalizeCashflow(row) {
  return {
    type: String(row.type || "").toLowerCase(),
    date: row.date || "",
    note: row.note || "-",
    amount: Number(row.amount || 0),
  };
}

function buildMonthlySummaryMessage(cashflows) {
  const currentMonthStart = getJakartaMonthStart();
  const lastMonthStart = new Date(
    currentMonthStart.getFullYear(),
    currentMonthStart.getMonth() - 1,
    1,
  );

  const lastMonthKey = getMonthKey(lastMonthStart);
  const currentMonthLabel = getMonthLabel(currentMonthStart);
  const lastMonthLabel = getMonthLabel(lastMonthStart);

  const lastMonthTransactions = cashflows
    .filter((item) => String(item.date || "").slice(0, 7) === lastMonthKey)
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

  const lastMonthIncome = lastMonthTransactions
    .filter((item) => item.type === "income")
    .reduce((total, item) => total + item.amount, 0);

  const lastMonthExpense = lastMonthTransactions
    .filter((item) => item.type === "expense")
    .reduce((total, item) => total + item.amount, 0);

  const currentBalance = cashflows.reduce((total, item) => {
    if (item.type === "income") return total + item.amount;
    if (item.type === "expense") return total - item.amount;
    return total;
  }, 0);

  const transactionLines = lastMonthTransactions.length
    ? lastMonthTransactions.map((item, index) => {
        const typeLabel = item.type === "income" ? "Pemasukan" : "Pengeluaran";
        const sign = item.type === "income" ? "+" : "-";

        return `${index + 1}. ${formatDate(item.date)} | ${typeLabel} | ${sign}${formatMoney(item.amount)} | ${item.note}`;
      })
    : [`Tidak ada transaksi pada bulan ${lastMonthLabel}.`];

  return [
    `*Laporan Kas Amarta Residence 2 Blok E*`,
    ``,
    `*Transaksi bulan ${lastMonthLabel}:*`,
    ...transactionLines,
    ``,
    `Total pemasukan ${lastMonthLabel}: ${formatMoney(lastMonthIncome)}`,
    `Total pengeluaran ${lastMonthLabel}: ${formatMoney(lastMonthExpense)}`,
    ``,
    `*Saldo terkini bulan ${currentMonthLabel}:*`,
    `${formatMoney(currentBalance)}`,
  ].join("\n");
}

function getDryRun(req, body) {
  const { searchParams } = new URL(req.url);

  return body?.dryRun === true || searchParams.get("dryRun") === "1";
}

function validateWahaEnv({ dryRun }) {
  if (!WAHA_CHAT_ID) return "WAHA_CHAT_ID belum diset di environment";
  if (!dryRun && !WAHA_API_KEY) return "WAHA_API_KEY belum diset di environment";

  return null;
}

export async function POST(req) {
  try {
    if (!(await isAdmin(req))) {
      return unauthorized();
    }

    if (!validateCSRF(req)) {
      return Response.json(
        {
          error: "CSRF tidak valid",
        },
        {
          status: 403,
        },
      );
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = getDryRun(req, body);
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

    const rows = await getSheetData();
    const cashflows = rows
      .filter(
        (row) =>
          row.__type === "cashflow" &&
          ["income", "expense"].includes(String(row.type || "").toLowerCase()),
      )
      .map(normalizeCashflow);

    const text = buildMonthlySummaryMessage(cashflows);

    if (dryRun) {
      return Response.json({
        ok: true,
        dryRun: true,
        chatId: WAHA_CHAT_ID,
        session: WAHA_SESSION,
        text,
      });
    }

    const wahaRes = await fetch(WAHA_SEND_TEXT_URL, {
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

    const responseText = await wahaRes.text();
    let responseBody = responseText;

    try {
      responseBody = JSON.parse(responseText);
    } catch {
      // Keep plain text response.
    }

    if (!wahaRes.ok) {
      return Response.json(
        {
          error: "Gagal mengirim pesan ke WAHA",
          status: wahaRes.status,
          detail: responseBody,
        },
        {
          status: 502,
        },
      );
    }

    return Response.json({
      ok: true,
      chatId: WAHA_CHAT_ID,
      session: WAHA_SESSION,
      text,
      waha: responseBody,
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
