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
       PDF INIT
    ========================================= */

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth =
      doc.internal.pageSize.getWidth();

    const pageHeight =
      doc.internal.pageSize.getHeight();

    let y = 20;

    /* =========================================
       SAFE PAGE SYSTEM
    ========================================= */

    const ensureSpace = (
      needed = 30
    ) => {
      if (
        y + needed >
        pageHeight - 25
      ) {
        doc.addPage();
        y = 20;
      }
    };

    /* =========================================
       FORMAT
    ========================================= */

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
      22, 163, 74,
    ];

    const red = [
      220, 38, 38,
    ];

    const blue = [
      37, 99, 235,
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
       PAYMENT STATS
    ========================================= */

    const activeHouses =
      persons.length;

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
       UNPAID
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
      .sort(
        (a, b) =>
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
       MONTHLY TREND
    ========================================= */

    const monthlyTrend =
      periods
        .sort()
        .map((period) => {
          const paid =
            new Set(
              payments
                .filter(
                  (p) =>
                    p.period?.slice(
                      0,
                      7
                    ) === period
                )
                .map(
                  (p) =>
                    p.person_house
                )
            ).size;

          const income =
            cashflows
              .filter(
                (c) =>
                  c.type ===
                    "income" &&
                  (
                    c.date || ""
                  ).slice(
                    0,
                    7
                  ) === period
              )
              .reduce(
                (sum, c) =>
                  sum +
                  Number(
                    c.amount || 0
                  ),
                0
              );

          const expense =
            cashflows
              .filter(
                (c) =>
                  c.type ===
                    "expense" &&
                  (
                    c.date || ""
                  ).slice(
                    0,
                    7
                  ) === period
              )
              .reduce(
                (sum, c) =>
                  sum +
                  Number(
                    c.amount || 0
                  ),
                0
              );

          return {
            period,
            paid,
            income,
            expense,
            balance:
              income -
              expense,
          };
        });

    /* =========================================
       AGING
    ========================================= */

    const aging = {
      ringan:
        unpaidList.filter(
          (x) =>
            x.jumlah >= 1 &&
            x.jumlah <= 2
        ).length,

      sedang:
        unpaidList.filter(
          (x) =>
            x.jumlah >= 3 &&
            x.jumlah <= 5
        ).length,

      berat:
        unpaidList.filter(
          (x) =>
            x.jumlah >= 6
        ).length,
    };

    /* =========================================
       PAID HOUSE LIST
    ========================================= */

    const paidHouseList =
      persons
        .filter((p) => {
          return payments.some(
            (pay) =>
              pay.person_house ===
                p.house &&
              pay.period?.slice(
                0,
                7
              ) ===
                currentMonthKey
          );
        })
        .map((p) => p.house)
        .sort();

    /* =========================================
       HEADER
    ========================================= */

    doc.setFillColor(
      ...navy
    );

    doc.rect(
      0,
      0,
      pageWidth,
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

    doc.setFontSize(24);

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
      28
    );

    doc.setFontSize(8);

    doc.text(
      `Dicetak ${jakartaTime}`,
      15,
      35
    );

    y = 55;

    /* =========================================
       SUMMARY CARDS
    ========================================= */

    const drawCard = (
      x,
      title,
      value,
      color
    ) => {
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
        y + 8
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
        y + 20
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
       SECTION TITLE
    ========================================= */

    const sectionTitle = (
      title
    ) => {
      ensureSpace(20);

      doc.setDrawColor(
        ...border
      );

      doc.line(
        15,
        y,
        195,
        y
      );

      y += 10;

      doc.setFontSize(15);

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setTextColor(
        ...navy
      );

      doc.text(
        title,
        15,
        y
      );

      y += 12;
    };

    /* =========================================
       STAT ROW
    ========================================= */

    const statRow = (
      label,
      value,
      color = [
        20, 20, 20,
      ]
    ) => {
      ensureSpace(10);

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

      y += 10;
    };

    /* =========================================
       PAYMENT
    ========================================= */

    sectionTitle(
      "Statistik Pembayaran"
    );

    statRow(
      "Jumlah rumah aktif",
      `${activeHouses} rumah`
    );

    statRow(
      "Rumah sudah bayar",
      `${paidHouses} rumah`,
      green
    );

    statRow(
      "Persentase pembayaran",
      `${paymentRate}%`,
      blue
    );

    y += 5;

    /* =========================================
       REKAP
    ========================================= */

    sectionTitle(
      "Rekap Keuangan"
    );

    statRow(
      `Pengeluaran ${insight?.lastMonth?.month || "-"}`,
      format(
        insight?.lastMonth
          ?.expenseTotal || 0
      ),
      red
    );

    statRow(
      `Saldo kumulatif per ${insight?.lastMonth?.month || "-"}`,
      format(
        insight?.lastMonth
          ?.remaining || 0
      ),
      blue
    );

    statRow(
      `Kas ${insight?.currentMonth?.month || "-"} + sisa bulan lalu`,
      format(
        insight?.summary
          ?.currentIncomePlusLastRemaining ||
          0
      )
    );

    statRow(
      "Pengeluaran bulan ini",
      format(
        insight?.currentMonth
          ?.expenseTotal || 0
      ),
      red
    );

    ensureSpace(35);

    doc.setFillColor(
      239,
      246,
      255
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
      70
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
      y + 16,
      {
        align: "right",
      }
    );

    y += 35;

    /* =========================================
       KONDISI KEUANGAN
    ========================================= */

    sectionTitle(
      "Kondisi Keuangan"
    );

    const health =
      currentBalance > 0
        ? "Kas dalam kondisi sehat dan surplus."
        : "Kas mengalami defisit.";

    ensureSpace(25);

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
      y - 5,
      180,
      18,
      4,
      4,
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
      y + 5
    );

    y += 28;

    /* =========================================
       BIGGEST EXPENSE
    ========================================= */

    if (biggestExpense) {
      sectionTitle(
        "Pengeluaran Terbesar"
      );

      ensureSpace(30);

      doc.setFillColor(
        250,
        250,
        250
      );

      doc.roundedRect(
        15,
        y,
        180,
        22,
        4,
        4,
        "FD"
      );

      doc.setFontSize(10);

      doc.setTextColor(
        ...navy
      );

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.text(
        biggestExpense.note ||
          "-",
        20,
        y + 8
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setTextColor(
        ...gray
      );

      doc.text(
        biggestExpense.date ||
          "-",
        20,
        y + 16
      );

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setTextColor(
        ...red
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

      y += 32;
    }

    /* =========================================
       PAGE 2
    ========================================= */

    doc.addPage();

    y = 20;

    sectionTitle(
      "Detail Pengeluaran"
    );

    doc.autoTable({
      startY: y,

      theme: "grid",

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

      headStyles: {
        fillColor:
          navy,
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

    doc.autoTable({
      startY: y,

      theme: "grid",

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

      headStyles: {
        fillColor:
          navy,
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

    sectionTitle(
      "Laporan Tunggakan"
    );

    ensureSpace(35);

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
      80
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

    y += 35;

    /* =========================================
       AGING
    ========================================= */

    sectionTitle(
      "Kategori Tunggakan"
    );

    statRow(
      "Ringan (1-2 periode)",
      `${aging.ringan} rumah`,
      blue
    );

    statRow(
      "Sedang (3-5 periode)",
      `${aging.sedang} rumah`,
      red
    );

    statRow(
      "Berat (> 6 periode)",
      `${aging.berat} rumah`,
      red
    );

    y += 5;

    /* =========================================
       TOP DEBTORS
    ========================================= */

    sectionTitle(
      "Top Penunggak"
    );

    unpaidList
      .slice(0, 5)
      .forEach((r, i) => {
        ensureSpace(30);

        doc.setFillColor(
          250,
          250,
          250
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
          ...gray
        );

        doc.text(
          `Nunggak ${r.jumlah} periode`,
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

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setTextColor(
          ...red
        );

        doc.text(
          format(r.total),
          188,
          y + 13,
          {
            align:
              "right",
          }
        );

        y += 30;
      });

    /* =========================================
       PAGE 4
    ========================================= */

    doc.addPage();

    y = 20;

    sectionTitle(
      "Trend Bulanan"
    );

    doc.autoTable({
      startY: y,

      theme: "grid",

      head: [
        [
          "Periode",
          "Rumah Bayar",
          "Pemasukan",
          "Pengeluaran",
          "Saldo",
        ],
      ],

      body:
        monthlyTrend.map(
          (m) => [
            m.period,
            `${m.paid} rumah`,
            format(
              m.income
            ),
            format(
              m.expense
            ),
            format(
              m.balance
            ),
          ]
        ),

      headStyles: {
        fillColor:
          navy,
      },

      alternateRowStyles: {
        fillColor: [
          248,
          250,
          252,
        ],
      },

      columnStyles: {
        1: {
          halign:
            "center",
        },

        2: {
          halign:
            "right",
        },

        3: {
          halign:
            "right",
        },

        4: {
          halign:
            "right",
        },
      },
    });

    y =
      doc.lastAutoTable
        .finalY + 15;

    /* =========================================
       RUMAH LUNAS
    ========================================= */

    sectionTitle(
      "Rumah Sudah Membayar"
    );

    ensureSpace(40);

    doc.setFillColor(
      240,
      253,
      244
    );

    doc.roundedRect(
      15,
      y,
      180,
      30,
      4,
      4,
      "FD"
    );

    doc.setFontSize(10);

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setTextColor(
      ...green
    );

    doc.text(
      `${paidHouseList.length} rumah sudah membayar`,
      20,
      y + 10
    );

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setTextColor(
      70
    );

    const paidText =
      paidHouseList.join(
        ", "
      ) || "-";

    const splitText =
      doc.splitTextToSize(
        paidText,
        165
      );

    doc.text(
      splitText,
      20,
      y + 18
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
        287,
        195,
        287
      );

      doc.setFontSize(8);

      doc.setTextColor(
        140
      );

      doc.text(
        "Kas Amarta • Sistem Keuangan Internal",
        15,
        292
      );

      doc.text(
        `Halaman ${i} / ${pageCount}`,
        195,
        292,
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
            `attachment; filename="Laporan_Kas_Blok_E_${safeMonth}.pdf"`,
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