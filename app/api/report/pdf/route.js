import { jsPDF } from "jspdf";
import "jspdf-autotable";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    const { origin } = new URL(req.url);

    const res = await fetch(
      `${origin}/api/sheets/summary`,
      {
        cache: "no-store",
      }
    );

    if (!res.ok) {
      throw new Error(
        "Gagal mengambil data"
      );
    }

    const data = await res.json();

    const {
      insight,
      persons = [],
      payments = [],
      periods = [],
      cashflows = [],
    } = data;

    /* =========================================
       UTIL
    ========================================= */

    const doc = new jsPDF();

    const format = (n) =>
      `Rp${Number(
        n || 0
      ).toLocaleString("id-ID")}`;

    const now = new Date();

    const jakartaTime =
      new Intl.DateTimeFormat(
        "id-ID",
        {
          dateStyle: "long",
          timeStyle: "medium",
          timeZone:
            "Asia/Jakarta",
        }
      ).format(now);

    const currentMonthKey =
      now
        .toISOString()
        .slice(0, 7);

    const nominalIuran = 25000;

    /* =========================================
       COLORS
    ========================================= */

    const navy = [
      15, 23, 42,
    ];

    const green = [
      34, 197, 94,
    ];

    const red = [
      239, 68, 68,
    ];

    const blue = [
      59, 130, 246,
    ];

    const gray = [
      107, 114, 128,
    ];

    const border = [
      229, 231, 235,
    ];

    /* =========================================
       TOTALS
    ========================================= */

    const totalIncome =
      cashflows
        .filter(
          (c) =>
            c.type ===
            "income"
        )
        .reduce(
          (sum, c) =>
            sum +
            Number(
              c.amount || 0
            ),
          0
        );

    const totalExpense =
      cashflows
        .filter(
          (c) =>
            c.type ===
            "expense"
        )
        .reduce(
          (sum, c) =>
            sum +
            Number(
              c.amount || 0
            ),
          0
        );

    const currentBalance =
      totalIncome -
      totalExpense;

    /* =========================================
       ACTIVE HOUSES
    ========================================= */

    const activeHouses =
      persons.length;

    /* =========================================
       PAID HOUSE COUNT
    ========================================= */

    const paidHousesSet =
      new Set(
        payments
          .filter(
            (p) =>
              p.period?.slice(
                0,
                7
              ) ===
              currentMonthKey
          )
          .map(
            (p) =>
              p.person_house
          )
      );

    const paidHouses =
      paidHousesSet.size;

    const paymentRate =
      activeHouses === 0
        ? 0
        : Math.round(
            (paidHouses /
              activeHouses) *
              100
          );

    /* =========================================
       UNPAID LIST
    ========================================= */

    const unpaidList = persons
      .map((p) => {
        const joinMonth =
          p.join_date?.slice(
            0,
            7
          );

        const validPeriods =
          periods.filter(
            (pr) =>
              !joinMonth ||
              pr >= joinMonth
          );

        const paidSet =
          new Set(
            payments
              .filter(
                (pay) =>
                  pay.person_id ===
                    p.id &&
                  pay.person_house ===
                    p.house
              )
              .map((pay) =>
                pay.period.slice(
                  0,
                  7
                )
              )
          );

        const unpaid =
          validPeriods.filter(
            (pr) =>
              !paidSet.has(pr)
          );

        return {
          house: p.house,
          name: p.name,
          jumlah:
            unpaid.length,
          unpaid,
          total:
            unpaid.length *
            nominalIuran,
        };
      })
      .filter(
        (r) => r.jumlah > 0
      )
      .sort((a, b) =>
        b.total - a.total
      );

    const totalReceivables =
      unpaidList.reduce(
        (sum, x) =>
          sum + x.total,
        0
      );

    /* =========================================
       BIGGEST EXPENSE
    ========================================= */

    const biggestExpense =
      cashflows
        .filter(
          (c) =>
            c.type ===
            "expense"
        )
        .sort(
          (a, b) =>
            Number(
              b.amount
            ) -
            Number(a.amount)
        )[0];

    /* =========================================
       HEADER
    ========================================= */

    doc.setFillColor(
      ...navy
    );

    doc.rect(
      0,
      0,
      210,
      42,
      "F"
    );

    doc.setTextColor(
      255,
      255,
      255
    );

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(22);

    doc.text(
      "KAS AMARTA",
      15,
      18
    );

    doc.setFontSize(11);

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.text(
      "Laporan Rekap Keuangan",
      15,
      27
    );

    doc.setFontSize(8);

    doc.text(
      `Dicetak ${jakartaTime}`,
      15,
      34
    );

    let y = 55;

    /* =========================================
       SUMMARY CARDS
    ========================================= */

    const drawCard = (
      x,
      title,
      value,
      color
    ) => {
      /* shadow */
      doc.setFillColor(
        235,
        235,
        235
      );

      doc.roundedRect(
        x + 1,
        y + 1,
        55,
        30,
        4,
        4,
        "F"
      );

      /* card */
      doc.setFillColor(
        255,
        255,
        255
      );

      doc.setDrawColor(
        ...border
      );

      doc.roundedRect(
        x,
        y,
        55,
        30,
        4,
        4,
        "FD"
      );

      doc.setFontSize(8);

      doc.setTextColor(
        ...gray
      );

      doc.text(
        title,
        x + 5,
        y + 9
      );

      doc.setFontSize(13);

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setTextColor(
        ...color
      );

      doc.text(
        value,
        x + 5,
        y + 21
      );
    };

    drawCard(
      15,
      "Total Pemasukan",
      format(totalIncome),
      green
    );

    drawCard(
      77,
      "Total Pengeluaran",
      format(totalExpense),
      red
    );

    drawCard(
      139,
      "Saldo Saat Ini",
      format(
        currentBalance
      ),
      blue
    );

    y += 45;

    /* =========================================
       PAYMENT STATISTIC
    ========================================= */

    doc.setDrawColor(
      ...border
    );

    doc.line(
      15,
      y,
      195,
      y
    );

    y += 12;

    doc.setTextColor(
      ...navy
    );

    doc.setFontSize(14);

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.text(
      "Statistik Pembayaran",
      15,
      y
    );

    y += 12;

    const drawStatRow = (
      label,
      value,
      color = [
        30, 30, 30,
      ]
    ) => {
      doc.setFontSize(10);

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setTextColor(
        ...gray
      );

      doc.text(
        label,
        18,
        y
      );

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setTextColor(
        ...color
      );

      doc.text(
        value,
        190,
        y,
        {
          align: "right",
        }
      );

      y += 11;
    };

    drawStatRow(
      "Jumlah rumah aktif",
      `${activeHouses} rumah`
    );

    drawStatRow(
      "Rumah sudah bayar",
      `${paidHouses} rumah`,
      green
    );

    drawStatRow(
      "Persentase pembayaran",
      `${paymentRate}%`,
      blue
    );

    y += 6;

    /* =========================================
       CASHFLOW SUMMARY
    ========================================= */

    doc.setDrawColor(
      ...border
    );

    doc.line(
      15,
      y,
      195,
      y
    );

    y += 12;

    doc.setFontSize(14);

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setTextColor(
      ...navy
    );

    doc.text(
      "Rekap Keuangan",
      15,
      y
    );

    y += 12;

    drawStatRow(
      `Pengeluaran ${insight?.lastMonth?.month || "-"}`,
      format(
        insight?.lastMonth
          ?.expenseTotal ||
          0
      ),
      red
    );

    drawStatRow(
      `Saldo kumulatif per ${insight?.lastMonth?.month || "-"}`,
      format(
        insight?.lastMonth
          ?.remaining || 0
      ),
      blue
    );

    drawStatRow(
      `Kas ${insight?.currentMonth?.month || "-"} + sisa bulan lalu`,
      format(
        insight?.summary
          ?.currentIncomePlusLastRemaining ||
          0
      )
    );

    drawStatRow(
      "Pengeluaran bulan ini",
      format(
        insight?.currentMonth
          ?.expenseTotal ||
          0
      ),
      red
    );

    y += 6;

    /* =========================================
       FINAL BALANCE BOX
    ========================================= */

    doc.setFillColor(
      239,
      246,
      255
    );

    doc.roundedRect(
      15,
      y,
      180,
      25,
      4,
      4,
      "FD"
    );

    doc.setFontSize(10);

    doc.setTextColor(
      80
    );

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.text(
      "TOTAL SALDO SAAT INI",
      20,
      y + 9
    );

    doc.setFontSize(18);

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setTextColor(
      ...blue
    );

    doc.text(
      format(
        currentBalance
      ),
      190,
      y + 17,
      {
        align: "right",
      }
    );

    y += 40;

    /* =========================================
       FINANCIAL HEALTH
    ========================================= */

    doc.setDrawColor(
      ...border
    );

    doc.line(
      15,
      y,
      195,
      y
    );

    y += 12;

    doc.setFontSize(14);

    doc.setTextColor(
      ...navy
    );

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.text(
      "Kondisi Keuangan",
      15,
      y
    );

    y += 14;

    const health =
      currentBalance > 0
        ? "Kas dalam kondisi sehat dan surplus."
        : "Kas mengalami defisit.";

    doc.setFillColor(
      currentBalance > 0
        ? 240
        : 255,
      currentBalance > 0
        ? 253
        : 240,
      currentBalance > 0
        ? 244
        : 240
    );

    doc.roundedRect(
      15,
      y - 8,
      180,
      18,
      3,
      3,
      "FD"
    );

    doc.setFontSize(10);

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setTextColor(
      currentBalance > 0
        ? 22
        : 180,
      currentBalance > 0
        ? 163
        : 50,
      currentBalance > 0
        ? 74
        : 50
    );

    doc.text(
      health,
      20,
      y + 2
    );

    y += 24;

    /* =========================================
       BIGGEST EXPENSE
    ========================================= */

    if (biggestExpense) {
      doc.setFontSize(11);

      doc.setTextColor(
        ...navy
      );

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.text(
        "Pengeluaran Terbesar",
        15,
        y
      );

      y += 8;

      doc.setFillColor(
        250,
        250,
        250
      );

      doc.roundedRect(
        15,
        y,
        180,
        20,
        3,
        3,
        "FD"
      );

      doc.setFontSize(10);

      doc.setTextColor(
        70
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.text(
        biggestExpense.note ||
          "-",
        20,
        y + 8
      );

      doc.text(
        biggestExpense.date ||
          "-",
        20,
        y + 15
      );

      doc.setTextColor(
        ...red
      );

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.text(
        format(
          biggestExpense.amount
        ),
        188,
        y + 12,
        {
          align:
            "right",
        }
      );

      y += 30;
    }

    /* =========================================
       PAGE BREAK
    ========================================= */

    doc.addPage();

    y = 20;

    /* =========================================
       DETAIL EXPENSES
    ========================================= */

    doc.setFontSize(18);

    doc.setTextColor(
      ...navy
    );

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.text(
      "Detail Pengeluaran",
      15,
      y
    );

    y += 12;

    /* LAST MONTH */

    doc.setFontSize(12);

    doc.text(
      `Pengeluaran ${insight?.lastMonth?.month || "-"}`,
      15,
      y
    );

    y += 6;

    doc.autoTable({
      startY: y,

      theme: "plain",

      head: [
        [
          "Tanggal",
          "Keterangan",
          "Nominal",
        ],
      ],

      body:
        insight?.lastMonth?.expenses?.map(
          (e) => [
            e.date,
            e.note,
            format(
              e.amount
            ),
          ]
        ) || [],

      styles: {
        fontSize: 9,
        cellPadding: 4,
        lineColor:
          border,
        lineWidth: 0.2,
      },

      headStyles: {
        fillColor:
          navy,
        textColor: 255,
        fontStyle:
          "bold",
      },

      alternateRowStyles: {
        fillColor: [
          248,
          250,
          252,
        ],
      },

      columnStyles: {
        2: {
          halign:
            "right",
        },
      },
    });

    y =
      doc.lastAutoTable
        .finalY + 15;

    /* CURRENT MONTH */

    doc.setFontSize(12);

    doc.setTextColor(
      ...navy
    );

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.text(
      "Pengeluaran Bulan Ini",
      15,
      y
    );

    y += 6;

    doc.autoTable({
      startY: y,

      theme: "plain",

      head: [
        [
          "Tanggal",
          "Keterangan",
          "Nominal",
        ],
      ],

      body:
        insight?.currentMonth?.expenses?.map(
          (e) => [
            e.date,
            e.note,
            format(
              e.amount
            ),
          ]
        ) || [],

      styles: {
        fontSize: 9,
        cellPadding: 4,
        lineColor:
          border,
        lineWidth: 0.2,
      },

      headStyles: {
        fillColor:
          navy,
        textColor: 255,
        fontStyle:
          "bold",
      },

      alternateRowStyles: {
        fillColor: [
          248,
          250,
          252,
        ],
      },

      columnStyles: {
        2: {
          halign:
            "right",
        },
      },
    });

    /* =========================================
       PAGE 3
    ========================================= */

    doc.addPage();

    y = 20;

    doc.setFontSize(18);

    doc.setTextColor(
      ...navy
    );

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.text(
      "Laporan Tunggakan",
      15,
      y
    );

    y += 14;

    /* SUMMARY */

    doc.setFillColor(
      255,
      245,
      245
    );

    doc.roundedRect(
      15,
      y,
      180,
      24,
      4,
      4,
      "FD"
    );

    doc.setFontSize(10);

    doc.setTextColor(
      90
    );

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.text(
      "Total rumah menunggak",
      20,
      y + 9
    );

    doc.text(
      "Total piutang",
      20,
      y + 18
    );

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setTextColor(
      ...red
    );

    doc.text(
      `${unpaidList.length} rumah`,
      190,
      y + 9,
      {
        align: "right",
      }
    );

    doc.text(
      format(
        totalReceivables
      ),
      190,
      y + 18,
      {
        align: "right",
      }
    );

    y += 36;

    /* UNPAID CARDS */

    unpaidList.forEach(
      (r, i) => {
        if (y > 250) {
          doc.addPage();

          y = 20;
        }

        doc.setFillColor(
          250,
          250,
          250
        );

        doc.setDrawColor(
          ...border
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

        doc.setTextColor(
          ...navy
        );

        doc.text(
          `${i + 1}. ${
            r.house
          }`,
          20,
          y + 8
        );

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setTextColor(
          70
        );

        doc.text(
          `Nunggak ${
            r.jumlah
          } periode`,
          20,
          y + 15
        );

        doc.text(
          r.unpaid.join(
            ", "
          ),
          20,
          y + 21
        );

        doc.setTextColor(
          ...red
        );

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.text(
          format(r.total),
          188,
          y + 14,
          {
            align:
              "right",
          }
        );

        y += 30;
      }
    );

    /* =========================================
       FOOTER
    ========================================= */

    const pageCount =
      doc.internal.getNumberOfPages();

    for (
      let i = 1;
      i <= pageCount;
      i++
    ) {
      doc.setPage(i);

      doc.setDrawColor(
        ...border
      );

      doc.line(
        15,
        285,
        195,
        285
      );

      doc.setFontSize(8);

      doc.setTextColor(
        140
      );

      doc.text(
        "Kas Amarta • Sistem Keuangan Internal",
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

    /* =========================================
       OUTPUT
    ========================================= */

    const safeMonth = (
      insight?.currentMonth
        ?.month ||
      "laporan"
    ).replace(
      /[\/\\]/g,
      "-"
    );

    const pdfBuffer =
      doc.output(
        "arraybuffer"
      );

    return new Response(
      pdfBuffer,
      {
        headers: {
          "Content-Type":
            "application/pdf",

          "Content-Disposition":
            `attachment; filename="Laporan_Kas_${safeMonth}.pdf"`,
        },
      }
    );
  } catch (err) {
    console.error(err);

    return Response.json(
      {
        error:
          err.message ||
          "Internal Server Error",
      },
      {
        status: 500,
      }
    );
  }
}