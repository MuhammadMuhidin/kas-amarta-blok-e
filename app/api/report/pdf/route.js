import { getAppConfig } from "@/lib/appConfig";
import { getReportSummary } from "@/lib/reportSummary";
import { jsPDF } from "jspdf";
import fs from "fs";
import path from "path";
import "jspdf-autotable";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatMoney(value) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
}

function normalize(value) {
  return String(value || "").trim();
}

function getJakartaTime() {
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

function toPercentData(values) {
  const total = values.reduce((sum, value) => sum + Number(value || 0), 0);
  if (total === 0) return values.map(() => 0);
  return values.map((value) => Number(((Number(value || 0) / total) * 100).toFixed(1)));
}

function makeQuickChartURL(config) {
  return `https://quickchart.io/chart?width=250&height=250&format=jpg&backgroundColor=white&c=${encodeURIComponent(
    JSON.stringify(config),
  )}`;
}

async function imageToBase64(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      console.warn(`QuickChart gagal dimuat: ${res.status}`);
      return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 1000) return null;

    return buffer.toString("base64");
  } catch (error) {
    console.warn("QuickChart fetch gagal:", error?.message || error);
    return null;
  }
}

function readLogoBase64() {
  try {
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    if (!fs.existsSync(logoPath)) return null;
    return fs.readFileSync(logoPath, "base64");
  } catch (error) {
    console.warn("Logo PDF gagal dibaca:", error?.message || error);
    return null;
  }
}

function ensureTableBody(rows, columns = 3) {
  if (rows.length) return rows;
  return [Array.from({ length: columns }, (_, index) => (index === 1 ? "Tidak ada data" : "-"))];
}

function buildUnpaidList({ persons, payments, periods, monthlyFee }) {
  const normalizedPeriods = [...new Set(
    periods.map((period) => normalize(period).slice(0, 7)).filter(Boolean),
  )].sort();

  return persons
    .map((person) => {
      const joinMonth = person.join_date?.slice(0, 7);
      const validPeriods = normalizedPeriods.filter((period) => !joinMonth || period >= joinMonth);
      const paidSet = new Set(
        payments
          .filter((payment) => payment.person_id === person.id && payment.person_house === person.house)
          .map((payment) => payment.period?.slice(0, 7)),
      );
      const unpaid = validPeriods.filter((period) => !paidSet.has(period));

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

function drawChartPlaceholder(doc, x, y, size, title) {
  doc.setDrawColor(229, 231, 235);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(x, y, size, size, 4, 4, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text(title, x + size / 2, y + size / 2 - 2, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Chart tidak tersedia", x + size / 2, y + size / 2 + 5, { align: "center" });
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
    const now = new Date();
    const jakartaTime = getJakartaTime();
    const currentMonthKey = now.toISOString().slice(0, 7);

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const logoBase64 = readLogoBase64();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 20;

    const navy = [15, 23, 42];
    const green = [22, 163, 74];
    const red = [220, 38, 38];
    const blue = [37, 99, 235];
    const gray = [107, 114, 128];
    const orange = [245, 158, 11];
    const border = [229, 231, 235];

    const ensureSpace = (needed = 30) => {
      if (y + needed > pageHeight - 25) {
        doc.addPage();
        y = 20;
      }
    };

    const sectionTitle = (title) => {
      ensureSpace(20);
      doc.setDrawColor(...border);
      doc.line(15, y, 195, y);
      y += 10;
      doc.setFontSize(19);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...navy);
      doc.text(title, 15, y);
      y += 12;
    };

    const statRow = (label, value, color = [20, 20, 20]) => {
      ensureSpace(10);
      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...gray);
      doc.text(label, 18, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...color);
      doc.text(value, 190, y, { align: "right" });
      y += 10;
    };

    const totalIncome = cashflows
      .filter((cashflow) => cashflow.type === "income")
      .reduce((sum, cashflow) => sum + Number(cashflow.amount || 0), 0);

    const totalExpense = cashflows
      .filter((cashflow) => cashflow.type === "expense")
      .reduce((sum, cashflow) => sum + Number(cashflow.amount || 0), 0);

    const currentBalance = totalIncome - totalExpense;

    const activeHouses = persons.filter((person) => {
      const joinMonth = person.join_date?.slice(0, 7);
      const validPeriods = periods.filter((period) => !joinMonth || period >= joinMonth);
      return validPeriods.length > 0;
    }).length;

    const paidHouses = new Set(
      payments
        .filter((payment) => payment.period?.slice(0, 7) === currentMonthKey)
        .map((payment) => payment.person_house),
    ).size;

    const paymentRate = activeHouses === 0 ? 0 : Math.round((paidHouses / activeHouses) * 100);
    const unpaidCount = Math.max(activeHouses - paidHouses, 0);
    const unpaidList = buildUnpaidList({ persons, payments, periods, monthlyFee });
    const totalReceivables = unpaidList.reduce((sum, row) => sum + row.total, 0);

    const pieIncomeExpenseConfig = {
      type: "pie",
      data: {
        labels: ["Total Pemasukan (%)", "Total Pengeluaran (%)"],
        datasets: [
          {
            data: toPercentData([totalIncome, totalExpense]),
            backgroundColor: ["#16A34A", "#DC2626"],
            borderWidth: 1,
          },
        ],
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: "bottom",
            labels: { font: { size: 25, weight: "bold" } },
          },
          datalabels: {
            font: { size: 20, weight: "bold" },
            color: "#fff",
          },
        },
      },
    };

    const doughnutPaymentConfig = {
      type: "doughnut",
      data: {
        labels: ["Sudah Bayar (%)", "Belum Bayar (%)"],
        datasets: [
          {
            data: toPercentData([paidHouses, unpaidCount]),
            backgroundColor: ["#16A34A", "#F59E0B"],
            borderWidth: 1,
          },
        ],
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: true,
        cutout: "60%",
        plugins: {
          legend: {
            position: "bottom",
            labels: { font: { size: 25, weight: "bold" } },
          },
          datalabels: {
            font: { size: 20, weight: "bold" },
            color: "#fff",
          },
        },
      },
    };

    const [pieIncomeExpenseImg, doughnutPaymentImg] = await Promise.all([
      imageToBase64(makeQuickChartURL(pieIncomeExpenseConfig)),
      imageToBase64(makeQuickChartURL(doughnutPaymentConfig)),
    ]);

    doc.setFillColor(...navy);
    doc.rect(0, 0, pageWidth, 42, "F");

    if (logoBase64) {
      const logoW = 30;
      const logoH = 30;
      const logoX = pageWidth - logoW - 15;
      const logoY = (42 - logoH) / 2;
      doc.addImage(logoBase64, "PNG", logoX, logoY, logoW, logoH);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text("KAS AMARTA RESIDENCE - BLOK E", 15, 18);
    doc.setFontSize(15);
    doc.setFont("helvetica", "normal");
    doc.text("Laporan Rekap Keuangan", 15, 28);
    doc.setFontSize(12);
    doc.text(`Dicetak ${jakartaTime}`, 15, 35);

    y = 55;

    const drawCard = (x, title, value, color) => {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...border);
      doc.roundedRect(x, y, 55, 30, 4, 4, "FD");
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...gray);
      doc.text(title, x + 5, y + 8);
      doc.setFontSize(17);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...color);
      doc.text(value, x + 5, y + 20);
    };

    drawCard(15, "Total Pemasukan", formatMoney(totalIncome), green);
    drawCard(77, "Total Pengeluaran", formatMoney(totalExpense), red);
    drawCard(139, "Saldo Saat Ini", formatMoney(currentBalance), blue);

    y += 45;

    sectionTitle("Statistik Pembayaran");
    statRow("Jumlah rumah aktif", `${activeHouses} rumah`);
    statRow("Rumah sudah bayar", `${paidHouses} rumah`, green);
    statRow("Persentase pembayaran", `${paymentRate}%`, blue);
    y += 5;

    sectionTitle("Rekap Keuangan");
    statRow(
      `Pengeluaran bulan ${insight?.lastMonth?.month || "-"}`,
      formatMoney(insight?.lastMonth?.expenseTotal || 0),
      red,
    );
    statRow(
      `Saldo kumulatif per ${insight?.lastMonth?.month || "-"}`,
      formatMoney(insight?.lastMonth?.remaining || 0),
      blue,
    );
    statRow(
      `Kas bulan ${insight?.currentMonth?.month || "-"} + sisa bulan lalu`,
      formatMoney(insight?.summary?.currentIncomePlusLastRemaining || 0),
    );
    statRow("Pengeluaran bulan ini", formatMoney(insight?.currentMonth?.expenseTotal || 0), red);

    ensureSpace(35);
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(15, y, 180, 24, 4, 4, "FD");
    doc.setFontSize(14);
    doc.setTextColor(70);
    doc.setFont("helvetica", "normal");
    doc.text("TOTAL SALDO SAAT INI", 20, y + 9);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...blue);
    doc.text(formatMoney(currentBalance), 190, y + 16, { align: "right" });
    y += 35;

    sectionTitle("Kondisi Keuangan");
    const health = currentBalance > 0 ? "Kas dalam kondisi sehat dan surplus." : "Kas mengalami defisit.";
    doc.setFillColor(
      currentBalance > 0 ? 240 : 255,
      currentBalance > 0 ? 253 : 240,
      currentBalance > 0 ? 244 : 240,
    );
    doc.roundedRect(15, y - 5, 180, 18, 4, 4, "FD");
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...(currentBalance > 0 ? green : red));
    doc.text(health, 20, y + 5);
    y += 28;

    sectionTitle("Visual Ringkasan Keuangan");
    ensureSpace(90);
    const chartSize = 45;
    const gap = 20;
    const startX = (210 - (chartSize * 2 + gap)) / 2;

    if (pieIncomeExpenseImg) {
      doc.addImage(pieIncomeExpenseImg, "JPG", startX, y, chartSize, chartSize, undefined, "FAST");
    } else {
      drawChartPlaceholder(doc, startX, y, chartSize, "Pemasukan vs Pengeluaran");
    }

    if (doughnutPaymentImg) {
      doc.addImage(doughnutPaymentImg, "JPG", startX + chartSize + gap, y, chartSize, chartSize, undefined, "FAST");
    } else {
      drawChartPlaceholder(doc, startX + chartSize + gap, y, chartSize, "Status Pembayaran");
    }

    y += chartSize + 10;

    const topExpenses = cashflows
      .filter((cashflow) => cashflow.type === "expense")
      .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
      .slice(0, 3);

    if (topExpenses.length > 0) {
      sectionTitle("Top 3 Pengeluaran Terbesar");
      topExpenses.forEach((expense, index) => {
        ensureSpace(30);
        doc.setFillColor(250, 250, 250);
        doc.roundedRect(15, y, 180, 22, 4, 4, "FD");
        doc.setFontSize(14);
        doc.setTextColor(...navy);
        doc.setFont("helvetica", "bold");
        doc.text(`${index + 1}. ${expense.note || "-"}`, 20, y + 8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...gray);
        doc.text(expense.date || "-", 20, y + 16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...red);
        doc.text(formatMoney(expense.amount), 188, y + 12, { align: "right" });
        y += 28;
      });
    }

    doc.addPage();
    y = 20;

    sectionTitle(`Detail Pengeluaran Bulan (${insight?.lastMonth?.month || "-"} & ${insight?.currentMonth?.month || "-"})`);

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...navy);
    doc.text(`Pengeluaran Bulan Lalu (${insight?.lastMonth?.month || "-"})`, 15, y);
    y += 8;

    doc.autoTable({
      startY: y,
      theme: "grid",
      head: [["Tanggal", "Keterangan", "Nominal"]],
      body: ensureTableBody(
        (insight?.lastMonth?.expenses || []).map((expense) => [
          expense.date,
          expense.note,
          formatMoney(expense.amount),
        ]),
      ),
      headStyles: { fillColor: navy },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 2: { halign: "right" } },
    });

    y = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...navy);
    doc.text(`Pengeluaran Bulan Berjalan (${insight?.currentMonth?.month || "-"})`, 15, y);
    y += 8;

    doc.autoTable({
      startY: y,
      theme: "grid",
      head: [["Tanggal", "Keterangan", "Nominal"]],
      body: ensureTableBody(
        (insight?.currentMonth?.expenses || []).map((expense) => [
          expense.date,
          expense.note,
          formatMoney(expense.amount),
        ]),
      ),
      headStyles: { fillColor: navy },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 2: { halign: "right" } },
    });

    y = doc.lastAutoTable.finalY + 15;
    ensureSpace(25);

    const lastExpense = insight?.lastMonth?.expenseTotal || 0;
    const currentExpense = insight?.currentMonth?.expenseTotal || 0;
    const expenseDifference = currentExpense - lastExpense;
    const expenseDiffPercent = lastExpense === 0 ? 0 : Math.round((expenseDifference / lastExpense) * 100);
    let expenseInsight = "Pengeluaran bulan ini sama dengan bulan lalu.";

    if (expenseDiffPercent > 0) {
      expenseInsight = `Pengeluaran bulan ini naik ${expenseDiffPercent}% (${formatMoney(expenseDifference)}) dibanding bulan lalu.`;
    } else if (expenseDiffPercent < 0) {
      expenseInsight = `Pengeluaran bulan ini turun ${Math.abs(expenseDiffPercent)}% (${formatMoney(Math.abs(expenseDifference))}) dibanding bulan lalu.`;
    }

    doc.setFillColor(255, 248, 235);
    doc.roundedRect(15, y, 180, 18, 4, 4, "FD");
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(180, 83, 9);
    doc.text(expenseInsight, 20, y + 11);

    doc.addPage();
    y = 20;

    sectionTitle("Laporan Tunggakan");
    ensureSpace(35);

    doc.setFillColor(255, 245, 245);
    doc.roundedRect(15, y, 180, 24, 4, 4, "FD");
    doc.setFontSize(14);
    doc.setTextColor(80);
    doc.setFont("helvetica", "normal");
    doc.text("Total rumah menunggak", 20, y + 9);
    doc.text("Total piutang (estimasi)", 20, y + 18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...red);
    doc.text(`${unpaidList.length} rumah`, 190, y + 9, { align: "right" });
    doc.text(formatMoney(totalReceivables), 190, y + 18, { align: "right" });
    y += 35;

    sectionTitle("Kategori Tunggakan");
    statRow("Ringan (1-2 periode)", `${unpaidList.filter((row) => row.jumlah >= 1 && row.jumlah <= 2).length} rumah`, blue);
    statRow("Sedang (3-5 periode)", `${unpaidList.filter((row) => row.jumlah >= 3 && row.jumlah <= 5).length} rumah`, orange);
    statRow("Berat (> 6 periode)", `${unpaidList.filter((row) => row.jumlah >= 6).length} rumah`, red);
    y += 5;

    sectionTitle("Prioritas Tunggakan");
    unpaidList.slice(0, 5).forEach((row, index) => {
      ensureSpace(30);
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(15, y, 180, 24, 4, 4, "FD");
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...navy);
      doc.text(`${index + 1}. ${row.house}`, 20, y + 8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...gray);
      doc.text(`Nunggak ${row.jumlah} periode`, 20, y + 15);
      doc.text(row.unpaid.join(", "), 20, y + 21);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...red);
      doc.text(formatMoney(row.total), 188, y + 13, { align: "right" });
      y += 30;
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setDrawColor(...border);
      doc.line(15, 287, 195, 287);
      doc.setFontSize(8);
      doc.setTextColor(140);
      doc.text(`Kas Amarta Blok E • Sistem Keuangan Internal • Dicetak ${jakartaTime}`, 15, 292);
      doc.text(`Halaman ${page} / ${pageCount}`, 195, 292, { align: "right" });
    }

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
