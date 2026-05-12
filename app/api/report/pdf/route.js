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

    // --- LOGIC INTEGRATION (Pindahan dari Frontend) ---
    const sortedPeriods = [...periods].sort((a, b) => a.localeCompare(b));
    const lastPeriod = sortedPeriods[sortedPeriods.length - 1] || "";

    // 1. Hitung Rumah yang Aktif
    const activeMembersCount = persons.filter(am => {
        if (!am.join_date) return true;
        return am.join_date.slice(0, 7) <= lastPeriod;
    }).length;

    // 2. Hitung Rumah yang Sudah Bayar bulan ini
    const paidInLastPeriodCount = new Set(
      payments
        .filter(p => (p.period || "").slice(0, 7) === lastPeriod)
        .map(p => `${p.person_id}-${p.person_house}`)
    ).size;

    // 3. Rekap Piutang/Tunggakan per Orang
    const unpaidList = persons.map((p) => {
        const validPeriods = periods.filter((pr) => {
          if (!p.join_date) return true;
          return pr >= p.join_date.slice(0, 7);
        });
        const paid = payments
          .filter((pay) => pay.person_id === p.id && pay.person_house === p.house)
          .map((pay) => pay.period.slice(0, 7));
        const unpaid = validPeriods.filter((pr) => !paid.includes(pr));
        return { house: p.house, name: p.name, jumlah: unpaid.length, detail: unpaid.join(", ") };
      })
      .filter((r) => r.jumlah >= 1)
      .sort((a, b) => a.house.localeCompare(b.house, undefined, { numeric: true }));

    // --- GENERATE PDF ---
    const doc = new jsPDF();
    const format = (n) => `Rp ${Number(n || 0).toLocaleString("id-ID")}`;
    
    // Header & Brand
    doc.setFillColor(41, 128, 185);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text("LAPORAN EKSEKUTIF KAS AMARTA", 14, 25);
    doc.setFontSize(10);
    doc.text(`Periode Insight: ${insight.currentMonth.month} | Aktif: ${activeMembersCount} Rumah`, 14, 32);

    // --- SECTION 1: RINGKASAN KEUANGAN ---
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text("Rekap Keuangan Kas", 14, 50);
    
    doc.autoTable({
      startY: 55,
      theme: 'plain',
      body: [
        [`Pengeluaran ${insight.lastMonth.month}`, { content: format(insight.lastMonth.expenseTotal), styles: { textColor: [192, 57, 43], fontStyle: 'bold' } }],
        [`Sisa Saldo Kumulatif per ${insight.lastMonth.month}`, { content: format(insight.lastMonth.remaining), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }],
        [`Pemasukan ${insight.currentMonth.month} (${paidInLastPeriodCount} rumah) + Sisa Lalu`, format(insight.summary.currentIncomePlusLastRemaining)],
        [`Pengeluaran ${insight.currentMonth.month}`, { content: format(insight.currentMonth.expenseTotal), styles: { textColor: [192, 57, 43] } }],
        [`TOTAL SALDO SAAT INI`, { content: format(insight.summary.currentBalance), styles: { fontSize: 13, fontStyle: 'bold', textColor: [41, 128, 185] } }],
      ],
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: { 1: { halign: 'right' } }
    });

    // --- SECTION 2: STATISTIK KEPATUHAN ---
    let finalY = doc.lastAutoTable.finalY + 15;
    const kepatuhanPersen = ((paidInLastPeriodCount / activeMembersCount) * 100).toFixed(1);
    
    doc.setFontSize(12);
    doc.text("Statistik Kepatuhan Iuran Bulan Ini", 14, finalY);
    
    doc.autoTable({
      startY: finalY + 5,
      head: [['Total Rumah Aktif', 'Sudah Bayar', 'Belum Bayar', 'Persentase']],
      body: [[
        activeMembersCount, 
        paidInLastPeriodCount, 
        activeMembersCount - paidInLastPeriodCount,
        `${kepatuhanPersen}%`
      ]],
      theme: 'grid',
      headStyles: { fillColor: [52, 73, 94] },
      styles: { halign: 'center' }
    });

    // --- SECTION 3: DAFTAR TUNGGAKAN (PIUTANG) ---
    finalY = doc.lastAutoTable.finalY + 15;
    if (finalY > 230) { doc.addPage(); finalY = 20; }

    doc.setFontSize(12);
    doc.setTextColor(192, 57, 43); // Red
    doc.text("Daftar Detail Tunggakan Warga", 14, finalY);

    const unpaidRows = unpaidList.map(u => [
        u.house, 
        u.name, 
        u.jumlah, 
        { content: u.detail, styles: { fontSize: 7 } }
    ]);

    doc.autoTable({
      startY: finalY + 5,
      head: [['Rumah', 'Nama', 'Bulan', 'Detail Periode']],
      body: unpaidRows,
      headStyles: { fillColor: [192, 57, 43] },
      columnStyles: { 2: { halign: 'center' }, 3: { cellWidth: 80 } },
      styles: { fontSize: 9 }
    });

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Dicetak otomatis oleh Sistem Kas Amarta pada ${new Date().toLocaleString("id-ID")}`, 105, 285, { align: 'center' });
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