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

    /* ===================================
       UTIL
    =================================== */

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

    const nominalIuran = 25000;

    const sortedPeriods = [
      ...periods,
    ].sort((a, b) =>
      a.localeCompare(b)
    );

    const lastPeriod =
      sortedPeriods[
        sortedPeriods.length - 1
      ] || "";

    /* ===================================
       TOTAL CASHFLOW
    =================================== */

    const totals =
      cashflows.reduce(
        (acc, c) => {
          const amount =
            Number(c.amount || 0);

          if (
            c.type === "income"
          ) {
            acc.inc += amount;
          }

          if (
            c.type === "expense"
          ) {
            acc.exp += amount;
          }

          acc.net =
            acc.inc - acc.exp;

          return acc;
        },
        {
          inc: 0,
          exp: 0,
          net: 0,
        }
      );

    /* ===================================
       JUMLAH RUMAH BAYAR
    =================================== */

    const paidHousesSet =
      new Set(
        payments
          .filter(
            (p) =>
              p.period &&
              p.period.slice(
                0,
                7
              ) === lastPeriod
          )
          .map(
            (p) =>
              p.person_house
          )
      );

    const paidInLastPeriodCount =
      paidHousesSet.size;

    /* ===================================
       TUNGGAKAN
    =================================== */

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
        a.house.localeCompare(
          b.house,
          undefined,
          {
            numeric: true,
          }
        )
      );

    /* ===================================
       PDF INIT
    =================================== */

    const doc = new jsPDF();

    const navy = [
      15, 23, 42,
    ];

    const green = [
      34, 197, 94,
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

    let y = 0;

    /* ===================================
       HEADER
    =================================== */

    doc.setFillColor(
      ...navy
    );

    doc.rect(
      0,
      0,
      210,
      40,
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

    y = 52;

    /* ===================================
       SUMMARY CARDS
    =================================== */

    const drawCard = (
      x,
      title,
      value,
      color
    ) => {
      /* fake shadow */
      doc.setFillColor(
        230,
        230,
        230
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
        230
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

    y += 45;

    /* ===================================
       SECTION TITLE
    =================================== */

    doc.setDrawColor(
      230
    );

    doc.line(
      15,
      y,
      195,
      y
    );

    y += 10;

    doc.setFontSize(14);

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setTextColor(
      ...navy
    );

    doc.text(
      "Rekap Keuangan Kas",
      15,
      y
    );

    y += 12;

    /* ===================================
       STATEMENT ROW
    =================================== */

    const drawRow = (
      label,
      value,
      color = [
        30, 30, 30,
      ],
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

    drawRow(
      `Pengeluaran ${
        insight?.lastMonth
          ?.month || "-"
      }`,
      format(
        insight?.lastMonth
          ?.expenseTotal || 0
      ),
      red
    );

    drawRow(
      `Sisa saldo kumulatif per ${
        insight?.lastMonth
          ?.month || "-"
      }`,
      format(
        insight?.lastMonth
          ?.remaining || 0
      ),
      blue,
      true
    );

    y += 4;

    doc.setDrawColor(
      235
    );

    doc.line(
      15,
      y,
      195,
      y
    );

    y += 10;

    drawRow(
      `Kas bulan ${
        insight?.currentMonth
          ?.month || "-"
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

    /* ===================================
       FINAL BALANCE BOX
    =================================== */

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

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setTextColor(
      80
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
        insight?.summary
          ?.currentBalance ||
          0
      ),
      190,
      y + 16,
      {
        align: "right",
      }
    );

    y += 38;

    /* ===================================
       TUNGGAKAN TITLE
    =================================== */

    doc.setDrawColor(
      230
    );

    doc.line(
      15,
      y,
      195,
      y
    );

    y += 10;

    doc.setFontSize(14);

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setTextColor(
      ...navy
    );

    doc.text(
      "Laporan Tunggakan",
      15,
      y
    );

    y += 12;

    /* ===================================
       TUNGGAKAN CARD
    =================================== */

    if (
      unpaidList.length === 0
    ) {
      doc.setFontSize(10);

      doc.setTextColor(
        100
      );

      doc.text(
        "Tidak ada tunggakan.",
        15,
        y
      );
    } else {
      unpaidList.forEach(
        (r, i) => {
          if (y > 245) {
            doc.addPage();

            y = 20;
          }

          /* shadow */
          doc.setFillColor(
            235,
            235,
            235
          );

          doc.roundedRect(
            16,
            y + 1,
            179,
            24,
            3,
            3,
            "F"
          );

          /* card */
          doc.setFillColor(
            250,
            250,
            250
          );

          doc.setDrawColor(
            235
          );

          doc.roundedRect(
            15,
            y,
            179,
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
            y + 15,
            {
              align:
                "right",
            }
          );

          y += 32;
        }
      );
    }

    /* ===================================
       FOOTER
    =================================== */

    const pageCount =
      doc.internal.getNumberOfPages();

    for (
      let i = 1;
      i <= pageCount;
      i++
    ) {
      doc.setPage(i);

      doc.setDrawColor(
        230
      );

      doc.line(
        15,
        285,
        195,
        285
      );

      doc.setFontSize(8);

      doc.setTextColor(
        130
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

    /* ===================================
       OUTPUT
    =================================== */

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