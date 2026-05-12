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

    // --- LOGIC INTEGRATION ---
    const sortedPeriods = [...periods].sort((a, b) => a.localeCompare(b));
    const lastPeriod = sortedPeriods[sortedPeriods.length - 1] || "";
    const nominalIuran = 50000; // Contoh asumsi nominal iuran per bulan, sesuaikan jika ada di data

    const activeMembersCount = persons.filter(am => {
        if (!am.join_date) return true;
        return am.join_date.slice(0, 7) <= lastPeriod;
    }).length;

    const paidInLastPeriodCount = new Set(
      payments
        .filter(p => (p.period || "").slice(0, 7) === lastPeriod)
        .map(p => `${p.person_id}-${p.person_house}`)
    ).size;

    const unpaidList = persons.map((p) => {
        const validPeriods = periods.filter((pr) => {
          if (!p.join_date) return true;
          return pr >= p.join_date.slice(0, 7);
        });
        const paid = payments
          .filter((pay) => pay.person_id === p.id && pay.person_house === p.house)
          .map((pay) => pay.period.slice(0, 7));
        const unpaid = validPeriods.filter((pr) => !paid.includes(pr));
        return { 
          house: p.house, 
          name: p.name, 
          jumlah: unpaid.length, 
          totalPiutang: unpaid.length * nominalIuran,
          detail: unpaid.join(", ") 
        };
      })
      .filter((r) => r.jumlah >= 1)
      .sort((a, b) => a.house.localeCompare(b.house, undefined, { numeric: true }));

    const totalPiutangWarga = unpaidList.reduce((sum, item) => sum + item.totalPiutang, 0);

    // --- GENERATE PDF ---
    const doc = new jsPDF('p', 'mm', 'a4');
    const format = (n) => `Rp ${Number(n || 0).toLocaleString("id-ID")}`;
    const blueDark = [44, 62, 80];
    const accentColor = [41, 128, 185];
    
    // 1. HEADER MODERN
    doc.setFillColor(...blueDark);
    doc.rect(0, 0, 210, 50, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("LAPORAN KEUANGAN BULANAN", 15, 25);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Sistem Kas Amarta | Periode Laporan: ${insight.currentMonth.month}`, 15, 33);
    doc.text(`Dicetak pada: ${new Date().toLocaleString("id-ID")}`, 15, 38);

    // 2. SUMMARY CARDS (Top Metrics)
    const drawCard = (x, y, w, h, title, value, color) => {
      doc.setFillColor(248, 249, 250);
      doc.roundedRect(x, y, w, h, 2, 2, 'F');
      doc.setDrawColor(220, 220, 220);
      doc.roundedRect(x, y, w, h, 2, 2, 'D');
      
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(title, x + 5, y + 7);
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...color);
      doc.text(value, x + 5, y + 15);
    };

    drawCard(15, 55, 60, 22, "TOTAL SALDO SAAT INI", format(insight.summary.currentBalance), accentColor);
    drawCard(80, 55, 55, 22, "PENGELUARAN BULAN INI", format(insight.currentMonth.expenseTotal), [192, 57, 43]);
    drawCard(140, 55, 55, 22, "ESTIMASI PIUTANG WARGA", format(totalPiutangWarga), [230, 126, 34]);

    // 3. SEKSI KEUANGAN DETIL
    doc.setFontSize(13);
    doc.setTextColor(...blueDark);
    doc.text("Rincian Alur Kas", 15, 90);
    
    doc.autoTable({
      startY: 95,
      theme: 'striped',
      head: [['Deskripsi Operasional', 'Nilai (IDR)']],
      body: [
        [`Sisa Saldo Bulan Lalu (${insight.lastMonth.month})`, format(insight.lastMonth.remaining)],
        [`Total Masuk Bulan Ini (${insight.currentMonth.month})`, format(insight.summary.currentIncomePlusLastRemaining - insight.lastMonth.remaining)],
        [`Total Pengeluaran Bulan Ini`, { content: `(${format(insight.currentMonth.expenseTotal)})`, styles: { textColor: [192, 57, 43] } }],
        [{ content: `SALDO AKHIR PER ${insight.currentMonth.month.toUpperCase()}`, styles: { fontStyle: 'bold' } }, 
         { content: format(insight.summary.currentBalance), styles: { fontStyle: 'bold', textColor: accentColor, fontSize: 11 } }],
      ],
      headStyles: { fillColor: accentColor },
      styles: { cellPadding: 4 },
      columnStyles: { 1: { halign: 'right' } }
    });

    // 4. STATISTIK KEPATUHAN (Bar Chart representation or Data)
    let finalY = doc.lastAutoTable.finalY + 15;
    const kepatuhanPersen = ((paidInLastPeriodCount / activeMembersCount) * 100).toFixed(1);
    
    doc.setFontSize(13);
    doc.setTextColor(...blueDark);
    doc.text("Kepatuhan Iuran Warga", 15, finalY);

    // Progress Bar Background
    doc.setFillColor(236, 240, 241);
    doc.rect(15, finalY + 5, 180, 8, 'F');
    // Progress Bar Value
    doc.setFillColor(46, 204, 113);
    doc.rect(15, finalY + 5, (180 * kepatuhanPersen) / 100, 8, 'F');
    
    doc.setFontSize(9);
    doc.setTextColor(50);
    doc.text(`${paidInLastPeriodCount} dari ${activeMembersCount} Rumah sudah melunasi iuran (${kepatuhanPersen}%)`, 15, finalY + 18);

    // 5. DAFTAR TUNGGAKAN
    finalY = finalY + 30;
    if (finalY > 220) { doc.addPage(); finalY = 20; }

    doc.setFontSize(13);
    doc.setTextColor(192, 57, 43);
    doc.text("Daftar Piutang / Tunggakan Warga", 15, finalY);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("Daftar warga yang memiliki tunggakan iuran lebih dari 1 bulan", 15, finalY + 6);

    const unpaidRows = unpaidList.map(u => [
        u.house, 
        u.name, 
        `${u.jumlah} bln`, 
        format(u.totalPiutang),
        { content: u.detail, styles: { fontSize: 7, textColor: [100, 100, 100] } }
    ]);

    doc.autoTable({
      startY: finalY + 10,
      head: [['No. Kav', 'Nama Warga', 'Lama', 'Nominal', 'Detail Periode']],
      body: unpaidRows,
      headStyles: { fillColor: [192, 57, 43] },
      columnStyles: { 
        0: { cellWidth: 20 }, 
        2: { halign: 'center' }, 
        3: { halign: 'right', fontStyle: 'bold' },
        4: { cellWidth: 70 } 
      },
      styles: { fontSize: 9, overflow: 'linebreak' }
    });

    // FOOTER DENGAN NOMOR HALAMAN
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(230, 230, 230);
      doc.line(15, 280, 195, 280); // Divider line
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Laporan Kas Amarta - Halaman ${i} dari ${pageCount}`, 15, 285);
      doc.text("Laporan ini sah dan dihasilkan secara sistematis melalui Aplikasi Kas.", 195, 285, { align: 'right' });
    }

    const pdfBuffer = doc.output("arraybuffer");
    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Laporan_Kas_Amarta_${insight.currentMonth.month}.pdf"`,
      },
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}