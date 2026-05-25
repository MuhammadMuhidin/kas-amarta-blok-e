import { getAppConfig } from "@/lib/appConfig";
import { jsPDF } from "jspdf";
import fs from "fs";
import path from "path";
import "jspdf-autotable";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    const { origin } = new URL(req.url);

    const res = await fetch(`${origin}/api/sheets/summary`, {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error("Gagal mengambil data");
    }

    const data = await res.json();

    const appConfig = await getAppConfig();

    const {
      insight,
      persons = [],
      payments = [],
      periods = [],
      cashflows = [],
    } = data;

    /* =========================================
       PDF INIT
    ========================================= */

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const logoPath = path.join(process.cwd(), "public", "logo.png");

    const logoBase64 = fs.readFileSync(logoPath, "base64");

    const pageWidth = doc.internal.pageSize.getWidth();

    const pageHeight = doc.internal.pageSize.getHeight();

    let y = 20;

    /* =========================================
       HELPER QUICKCHART
    ========================================= */

    const makeQuickChartURL = (config) => {
      return `https://quickchart.io/chart?width=250&height=250&format=png&c=${encodeURIComponent(
        JSON.stringify(config),
      )}`;
    };

    const toBase64 = async (url) => {
      const res = await fetch(url);
      const buffer = await res.arrayBuffer();
      return Buffer.from(buffer).toString("base64");
    };

    /* =========================================
       SAFE PAGE SYSTEM
    ========================================= */

    const ensureSpace = (needed = 30) => {
      if (y + needed > pageHeight - 25) {
        doc.addPage();
        y = 20;
      }
    };

    /* =========================================
       FORMAT
    ========================================= */

    const format = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;

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

    const jakartaTime = `${tanggal} pukul ${jam} WIB`;

    const currentMonthKey = now.toISOString().slice(0, 7);

    const toPercentData = (arr) => {
      const total = arr.reduce((a, b) => a + b, 0);

      if (total === 0) return arr.map(() => 0);

      return arr.map((v) => Number(((v / total) * 100).toFixed(1)));
    };

    const nominalIuran = appConfig.monthly_fee;

    /* =========================================
       COLORS
    ========================================= */

    const navy = [15, 23, 42];

    const green = [22, 163, 74];

    const red = [220, 38, 38];

    const blue = [37, 99, 235];

    const gray = [107, 114, 128];

    const border = [229, 231, 235];

    /* =========================================
       TOTALS
    ========================================= */

    const totalIncome = cashflows
      .filter((c) => c.type === "income")
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const totalExpense = cashflows
      .filter((c) => c.type === "expense")
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const currentBalance = totalIncome - totalExpense;

    /* =========================================
       PIE CHART
    ========================================= */

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
        aspectRatio: 1,
        animation: false,
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              font: {
                size: 25,
                weight: "bold",
              },
            },
          },
          datalabels: {
            font: {
              size: 20,
              weight: "bold",
            },
            color: "#fff",
          },
        },
      },
    };

    const pieIncomeExpenseURL = makeQuickChartURL(pieIncomeExpenseConfig);
    const pieIncomeExpenseImg = await toBase64(pieIncomeExpenseURL);

    /* =========================================
       PAYMENT STATS
    ========================================= */

    const activeHouses = persons.filter((p) => {
      const joinMonth = p.join_date?.slice(0, 7);

      const validPeriods = periods.filter(
        (pr) => !joinMonth || pr >= joinMonth,
      );

      return validPeriods.length > 0;
    }).length;

    const paidHousesSet = new Set(
      payments
        .filter((p) => p.period?.slice(0, 7) === currentMonthKey)
        .map((p) => p.person_house),
    );

    const paidHouses = paidHousesSet.size;

    const paymentRate =
      activeHouses === 0 ? 0 : Math.round((paidHouses / activeHouses) * 100);

    /* =========================================
       DOUGHNUT CHART
    ========================================= */

    const unpaidCount = activeHouses - paidHouses;
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
        aspectRatio: 1,
        cutout: "60%",
        animation: false,
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            labels: {
              font: {
                size: 25,
                weight: "bold",
              },
            },
            position: "bottom",
          },
          datalabels: {
            font: {
              size: 20,
              weight: "bold",
            },
            color: "#fff",
          },
        },
      },
    };
    const doughnutPaymentURL = makeQuickChartURL(doughnutPaymentConfig);
    const doughnutPaymentImg = await toBase64(doughnutPaymentURL);

    /* =========================================
       UNPAID
    ========================================= */

    const unpaidList = persons
      .map((p) => {
        const joinMonth = p.join_date?.slice(0, 7);

        const validPeriods = periods.filter(
          (pr) => !joinMonth || pr >= joinMonth,
        );

        const paidSet = new Set(
          payments
            .filter(
              (pay) => pay.person_id === p.id && pay.person_house === p.house,
            )
            .map((pay) => pay.period.slice(0, 7)),
        );

        const unpaid = validPeriods.filter((pr) => !paidSet.has(pr));

        return {
          house: p.house,
          name: p.name,
          jumlah: unpaid.length,
          unpaid,
          total: unpaid.length * nominalIuran,
        };
      })
      .filter((r) => r.jumlah > 0)
      .sort((a, b) => b.total - a.total);

    const totalReceivables = unpaidList.reduce((sum, x) => sum + x.total, 0);

    const lastExpense = insight?.lastMonth?.expenseTotal || 0;

    const currentExpense = insight?.currentMonth?.expenseTotal || 0;

    const expenseDifference = currentExpense - lastExpense;

    const expenseDiffPercent =
      lastExpense === 0
        ? 0
        : Math.round((expenseDifference / lastExpense) * 100);

    let expenseInsight = "";

    if (expenseDiffPercent > 0) {
      expenseInsight = `Pengeluaran bulan ini naik ${expenseDiffPercent}% (${format(
        expenseDifference,
      )}) dibanding bulan lalu.`;
    } else if (expenseDiffPercent < 0) {
      expenseInsight = `Pengeluaran bulan ini turun ${Math.abs(
        expenseDiffPercent,
      )}% (${format(Math.abs(expenseDifference))}) dibanding bulan lalu.`;
    } else {
      expenseInsight = "Pengeluaran bulan ini sama dengan bulan lalu.";
    }

    /* =========================================
       HEADER
    ========================================= */

    doc.setFillColor(...navy);

    doc.rect(0, 0, pageWidth, 42, "F");

    const headerPadding = 15;
    const logoW = 30;
    const logoH = 30;
    const logoX = pageWidth - logoW - headerPadding;
    const logoY = (42 - logoH) / 2;
    doc.addImage(logoBase64, "PNG", logoX, logoY, logoW, logoH);

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

    /* =========================================
       SUMMARY CARDS
    ========================================= */

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

    drawCard(15, "Total Pemasukan", format(totalIncome), green);

    drawCard(77, "Total Pengeluaran", format(totalExpense), red);

    drawCard(139, "Saldo Saat Ini", format(currentBalance), blue);

    y += 45;

    /* =========================================
       HELPERS
    ========================================= */

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

      doc.text(value, 190, y, {
        align: "right",
      });

      y += 10;
    };

    /* =========================================
       STATISTIK PEMBAYARAN
    ========================================= */

    sectionTitle("Statistik Pembayaran");

    statRow("Jumlah rumah aktif", `${activeHouses} rumah`);

    statRow("Rumah sudah bayar", `${paidHouses} rumah`, green);

    statRow("Persentase pembayaran", `${paymentRate}%`, blue);

    y += 5;

    /* =========================================
       REKAP
    ========================================= */

    sectionTitle("Rekap Keuangan");

    statRow(
      `Pengeluaran bulan ${insight?.lastMonth?.month || "-"}`,
      format(insight?.lastMonth?.expenseTotal || 0),
      red,
    );

    statRow(
      `Saldo kumulatif per ${insight?.lastMonth?.month || "-"}`,
      format(insight?.lastMonth?.remaining || 0),
      blue,
    );

    statRow(
      `Kas bulan ${insight?.currentMonth?.month || "-"} + sisa bulan lalu`,
      format(insight?.summary?.currentIncomePlusLastRemaining || 0),
    );

    statRow(
      "Pengeluaran bulan ini",
      format(insight?.currentMonth?.expenseTotal || 0),
      red,
    );

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

    doc.text(format(currentBalance), 190, y + 16, {
      align: "right",
    });

    y += 35;

    /* =========================================
       KONDISI KEUANGAN
    ========================================= */

    sectionTitle("Kondisi Keuangan");

    const health =
      currentBalance > 0
        ? "Kas dalam kondisi sehat dan surplus."
        : "Kas mengalami defisit.";

    ensureSpace(25);

    doc.setFillColor(
      currentBalance > 0 ? 240 : 255,
      currentBalance > 0 ? 253 : 240,
      currentBalance > 0 ? 244 : 240,
    );

    doc.roundedRect(15, y - 5, 180, 18, 4, 4, "FD");

    doc.setFontSize(14);

    doc.setFont("helvetica", "bold");

    doc.setTextColor(
      currentBalance > 0 ? 22 : 180,
      currentBalance > 0 ? 163 : 50,
      currentBalance > 0 ? 74 : 50,
    );

    doc.text(health, 20, y + 5);

    y += 28;

    sectionTitle("Visual Ringkasan Keuangan");

    // PIE + DOUGHNUT
    ensureSpace(90);

    const chartSize = 45;

    // container width A4 = 210mm
    const totalWidth = 210;

    // spacing 2 chart
    const gap = 20;

    // total content width
    const contentWidth = chartSize * 2 + gap;

    // start X biar center
    const startX = (totalWidth - contentWidth) / 2;

    doc.addImage(
      pieIncomeExpenseImg,
      "JPG",
      startX,
      y,
      chartSize,
      chartSize,
      undefined,
      "FAST",
    );

    doc.addImage(
      doughnutPaymentImg,
      "JPG",
      startX + chartSize + gap,
      y,
      chartSize,
      chartSize,
      undefined,
      "FAST",
    );

    y += chartSize + 10;

    /* =========================================
       TOP 3 PENGELUARAN TERBESAR
    ========================================= */

    const topExpenses = cashflows
      .filter((c) => c.type === "expense")
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

        doc.text(format(expense.amount), 188, y + 12, {
          align: "right",
        });

        y += 28;
      });
    }

    /* =========================================
       PAGE 2
    ========================================= */

    doc.addPage();

    y = 20;

    sectionTitle(
      `Detail Pengeluaran Bulan (${insight?.lastMonth?.month || "-"} & ${insight?.currentMonth?.month || "-"})`,
    );

    doc.setFontSize(16);

    doc.setFont("helvetica", "bold");

    doc.setTextColor(...navy);

    doc.text(
      `Pengeluaran Bulan Lalu (${insight?.lastMonth?.month || "-"})`,
      15,
      y,
    );

    y += 8;

    doc.autoTable({
      startY: y,

      theme: "grid",

      head: [["Tanggal", "Keterangan", "Nominal"]],

      body:
        insight?.lastMonth?.expenses?.map((e) => [
          e.date,
          e.note,
          format(e.amount),
        ]) || [],

      headStyles: {
        fillColor: navy,
      },

      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },

      columnStyles: {
        2: {
          halign: "right",
        },
      },
    });

    y = doc.lastAutoTable.finalY + 15;

    doc.setFontSize(16);

    doc.setFont("helvetica", "bold");

    doc.setTextColor(...navy);

    doc.text(
      `Pengeluaran Bulan Berjalan (${insight?.currentMonth?.month || "-"})`,
      15,
      y,
    );

    y += 8;

    doc.autoTable({
      startY: y,

      theme: "grid",

      head: [["Tanggal", "Keterangan", "Nominal"]],

      body:
        insight?.currentMonth?.expenses?.map((e) => [
          e.date,
          e.note,
          format(e.amount),
        ]) || [],

      headStyles: {
        fillColor: navy,
      },

      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },

      columnStyles: {
        2: {
          halign: "right",
        },
      },
    });

    y = doc.lastAutoTable.finalY + 15;
    ensureSpace(25);

    doc.setFillColor(255, 248, 235);

    doc.roundedRect(15, y, 180, 18, 4, 4, "FD");

    doc.setFontSize(12);

    doc.setFont("helvetica", "bold");

    doc.setTextColor(180, 83, 9);

    doc.text(expenseInsight, 20, y + 11);

    y += 28;

    /* =========================================
       PAGE 3
    ========================================= */

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

    doc.text(`${unpaidList.length} rumah`, 190, y + 9, {
      align: "right",
    });

    doc.text(format(totalReceivables), 190, y + 18, {
      align: "right",
    });

    y += 35;

    /* =========================================
       AGING
    ========================================= */

    sectionTitle("Kategori Tunggakan");

    statRow(
      "Ringan (1-2 periode)",
      `${unpaidList.filter((x) => x.jumlah >= 1 && x.jumlah <= 2).length} rumah`,
      blue,
    );

    statRow(
      "Sedang (3-5 periode)",
      `${unpaidList.filter((x) => x.jumlah >= 3 && x.jumlah <= 5).length} rumah`,
      red,
    );

    statRow(
      "Berat (> 6 periode)",
      `${unpaidList.filter((x) => x.jumlah >= 6).length} rumah`,
      red,
    );

    y += 5;

    /* =========================================
       PRIORITAS TUNGGAKAN
    ========================================= */

    sectionTitle("Prioritas Tunggakan");

    unpaidList.slice(0, 5).forEach((r, i) => {
      ensureSpace(30);

      doc.setFillColor(250, 250, 250);

      doc.roundedRect(15, y, 180, 24, 4, 4, "FD");

      doc.setFontSize(14);

      doc.setFont("helvetica", "bold");

      doc.setTextColor(...navy);

      doc.text(`${i + 1}. ${r.house}`, 20, y + 8);

      doc.setFont("helvetica", "normal");

      doc.setTextColor(...gray);

      doc.text(`Nunggak ${r.jumlah} periode`, 20, y + 15);

      doc.text(r.unpaid.join(", "), 20, y + 21);

      doc.setFont("helvetica", "bold");

      doc.setTextColor(...red);

      doc.text(format(r.total), 188, y + 13, {
        align: "right",
      });

      y += 30;
    });

    /* =========================================
       FOOTER
    ========================================= */

    const pageCount = doc.internal.getNumberOfPages();

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);

      doc.setDrawColor(...border);

      doc.line(15, 287, 195, 287);

      doc.setFontSize(8);

      doc.setTextColor(140);

      doc.text(
        `Kas Amarta Blok E • Sistem Keuangan Internal • Dicetak ${jakartaTime}`,
        15,
        292,
      );

      doc.text(`Halaman ${i} / ${pageCount}`, 195, 292, {
        align: "right",
      });
    }

    /* =========================================
       OUTPUT
    ========================================= */

    const safeMonth = (insight?.currentMonth?.month || "laporan").replace(
      /[\/\\]/g,
      "-",
    );

    const pdfBuffer = doc.output("arraybuffer");

    const { searchParams } = new URL(req.url);

    const isDownload = searchParams.get("download");
    const disposition = isDownload ? "attachment" : "inline";

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",

        "Content-Disposition": `${disposition}; filename="Laporan_Kas_${safeMonth}.pdf"`,

        "Access-Control-Expose-Headers": "Content-Disposition",

        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (err) {
    console.error(err);

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
