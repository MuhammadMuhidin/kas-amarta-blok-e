import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

export const runtime = "nodejs";

export async function GET() {
  let browser = null;

  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    // =========================
    // FETCH SUMMARY DATA
    // =========================
    const res = await fetch(`${process.env.BASE_URL}/api/sheets/summary`, {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error("Failed to fetch summary");
    }

    const json = await res.json();

    // fleksibel: ambil dari insight/report
    const report = json.insight || json.report || json;

    // =========================
    // GENERATE HTML
    // =========================
    const html = generateHTML(report);

    await page.setContent(html, {
      waitUntil: "networkidle0",
    });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "12px",
        bottom: "12px",
        left: "12px",
        right: "12px",
      },
    });

    await browser.close();

    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=laporan-kas.pdf",
      },
    });

  } catch (err) {
    console.error("PDF ERROR:", err);

    if (browser) await browser.close();

    return new Response("PDF generation failed", { status: 500 });
  }
}

/* =========================
   SAFE HTML (VERCEL FRIENDLY)
   ========================= */
function generateHTML(report = {}) {
  const format = (n) =>
    Number(n || 0).toLocaleString("id-ID");

  return `
  <html>
  <head>
    <style>
      body {
        font-family: Arial, sans-serif;
        padding: 20px;
        font-size: 12px;
        color: #111;
      }

      .header {
        border-bottom: 2px solid #000;
        margin-bottom: 16px;
        padding-bottom: 10px;
      }

      .title {
        font-size: 18px;
        font-weight: bold;
      }

      .section {
        margin-top: 16px;
      }

      .box {
        border: 1px solid #ddd;
        padding: 10px;
        margin-top: 10px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
      }

      th, td {
        border: 1px solid #ddd;
        padding: 6px;
      }

      th {
        background: #f5f5f5;
      }

      ul {
        margin: 0;
        padding-left: 18px;
      }

      .kpi {
        display: flex;
        gap: 10px;
      }

      .kpi div {
        flex: 1;
        border: 1px solid #ddd;
        padding: 8px;
      }

      .label {
        font-size: 10px;
        color: #666;
      }

      .value {
        font-size: 14px;
        font-weight: bold;
        margin-top: 4px;
      }
    </style>
  </head>

  <body>

    <div class="header">
      <div class="title">LAPORAN KAS AMARTA</div>
      <div style="font-size:10px;color:#666">
        Generated: ${new Date().toLocaleDateString("id-ID")}
      </div>
    </div>

    <!-- KPI -->
    <div class="kpi">
      <div>
        <div class="label">Total Income</div>
        <div class="value">${format(report.financial?.incomeAllTime)}</div>
      </div>

      <div>
        <div class="label">Total Expense</div>
        <div class="value">${format(report.financial?.expenseAllTime)}</div>
      </div>

      <div>
        <div class="label">Balance</div>
        <div class="value">${format(report.financial?.balance)}</div>
      </div>
    </div>

    <!-- MONTHLY -->
    <div class="section">
      <b>Monthly Report</b>

      <div class="box">
        <table>
          <tr>
            <th>Month</th>
            <th>Income</th>
            <th>Expense</th>
          </tr>

          <tr>
            <td>${report.monthly?.lastMonth?.month || "-"}</td>
            <td>${format(report.monthly?.lastMonth?.income)}</td>
            <td>${format(report.monthly?.lastMonth?.expenseTotal)}</td>
          </tr>

          <tr>
            <td>${report.monthly?.currentMonth?.month || "-"}</td>
            <td>${format(report.monthly?.currentMonth?.income)}</td>
            <td>${format(report.monthly?.currentMonth?.expenseTotal)}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- PAYMENT -->
    <div class="section">
      <b>Payment Status</b>

      <div class="box">
        <ul>
          <li>Total Members: ${report.payment?.totalMembers || 0}</li>
          <li>Paid: ${report.payment?.paidThisMonth || 0}</li>
          <li>Unpaid: ${
            (report.payment?.totalMembers || 0) -
            (report.payment?.paidThisMonth || 0)
          }</li>
        </ul>
      </div>
    </div>

    <!-- INSIGHT -->
    <div class="section">
      <b>Insights</b>

      <div class="box">
        <ul>
          ${(report.insights || [])
            .map((i) => `<li>${i}</li>`)
            .join("")}
        </ul>
      </div>
    </div>

  </body>
  </html>
  `;
}
