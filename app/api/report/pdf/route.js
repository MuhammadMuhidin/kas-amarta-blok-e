import { jsPDF } from "jspdf";
import "jspdf-autotable";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    const { origin } = new URL(req.url);
    const res = await fetch(`${origin}/api/sheets/summary`, { 
      cache: 'no-store' 
    });
    
    if (!res.ok) throw new Error("Gagal mengambil data dari sheets");
    const json = await res.json();
    const report = json.insight || json;

    // --- KALKULASI DATA (Dari Logika HTML) ---
    const lastNet = (report.monthly?.lastMonth?.income || 0) - (report.monthly?.lastMonth?.expenseTotal || 0);
    const currentNet = (report.monthly?.currentMonth?.income || 0) - (report.monthly?.currentMonth?.expenseTotal || 0);
    
    const growth = lastNet === 0 
      ? 0 
      : ((currentNet - lastNet) / Math.abs(lastNet)) * 100;

    const paymentRate = report.payment?.totalMembers
      ? (report.payment.paidThisMonth / report.payment.totalMembers) * 100
      : 0;

    const format = (n) => Number(n || 0).toLocaleString("id-ID");

    // --- INISIALISASI PDF ---
    const doc = new jsPDF();
    
    // --- HEADER ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("FINANCIAL REPORT", 14, 20);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleDateString("id-ID")}`, 14, 26);
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(14, 30, 196, 30); // Garis header hitam tebal

    // --- KPI GRID (3 KOLOM) ---
    doc.autoTable({
      startY: 35,
      theme: 'grid',
      head: [['Total Income', 'Total Expense', 'Current Balance']],
      body: [[
        format(report.financial?.incomeAllTime),
        format(report.financial?.expenseAllTime),
        format(report.financial?.balance)
      ]],
      headStyles: { fillColor: [245, 245, 245], textColor: [100], fontSize: 8, fontStyle: 'normal' },
      bodyStyles: { fontSize: 12, fontStyle: 'bold', textColor: [0] },
      styles: { halign: 'center' }
    });

    // --- MONTHLY PERFORMANCE ---
    let finalY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("MONTHLY PERFORMANCE", 17, finalY);
    doc.setLineWidth(0.8);
    doc.line(14, finalY - 4, 14, finalY + 1); // Variasi border-left ala HTML

    doc.autoTable({
      startY: finalY + 5,
      theme: 'grid',
      head: [['Month', 'Income', 'Expense', 'Net']],
      body: [
        [
          report.monthly?.lastMonth?.month || "Last Month",
          format(report.monthly?.lastMonth?.income),
          format(report.monthly?.lastMonth?.expenseTotal),
          format(lastNet)
        ],
        [
          report.monthly?.currentMonth?.month || "Current Month",
          format(report.monthly?.currentMonth?.income),
          format(report.monthly?.currentMonth?.expenseTotal),
          format(currentNet)
        ]
      ],
      headStyles: { fillColor: [245, 245, 245], textColor: [0] },
      styles: { fontSize: 9 }
    });

    // --- PAYMENT STATUS & RISK ANALYSIS (2 KOLOM) ---
    finalY = doc.lastAutoTable.finalY + 15;
    
    // Sub-header Payment
    doc.text("PAYMENT STATUS", 17, finalY);
    doc.line(14, finalY - 4, 14, finalY + 1);
    
    // Sub-header Risk (Geser ke kanan)
    doc.text("RISK ANALYSIS", 110, finalY);
    doc.line(107, finalY - 4, 107, finalY + 1);

    doc.autoTable({
      startY: finalY + 5,
      theme: 'plain',
      body: [
        [
          `• Total Members: ${report.payment?.totalMembers || 0}\n` +
          `• Paid: ${report.payment?.paidThisMonth || 0}\n` +
          `• Unpaid: ${(report.payment?.totalMembers || 0) - (report.payment?.paidThisMonth || 0)}\n` +
          `• Compliance: ${paymentRate.toFixed(1)}%`,
          
          `• Growth: ${growth.toFixed(2)}%\n` +
          `• Status: ${report.financial?.balance > 0 ? "SURPLUS" : "DEFISIT"}\n` +
          `• Stability: ${Math.abs(growth) < 20 ? "STABLE" : "VOLATILE"}`
        ]
      ],
      styles: { fontSize: 9, cellPadding: 2 }
    });

    // --- INSIGHTS ---
    finalY = doc.lastAutoTable.finalY + 15;
    doc.text("INSIGHTS", 17, finalY);
    doc.line(14, finalY - 4, 14, finalY + 1);
    
    const insights = report.insights || [];
    doc.autoTable({
      startY: finalY + 5,
      theme: 'plain',
      body: insights.map(text => [`• ${text}`]),
      styles: { fontSize: 9, cellPadding: 1 }
    });

    const pdfBuffer = doc.output("arraybuffer");

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="financial-report.pdf"',
      },
    });

  } catch (err) {
    console.error("PDF_GEN_ERROR:", err);
    return new Response(JSON.stringify({ error: "Gagal membuat PDF", detail: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}