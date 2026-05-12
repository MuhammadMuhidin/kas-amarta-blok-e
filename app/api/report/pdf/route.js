import { jsPDF } from "jspdf";
import "jspdf-autotable";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    const { origin } = new URL(req.url);

    const res = await fetch(
      `${origin}/api/sheets/summary`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      throw new Error("Gagal mengambil data");
    }

    const data = await res.json();

    const {
      insight,
      persons = [],
      payments = [],
      periods = [],
      cashflows = [],
    } = data;

    /* =========================
       UTIL
    ========================= */

    const format = (n) =>
      `Rp${Number(n || 0).toLocaleString("id-ID")}`;

    const now = new Date();

    const jakartaTime =
      new Intl.DateTimeFormat("id-ID", {
        dateStyle: "long",
        timeStyle: "medium",
        timeZone: "Asia/Jakarta",
      }).format(now);

    const nominalIuran = 25000;

    const sortedPeriods = [...periods].sort((a, b) =>
      a.localeCompare(b)
    );

    const lastPeriod =
      sortedPeriods[sortedPeriods.length - 1] || "";

    /* =========================
       TOTAL CASHFLOW
    ========================= */

    const totals = cashflows.reduce(
      (acc, c) => {
        const amount = Number(c.amount || 0);

        if (c.type === "income") {
          acc.inc += amount;
        }

        if (c.type === "expense") {
          acc.exp += amount;
        }

        acc.net = acc.inc - acc.exp;

        return acc;
      },
      {
        inc: 0,
        exp: 0,
        net: 0,
      }
    );

    /* =========================
       JUMLAH RUMAH BAYAR
    ========================= */

    const paidHousesSet = new Set(
      payments
        .filter(
          (p) =>
            p.period &&
            p.period.slice(0, 7) === lastPeriod
        )
        .map((p) => p.person_house)
    );

    const paidInLastPeriodCount =
      paidHousesSet.size;

    /* =========================
       TUNGGAKAN
    ========================= */

    const unpaidList = persons
      .map((p) => {
        const joinMonth =
          p.join_date?.slice(0, 7);

        const validPeriods = periods.filter(
          (pr) => !joinMonth || pr >= joinMonth
        );

        const paidSet = new Set(
          payments
            .filter(
              (pay) =>
                pay.person_id === p.id &&
                pay.person_house === p.house
            )
            .map((pay) =>
              pay.period.slice(0, 7)
            )
        );

        const unpaid = validPeriods.filter(
          (pr) => !paidSet.has(pr)
        );

        return {
          house: p.house,
          name: p.name,
          jumlah: unpaid.length,
          unpaid,
          total:
            unpaid.length * nominalIuran,
        };
      })
      .filter((r) => r.jumlah > 0)
      .sort((a, b) =>
        a.house.localeCompare(
          b.house,
          undefined,
          { numeric: true }
        )
      );

    /* =========================
       PDF
    ========================= */

    const doc = new jsPDF();

    const navy = [17, 24, 39];
    const green = [34, 197, 94];
    const red = [220, 38, 38];
    const blue = [37, 99, 235];
    const gray = [107, 114, 128];

    let y = 20;

    /* =========================
       HEADER
    ========================= */

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(...navy);

    doc.text(
      "Laporan Kas Amarta",
      15,
      y
    );

    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...gray);

    doc.text(
      `Dicetak pada ${jakartaTime}`,
      15,
      y
    );

    y += 15;

    /* =========================
       SUMMARY CARD
    ========================= */

    const drawCard = (
      x,
      title,
      value,
      color
    ) => {
      doc.setFillColor(248, 250, 252);

      doc.roundedRect(
        x,
        y,
        55,
        24,
        3,
        3,
        "FD"
      );

      doc.setFontSize(9);
      doc.setTextColor(...gray);

      doc.text(title, x + 5, y + 8);

      doc.setFontSize(12);
      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setTextColor(...color);

      doc.text(
        value,
        x + 5,
        y + 17
      );
    };

    drawCard(
      15,
      "Total Pemasukan",
      format(totals.inc),
      green
    );

    drawCard(
      77,
      "Total Pengeluaran",
      format(totals.exp),
      red
    );

    drawCard(
      139,
      "Sisa Saldo",
      format(totals.net),
      blue
    );

    y += 40;

    /* =========================
       REKAP KEUANGAN
    ========================= */

    doc.setFontSize(14);
    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setTextColor(...navy);

    doc.text(
      "Rekap Keuangan Kas",
      15,
      y
    );

    y += 12;

    const drawRow = (
      label,
      value,
      color = [30, 30, 30],
      highlight = false
    ) => {
      if (highlight) {
        doc.setFillColor(
          239,
          246,
          255
        );

        doc.roundedRect(
          15,
          y - 6,
          180,
          11,
          2,
          2,
          "FD"
        );
      }

      doc.setFontSize(10);

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setTextColor(...gray);

      doc.text(label, 18, y);

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setTextColor(...color);

      doc.text(
        value,
        190,
        y,
        { align: "right" }
      );

      y += 12;
    };

    drawRow(
      `Pengeluaran ${
        insight?.lastMonth?.month || "-"
      }`,
      format(
        insight?.lastMonth
          ?.expenseTotal || 0
      ),
      red
    );

    drawRow(
      `Sisa saldo kumulatif per ${
        insight?.lastMonth?.month || "-"
      }`,
      format(
        insight?.lastMonth
          ?.remaining || 0
      ),
      blue,
      true
    );

    y += 3;

    doc.setDrawColor(220);
    doc.line(15, y, 195, y);

    y += 10;

    drawRow(
      `Kas bulan ${
        insight?.currentMonth?.month || "-"
      } dari ${paidInLastPeriodCount} rumah + sisa bulan lalu`,
      format(
        insight?.summary
          ?.currentIncomePlusLastRemaining ||
          0
      )
    );

    drawRow(
      "Pengeluaran bulan ini",
      format(
        insight?.currentMonth
          ?.expenseTotal || 0
      ),
      red
    );

    drawRow(
      "Total saldo saat ini",
      format(
        insight?.summary
          ?.currentBalance || 0
      ),
      blue,
      true
    );

    y += 10;

    /* =========================
       TUNGGAKAN
    ========================= */

    doc.setFontSize(14);

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setTextColor(...navy);

    doc.text(
      "Laporan Tunggakan Saat Ini",
      15,
      y
    );

    y += 10;

    if (unpaidList.length === 0) {
      doc.setFontSize(10);

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.text(
        "Tidak ada tunggakan.",
        15,
        y
      );
    } else {
      unpaidList.forEach((r, i) => {
        /* PAGE BREAK */
        if (y > 240) {
          doc.addPage();
          y = 20;
        }

        doc.setFillColor(
          249,
          250,
          251
        );

        doc.roundedRect(
          15,
          y,
          180,
          24,
          3,
          3,
          "FD"
        );

        doc.setFontSize(10);

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setTextColor(...navy);

        doc.text(
          `${i + 1}. ${r.house}`,
          20,
          y + 7
        );

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setTextColor(60);

        doc.text(
          `• Nunggak: ${r.jumlah} periode`,
          20,
          y + 14
        );

        doc.text(
          `• Periode: ${r.unpaid.join(
            ", "
          )}`,
          20,
          y + 20
        );

        y += 30;
      });
    }

    /* =========================
       FOOTER
    ========================= */

    const pageCount =
      doc.internal.getNumberOfPages();

    for (
      let i = 1;
      i <= pageCount;
      i++
    ) {
      doc.setPage(i);

      doc.setDrawColor(230);

      doc.line(
        15,
        285,
        195,
        285
      );

      doc.setFontSize(8);

      doc.setTextColor(140);

      doc.text(
        "Dokumen dibuat otomatis oleh sistem kas",
        15,
        290
      );

      doc.text(
        `Halaman ${i} / ${pageCount}`,
        195,
        290,
        {
          align: "right",
        }
      );
    }

    /* =========================
       OUTPUT
    ========================= */

    const safeMonth = (
      insight?.currentMonth?.month ||
      "laporan"
    ).replace(/[\/\\]/g, "-");

    const pdfBuffer =
      doc.output("arraybuffer");

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type":
          "application/pdf",

        "Content-Disposition":
          `attachment; filename="Laporan_Kas_${safeMonth}.pdf"`,
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err.message,
      }),
      {
        status: 500,
      }
    );
  }
}