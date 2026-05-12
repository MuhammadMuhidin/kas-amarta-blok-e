import { jsPDF } from "jspdf";
import "jspdf-autotable";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    const { origin } = new URL(req.url);
    const res = await fetch(`${origin}/api/sheets/summary`, { cache: 'no-store' });
    if (!res.ok) throw new Error("Gagal mengambil data");
    
    const data = await res.json();
    const { insight, persons, payments, periods } = data;

    // --- PENGATURAN WAKTU WIB (ASIA/JAKARTA) ---
    const now = new Date();
    const jakartaTime = new Intl.DateTimeFormat("id-ID", {
      dateStyle: "long",
      timeStyle: "medium",
      timeZone: "Asia/Jakarta",
    }).format(now);

    // --- LOGIC INTEGRATION ---
    const sortedPeriods = [...periods].sort((a, b) => a.localeCompare(b));
    const lastPeriod = sortedPeriods[sortedPeriods.length - 1] || "";
    
    // Hitung Piutang
    const nominalIuran = 20000; // Sesuaikan nominal per rumah jika berbeda
    const unpaidList = persons.map((p) => {
        const validPeriods = periods.filter((pr) => !p.join_date || pr >= p.join_date.slice(0, 7));
        const paid = payments
          .filter((pay) => pay.person_id === p.id && pay.person_house === p.house)
          .map((pay) => pay.period.slice(0, 7));
        const unpaid = validPeriods.filter((pr) => !paid.includes(pr));
        return { house: p.house, name: p.name, jumlah: unpaid.length, total: unpaid.length * nominalIuran };
      })
      .filter((r) => r.jumlah >= 1)
      .sort((a, b) => a.house.localeCompare(b.house, undefined, { numeric: true }));

    // --- GENERATE PDF ---
    const doc = new jsPDF();
    const format = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;
    
    // Warna palet profesional
    const navy = [44, 62, 80];
    const red = [192, 57, 43];
    const green = [39, 174, 96];

    // 1. HEADER DENGAN AKSEN MODERN
    doc.setFillColor(...navy);
    doc.rect(0, 0, 210, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("LAPORAN EKSEKUTIF KAS AMARTA", 15, 25);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Update Data: ${insight.currentMonth.month}  |  Zona Waktu: Asia/Jakarta (WIB)`, 15, 32);
    doc.text(`Dicetak pada: ${jakartaTime}`, 15, 37);

    // 2. KOTAK RINGKASAN (Summary Highlight)
    doc.setDrawColor(200);
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(15, 52, 180, 25, 2, 2, 'FD');
    
    doc.setTextColor(...navy);
    doc.setFontSize(9);
    doc.text("TOTAL SALDO BERSIH SAAT INI", 20, 60);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...green);
    doc.text(format(insight.summary.currentBalance), 20, 70);

    // 3. SEKSI 1: REKAP KEUANGAN (April & Mei)
    doc.setTextColor(...navy);
    doc.setFontSize(12);
    doc.text("Analisis Arus Kas Perbandingan", 15, 90);
    
    doc.autoTable({
      startY: 95,
      theme: 'grid',
      head: [['Kategori Transaksi', 'Keterangan Periode', 'Nominal']],
      body: [
        ["Pengeluaran Lalu", `Bulan ${insight.lastMonth.month}`, { content: format(insight.lastMonth.expenseTotal), styles: { textColor: red } }],
        ["Sisa Saldo Kumulatif", `Per ${insight.lastMonth.month}`, { content: format(insight.lastMonth.remaining), styles: { fontStyle: 'bold' } }],
        ["Total Pemasukan + Sisa", `${insight.currentMonth.month} (${insight.summary.paidHouses} Rumah)`, format(insight.summary.currentIncomePlusLastRemaining)],
        ["Pengeluaran Berjalan", `Bulan ${insight.currentMonth.month}`, { content: format(insight.currentMonth.expenseTotal), styles: { textColor: red } }],
        [{ content: "TOTAL SALDO AKHIR", styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } }, "", { content: format(insight.summary.currentBalance), styles: { fontStyle: 'bold', fontSize: 11, fillColor: [230, 230, 230] } }],
      ],
      headStyles: { fillColor: navy },
      columnStyles: { 2: { halign: 'right' } }
    });

    // 4. SEKSI 2: DAFTAR TUNGGAKAN (PIUTANG)
    let finalY = doc.lastAutoTable.finalY + 15;
    if (finalY > 220) { doc.addPage(); finalY = 20; }

    doc.setFontSize(12);
    doc.setTextColor(...red);
    doc.text("Detail Tunggakan Iuran Warga", 15, finalY);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("*Tunggakan dihitung berdasarkan data warga aktif", 15, finalY + 6);

    const unpaidRows = unpaidList.map(u => [
        u.house, 
        u.name, 
        `${u.jumlah} Bulan`, 
        { content: format(u.total), styles: { fontStyle: 'bold' } }
    ]);

    doc.autoTable({
      startY: finalY + 10,
      head: [['Kavling', 'Nama Warga', 'Durasi', 'Total Piutang']],
      body: unpaidRows,
      headStyles: { fillColor: red },
      columnStyles: { 2: { halign: 'center' }, 3: { halign: 'right' } },
      alternateRowStyles: { fillColor: [255, 245, 245] }
    });

    // 5. FOOTER DENGAN NOMOR HALAMAN
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Laporan Kas Amarta - Halaman ${i} dari ${pageCount}`, 105, 285, { align: 'center' });
      doc.text("Dokumen ini dihasilkan secara otomatis oleh sistem.", 15, 285);
    }

    const pdfBuffer = doc.output("arraybuffer");
    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Laporan_Kas_${insight.currentMonth.month}.pdf"`,
      },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}