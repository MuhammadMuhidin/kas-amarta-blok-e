import { GET as getSheetsSummary } from "@/app/api/sheets/summary/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WAHA_SEND_TEXT_URI = process.env.WAHA_SEND_TEXT_URI;
const WAHA_API_KEY = process.env.WAHA_API_KEY;
const WAHA_CHAT_ID = process.env.WAHA_CHAT_ID;
const WAHA_SESSION = process.env.WAHA_SESSION;

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

function buildText(data) {
  const lastMonth = data?.insight?.lastMonth || {};
  const currentMonth = data?.insight?.currentMonth || {};
  const summary = data?.insight?.summary || {};
  const expenses = Array.isArray(lastMonth.expenses) ? lastMonth.expenses : [];
  const paidHouseCount = countPaidHouses(data);
  const expenseLines = expenses.length
    ? [...expenses]
        .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
        .map((item, index) => `${index + 1}. ${item.note || "-"} | ${money(item.amount)}`)
    : [`Tidak ada pengeluaran pada bulan ${lastMonth.month || "lalu"}.`];

  return [
    "*Laporan Kas Amarta Residence 2 Blok E*",
    "",
    `*Detail pengeluaran bulan ${lastMonth.month || "lalu"}:*`,
    ...expenseLines,
    "",
    `Total pengeluaran ${lastMonth.month || "bulan lalu"}: ${money(lastMonth.expenseTotal)}`,
    `Sisa saldo kumulatif per ${lastMonth.month || "bulan lalu"}: ${money(lastMonth.remaining)}`,
    "",
    `Kas bulan ${currentMonth.month || "berjalan"} dari ${paidHouseCount} rumah + sisa bulan lalu: ${money(summary.currentIncomePlusLastRemaining)}`,
    `Pengeluaran bulan ini: ${money(currentMonth.expenseTotal)}`,
    "",
    "*Total saldo saat ini:*",
    money(summary.currentBalance),
    "",
    "```ini adalah pesan otomatis, tidak perlu dibalas.```",
  ].join("\n");
}

async function sendText(text) {
  const response = await fetch(WAHA_SEND_TEXT_URI, {
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

  const raw = await response.text();
  let detail = raw;

  try {
    detail = JSON.parse(raw);
  } catch {}

  return {
    ok: response.ok,
    status: response.status,
    detail,
  };
}

export async function GET() {
  try {
    const summary = await getSummary();
    const text = buildText(summary);
    const waha = await sendText(text);

    if (!waha.ok) {
      return Response.json({ error: "Gagal mengirim pesan ke WAHA", status: waha.status, detail: waha.detail }, { status: 502 });
    }

    return Response.json({ ok: true, source: "/api/sheets/summary", chatId: WAHA_CHAT_ID, session: WAHA_SESSION, text, waha: waha.detail });
  } catch (err) {
    return Response.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
