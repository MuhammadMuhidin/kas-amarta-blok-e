import { jsPDF } from "jspdf";
import "jspdf-autotable";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    // 1. Ambil origin untuk memanggil API internal
    const { origin } = new URL(req.url);
    const res = await fetch(`${origin}/api/sheets/summary`, { 
      cache: 'no-store' 
    });
    
    if (!res.ok) throw new Error("Gagal mengambil data dari sheets");
    const json = await res.json();
    const report = json.insight || json;

    // 2. Inisialisasi jsPDF
    const doc = new jsPDF();
    const format = (n) => Number(n || 0).toLocaleString("id-ID");

    // --- HEADER ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("LAPORAN KAS AMARTA", 14, 20);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString("id-ID")}`, 14, 28);
    doc.line(14, 32, 196, 32); // Garis pemisah

    // --- RINGKASAN (KPI) ---
    doc.setFont("helvetica", "bold");
    doc.text("Ringkasan Saldo", 14, 42);
    
    // Gunakan autoTable untuk layouting yang rapi
    doc.autoTable({
      startY: 45,
      theme: 'grid',
      head: [['Keterangan', 'Jumlah (IDR)']],
      body: [
        ['Total Pemasukan', `Rp ${format(report.financial?.incomeAllTime)}`],
        ['Total Pengeluaran', `Rp ${format(report.financial?.expenseAllTime)}`],
        ['Saldo Akhir', `Rp ${format(report.financial?.balance)}`],
      ],
      headStyles: { fillColor: [41, 128, 185] }, // Warna Biru
    });

    // --- TABEL BULANAN ---
    let finalY = doc.lastAutoTable.finalY;
    doc.text("Laporan Per Bulan", 14, finalY + 15);

    doc.autoTable({
      startY: finalY + 18,
      theme: 'striped',
      head: [['Bulan', 'Pemasukan', 'Pengeluaran']],
      body: [
        [
          report.monthly?.lastMonth?.month || "Bulan Lalu",
          format(report.monthly?.lastMonth?.income),
          format(report.monthly?.lastMonth?.expenseTotal)
        ],
        [
          report.monthly?.currentMonth?.month || "Bulan Ini",
          format(report.monthly?.currentMonth?.income),
          format(report.monthly?.currentMonth?.expenseTotal)
        ],
      ],
    });

    // --- INSIGHTS ---
    finalY = doc.lastAutoTable.finalY;
    doc.text("Analisis & Insight", 14, finalY + 15);
    
    const insights = report.insights || [];
    const insightList = insights.map((text, i) => [`${i + 1}.`, text]);

    doc.autoTable({
      startY: finalY + 18,
      theme: 'plain',
      body: insightList,
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 160 }
      },
      styles: { fontSize: 9 }
    });

    // 3. Konversi ke Buffer untuk Response
    const pdfBuffer = doc.output("arraybuffer");

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="laporan-kas-amarta.pdf"',
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
