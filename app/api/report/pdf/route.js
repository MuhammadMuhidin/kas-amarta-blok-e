import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

export const runtime = "nodejs";

export async function GET() {
  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport,
    });

    const page = await browser.newPage();

    // ⚡ OPTIMIZATION: block heavy resources (speed boost)
    await page.setRequestInterception(true);

    page.on("request", (req) => {
      const blocked = ["image", "font", "media", "stylesheet"];
      if (blocked.includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    const res = await fetch(`${process.env.BASE_URL}/api/summary`, {
      cache: "no-store",
    });

    const { report } = await res.json();

    const html = generateHTML(report);

    await page.setContent(html, {
      waitUntil: "domcontentloaded",
    });

    // stabilisasi render ringan
    await page.waitForTimeout(500);

    const pdf = await page.pdf({
      format: "A4",
      printBackground: false, // ⚡ lebih cepat di Vercel
      margin: {
        top: "14px",
        bottom: "14px",
        left: "14px",
        right: "14px",
      },
    });

    await browser.close();

    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          "attachment; filename=laporan-kas.pdf",
      },
    });
  } catch (err) {
    console.error(err);
    return new Response("PDF generation failed", { status: 500 });
  }
}

/* =========================
   BANK-STYLE LIGHTWEIGHT HTML
   ========================= */
function generateHTML(report) {
  const lastNet =
    report.monthly.lastMonth.income -
    report.monthly.lastMonth.expenseTotal;

  const currentNet =
    report.monthly.currentMonth.income -
    report.monthly.currentMonth.expenseTotal;

  const growth =
    lastNet === 0
      ? 0
      : ((currentNet - lastNet) / Math.abs(lastNet)) * 100;

  const paymentRate = report.payment.totalMembers
    ? (report.payment.paidThisMonth /
        report.payment.totalMembers) *
      100
    : 0;

  const format = (n) =>
    Number(n || 0).toLocaleString("id-ID");

  return `
  <html>
  <head>
    <style>
      body {
        font-family: Arial, sans-serif;
        padding: 20px;
        font-size: 11px;
        color: #111;
      }

      .header {
        border-bottom: 2px solid #000;
        padding-bottom: 10px;
        margin-bottom: 16px;
      }

      .title {
        font-size: 18px;
        font-weight: bold;
        letter-spacing: 1px;
      }

      .subtitle {
        font-size: 10px;
        color: #666;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        margin-top: 10px;
      }

      .card {
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

      .section {
        margin-top: 18px;
      }

      .section-title {
        font-weight: bold;
        border-left: 3px solid #000;
        padding-left: 6px;
        margin-bottom: 8px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 10px;
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
        padding-left: 16px;
      }

      .badge {
        font-size: 9px;
        padding: 2px 5px;
        border-radius: 3px;
      }

      .ok { background: #e8f5e9; }
      .bad { background: #ffebee; }
    </style>
  </head>

  <body>

    <!-- HEADER -->
    <div class="header">
      <div class="title">FINANCIAL REPORT</div>
      <div class="subtitle">
        Generated: ${new Date().toLocaleDateString("id-ID")}
      </div>
    </div>

    <!-- KPI -->
    <div class="grid">
      <div class="card">
        <div class="label">Total Income</div>
        <div class="value">${format(report.financial.incomeAllTime)}</div>
      </div>

      <div class="card">
        <div class="label">Total Expense</div>
        <div class="value">${format(report.financial.expenseAllTime)}</div>
      </div>

      <div class="card">
        <div class="label">Current Balance</div>
        <div class="value">${format(report.financial.balance)}</div>
      </div>
    </div>

    <!-- MONTHLY -->
    <div class="section">
      <div class="section-title">MONTHLY PERFORMANCE</div>

      <table>
        <tr>
          <th>Month</th>
          <th>Income</th>
          <th>Expense</th>
          <th>Net</th>
        </tr>

        <tr>
          <td>${report.monthly.lastMonth.month}</td>
          <td>${format(report.monthly.lastMonth.income)}</td>
          <td>${format(report.monthly.lastMonth.expenseTotal)}</td>
          <td>${format(lastNet)}</td>
        </tr>

        <tr>
          <td>${report.monthly.currentMonth.month}</td>
          <td>${format(report.monthly.currentMonth.income)}</td>
          <td>${format(report.monthly.currentMonth.expenseTotal)}</td>
          <td>${format(currentNet)}</td>
        </tr>
      </table>
    </div>

    <!-- PAYMENT -->
    <div class="section">
      <div class="section-title">PAYMENT STATUS</div>

      <ul>
        <li>Total Members: ${report.payment.totalMembers}</li>
        <li>Paid: ${report.payment.paidThisMonth}</li>
        <li>
          Unpaid: ${
            report.payment.totalMembers - report.payment.paidThisMonth
          }
        </li>
        <li>Compliance Rate: ${paymentRate.toFixed(1)}%</li>
      </ul>
    </div>

    <!-- INSIGHT -->
    <div class="section">
      <div class="section-title">INSIGHT</div>
      <ul>
        ${report.insights.map(i => `<li>${i}</li>`).join("")}
      </ul>
    </div>

    <!-- RISK -->
    <div class="section">
      <div class="section-title">RISK ANALYSIS</div>
      <ul>
        <li>Growth: ${growth.toFixed(2)}%</li>
        <li>Status: ${report.financial.balance > 0 ? "SURPLUS" : "DEFISIT"}</li>
        <li>Stability: ${Math.abs(growth) < 20 ? "STABLE" : "VOLATILE"}</li>
      </ul>
    </div>

  </body>
  </html>
  `;
}
