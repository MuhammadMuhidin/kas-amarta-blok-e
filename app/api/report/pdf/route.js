import { getAppConfig } from "@/lib/appConfig";
import { getReportSummary } from "@/lib/reportSummary";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatMoney(value) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
}

function getJakartaPrintedAt() {
  const now = new Date();
  const tanggal = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(now);
  const jam = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(now);

  return `${tanggal} pukul ${jam} WIB`;
}

function safeText(value, fallback = "-") {
  const text = String(value || "").trim();
  return text || fallback;
}

function addHeader(doc, title, subtitle, printedAt) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 38, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, 15, 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(subtitle, 15, 24);
  doc.text(`Dicetak ${printedAt}`, 15, 31);
}

function addFooter(doc, printedAt) {
  const pageCount = doc.internal.getNumberOfPages();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(229, 231, 235);
    doc.line(15, 287, 195, 287);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`Kas Amarta Blok E • Sistem Keuangan Internal • Dicetak ${printedAt}`, 15, 292);
    doc.text(`Halaman ${page} / ${pageCount}`, 195, 292, { align: "right" });
  }
}

function sectionTitle(doc, title, y) {
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(title, 15, y);
  return y + 8;
}

function drawTable(doc, { startY, head, body, rightColumns = [] }) {
  const columnStyles = Object.fromEntries(
    rightColumns.map((index) => [index, { halign: "right" }]),
  );

  doc.autoTable({
    startY,
    theme: "grid",
    head: [head],
    body: body.length ? body : [["-", "Tidak ada data", "-"]].slice(0, 1),
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    styles: {
      fontSize: 9,
      cellPadding: 3,
      overflow: "linebreak",
    },
    columnStyles,
  });

  return doc.lastAutoTable.finalY + 12;
}

function buildUnpaidList({ persons, payments, periods, monthlyFee }) {
  const normalizedPeriods = [...new Set(
    periods.map((period) => String(period || "").slice(0, 7)).filter(Boolean),
  )].sort();

  return persons
    .map((person) => {
      const joinMonth = person.join_date?.slice(0, 7);
      const validPeriods = normalizedPeriods.filter((period) => !joinMonth || period >= joinMonth);
      const paidPeriods = new Set(
        payments
          .filter((payment) => payment.person_id === person.id && payment.person_house === person.house)
          .map((payment) => payment.period?.slice(0, 7)),
      );
      const unpaid = validPeriods.filter((period) => !paidPeriods.has(period));

      return {
        house: person.house,
        name: person.name,
        jumlah: unpaid.length,
        unpaid,
        total: unpaid.length * monthlyFee,
      };
    })
    .filter((row) => row.jumlah > 0)
    .sort((a, b) => b.total - a.total);
}

export async function GET(req) {
  try {
    const [data, appConfig] = await Promise.all([
      getReportSummary(),
      getAppConfig(),
    ]);

    const {
      insight,
      persons = [],
      payments = [],
      periods = [],
      cashflows = [],
    } = data;

    const monthlyFee = Number(appConfig.monthly_fee || 0);
    const printedAt = getJakartaPrintedAt();
    const now = new Date();
    const currentMonthKey = now.toISOString().slice(0, 7);

    const totalIncome = cashflows
      .filter((cashflow) => cashflow.type === "income")
      .reduce((sum, cashflow) => sum + Number(cashflow.amount || 0), 0);

    const totalExpense = cashflows
      .filter((cashflow) => cashflow.type === "expense")
      .reduce((sum, cashflow) => sum + Number(cashflow.amount || 0), 0);

    const currentBalance = totalIncome - totalExpense;
    const paidHouses = new Set(
      payments
        .filter((payment) => payment.period?.slice(0, 7) === currentMonthKey)
        .map((payment) => payment.person_house),
    ).size;
    const paymentRate = persons.length === 0 ? 0 : Math.round((paidHouses / persons.length) * 100);
    const unpaidList = buildUnpaidList({ persons, payments, periods, monthlyFee });
    const totalReceivables = unpaidList.reduce((sum, row) => sum + row.total, 0);

    const topExpenses = cashflows
      .filter((cashflow) => cashflow.type === "expense")
      .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
      .slice(0, 5);

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    addHeader(doc, "KAS AMARTA RESIDENCE - BLOK E", "Laporan Rekap Keuangan", printedAt);

    let y = 50;
    y = sectionTitle(doc, "Ringkasan Keuangan", y);
    y = drawTable(doc, {
      startY: y,
      head: ["Keterangan", "Nilai"],
      body: [
        ["Total Pemasukan", formatMoney(totalIncome)],
        ["Total Pengeluaran", formatMoney(totalExpense)],
        ["Saldo Saat Ini", formatMoney(currentBalance)],
        ["Iuran Bulanan", formatMoney(monthlyFee)],
        ["Jumlah Rumah Aktif", `${persons.length} rumah`],
        ["Rumah Sudah Bayar Bulan Ini", `${paidHouses} rumah`],
        ["Persentase Pembayaran", `${paymentRate}%`],
      ],
      rightColumns: [1],
    });

    y = sectionTitle(doc, "Rekap Bulanan", y);
    y = drawTable(doc, {
      startY: y,
      head: ["Keterangan", "Nilai"],
      body: [
        [`Pengeluaran bulan ${safeText(insight?.lastMonth?.month)}`, formatMoney(insight?.lastMonth?.expenseTotal || 0)],
        [`Saldo kumulatif per ${safeText(insight?.lastMonth?.month)}`, formatMoney(insight?.lastMonth?.remaining || 0)],
        [`Kas bulan ${safeText(insight?.currentMonth?.month)} + sisa bulan lalu`, formatMoney(insight?.summary?.currentIncomePlusLastRemaining || 0)],
        ["Pengeluaran bulan ini", formatMoney(insight?.currentMonth?.expenseTotal || 0)],
      ],
      rightColumns: [1],
    });

    y = sectionTitle(doc, "Top 5 Pengeluaran Terbesar", y);
    y = drawTable(doc, {
      startY: y,
      head: ["Tanggal", "Keterangan", "Nominal"],
      body: topExpenses.map((expense) => [
        safeText(expense.date),
        safeText(expense.note),
        formatMoney(expense.amount),
      ]),
      rightColumns: [2],
    });

    doc.addPage();
    addHeader(doc, "DETAIL PENGELUARAN", `${safeText(insight?.lastMonth?.month)} & ${safeText(insight?.currentMonth?.month)}`, printedAt);

    y = 50;
    y = sectionTitle(doc, `Pengeluaran Bulan Lalu (${safeText(insight?.lastMonth?.month)})`, y);
    y = drawTable(doc, {
      startY: y,
      head: ["Tanggal", "Keterangan", "Nominal"],
      body: (insight?.lastMonth?.expenses || []).map((expense) => [
        safeText(expense.date),
        safeText(expense.note),
        formatMoney(expense.amount),
      ]),
      rightColumns: [2],
    });

    y = sectionTitle(doc, `Pengeluaran Bulan Berjalan (${safeText(insight?.currentMonth?.month)})`, y);
    drawTable(doc, {
      startY: y,
      head: ["Tanggal", "Keterangan", "Nominal"],
      body: (insight?.currentMonth?.expenses || []).map((expense) => [
        safeText(expense.date),
        safeText(expense.note),
        formatMoney(expense.amount),
      ]),
      rightColumns: [2],
    });

    doc.addPage();
    addHeader(doc, "LAPORAN TUNGGAKAN", "Prioritas pembayaran kas warga", printedAt);

    y = 50;
    y = sectionTitle(doc, "Ringkasan Tunggakan", y);
    y = drawTable(doc, {
      startY: y,
      head: ["Keterangan", "Nilai"],
      body: [
        ["Total rumah menunggak", `${unpaidList.length} rumah`],
        ["Total piutang estimasi", formatMoney(totalReceivables)],
        ["Ringan (1-2 periode)", `${unpaidList.filter((row) => row.jumlah >= 1 && row.jumlah <= 2).length} rumah`],
        ["Sedang (3-5 periode)", `${unpaidList.filter((row) => row.jumlah >= 3 && row.jumlah <= 5).length} rumah`],
        ["Berat (> 6 periode)", `${unpaidList.filter((row) => row.jumlah >= 6).length} rumah`],
      ],
      rightColumns: [1],
    });

    y = sectionTitle(doc, "Prioritas Tunggakan", y);
    drawTable(doc, {
      startY: y,
      head: ["Rumah", "Nama", "Periode", "Estimasi"],
      body: unpaidList.slice(0, 20).map((row) => [
        safeText(row.house),
        safeText(row.name),
        row.unpaid.join(", ") || "-",
        formatMoney(row.total),
      ]),
      rightColumns: [3],
    });

    addFooter(doc, printedAt);

    const safeMonth = (insight?.currentMonth?.month || "laporan").replace(/[\/\\]/g, "-");
    const pdfBuffer = doc.output("arraybuffer");
    const { searchParams } = new URL(req.url);
    const isDownload = searchParams.get("download");
    const disposition = isDownload ? "attachment" : "inline";

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="Laporan_Kas_${safeMonth}.pdf"`,
        "Access-Control-Expose-Headers": "Content-Disposition",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (err) {
    console.error("PDF REPORT ERROR:", err);

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
