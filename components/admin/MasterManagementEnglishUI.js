"use client";

import { useEffect } from "react";

const EXACT = new Map([
  ["Informasi", "Information"],
  ["Pembayaran", "Payment"],
  ["Publikasi", "Publish"],
  ["Teks", "Text"],
  ["Teks panjang", "Long text"],
  ["Nomor", "Number"],
  ["Nominal uang", "Currency amount"],
  ["Tanggal", "Date"],
  ["Pilihan dropdown", "Dropdown"],
  ["Pilihan radio", "Radio buttons"],
  ["Ya / Tidak", "Yes / No"],
  ["Upload gambar", "Image upload"],
  ["Upload dokumen", "Document upload"],
  ["Persetujuan", "Approval"],
  ["Persetujuan akhir", "Final approval"],
  ["Validasi pembayaran", "Payment validation"],
  ["Pemeriksaan dokumen", "Document review"],
  ["Konfirmasi pelaksanaan", "Execution confirmation"],
  ["Aktif", "Active"],
  ["Diarsipkan", "Archived"],
  ["Ketua", "Chairperson"],
  ["Sekretaris", "Secretary"],
  ["Bendahara", "Treasurer"],
  ["Sarana & Prasarana", "Facilities"],
  ["Persetujuan sederhana", "Simple approval"],
  ["Pengajuan berbayar", "Paid request"],
  ["Administrasi", "Administration"],
  ["Sarana dan prasarana", "Facilities"],
  ["Tanpa approval", "No approval"],
  ["Ketua memberi persetujuan akhir.", "The chairperson gives final approval."],
  ["Bendahara memvalidasi pembayaran lalu Ketua menyetujui.", "The treasurer validates payment, then the chairperson approves."],
  ["Sekretaris memeriksa dokumen lalu Ketua menyetujui.", "The secretary reviews the document, then the chairperson approves."],
  ["Sapras memeriksa kebutuhan lalu Ketua menyetujui.", "Facilities reviews the request, then the chairperson approves."],
  ["Pengajuan langsung selesai setelah dikirim.", "The request is completed immediately after submission."],
  ["Buat form, lampiran, alur approval, dan versi konfigurasi tanpa mengetik JSON.", "Build forms, attachments, approval flows, and configuration versions without writing JSON."],
  ["+ Buat Pengajuan", "+ Create Request"],
  ["Duplikat", "Duplicate"],
  ["Buang Draft", "Discard Draft"],
  ["Arsipkan", "Archive"],
  ["Gratis", "Free"],
  ["Approval master tidak ditemukan.", "No approval master found."],
  ["Master Baru", "New Master"],
  ["Duplikasi Master", "Duplicate Master"],
  ["Pengajuan Baru", "New Request"],
  ["Tutup", "Close"],
  ["Informasi Dasar", "Basic Information"],
  ["Identitas Pengajuan", "Request Identity"],
  ["Informasi ini tampil pada daftar master dan halaman warga.", "This information appears in the master list and resident page."],
  ["Nama pengajuan", "Request name"],
  ["Kode sistem", "System code"],
  ["Buat otomatis", "Generate automatically"],
  ["Kategori", "Category"],
  ["Ikon", "Icon"],
  ["Warna", "Color"],
  ["Deskripsi", "Description"],
  ["Visual Form Builder", "Visual Form Builder"],
  ["Field Form Pengajuan", "Request Form Fields"],
  ["Susun field tanpa mengetik JSON. Nama sistem dibuat otomatis dan masih dapat disesuaikan.", "Arrange fields without writing JSON. System names are generated automatically and can still be adjusted."],
  ["+ Tambah Field", "+ Add Field"],
  ["Belum ada field. Tambahkan minimal satu field sebelum dipublikasikan.", "No fields yet. Add at least one field before publishing."],
  ["Tanpa label", "No label"],
  ["Label", "Label"],
  ["Nama sistem", "System name"],
  ["Jenis field", "Field type"],
  ["Batas ukuran (MB)", "Size limit (MB)"],
  ["Pilihan", "Options"],
  ["Format MIME yang diizinkan", "Allowed MIME types"],
  ["Pisahkan dengan koma. Gambar aman: image/jpeg,image/png,image/webp.", "Separate values with commas. Safe image types: image/jpeg,image/png,image/webp."],
  ["Wajib diisi", "Required"],
  ["Tampil di ringkasan", "Show in summary"],
  ["Visual Flow Builder", "Visual Flow Builder"],
  ["Alur Persetujuan", "Approval Flow"],
  ["Pilih template atau susun tahap sendiri menggunakan tombol naik dan turun.", "Choose a template or arrange the steps manually using the up and down buttons."],
  ["+ Tambah Tahap", "+ Add Step"],
  ["Tanpa tahap approval: pengajuan akan langsung berstatus selesai setelah dikirim.", "No approval steps: the request will be completed immediately after submission."],
  ["Penanggung jawab", "Responsible role"],
  ["Tindakan", "Action"],
  ["Nama tahap", "Step name"],
  ["Aturan Pembayaran", "Payment Rules"],
  ["Hubungkan pembayaran dengan tahap validasi tanpa mengatur JSON.", "Connect payment to a validation step without editing JSON."],
  ["Pengajuan memerlukan pembayaran", "This request requires payment"],
  ["Nominal pembayaran", "Payment amount"],
  ["Validator pembayaran", "Payment validator"],
  ["Instruksi pembayaran", "Payment instructions"],
  ["Tahap validasi pembayaran belum ada", "Payment validation step is missing"],
  ["Sistem menyarankan tahap ini berada paling awal.", "The system recommends placing this step first."],
  ["Tambahkan Otomatis", "Add Automatically"],
  ["✓ Tahap pertama sudah memvalidasi pembayaran.", "✓ The first step already validates payment."],
  ["Pengajuan akan ditampilkan sebagai tanpa biaya.", "The request will be displayed as free of charge."],
  ["Pengaturan Lanjutan · JSON", "Advanced Settings · JSON"],
  ["Gunakan hanya untuk kebutuhan teknis", "Use only for technical needs"],
  ["Builder visual tetap menjadi cara utama. JSON dapat merusak konfigurasi bila formatnya salah.", "The visual builder remains the primary method. Invalid JSON can damage the configuration."],
  ["Kunci JSON", "Lock JSON"],
  ["Aktifkan Edit JSON", "Enable JSON Editing"],
  ["Terapkan JSON ke Builder", "Apply JSON to Builder"],
  ["Belum ada versi yang pernah dipublikasikan.", "No version has been published yet."],
  ["Pulihkan sebagai Draft", "Restore as Draft"],
  ["Preview Langsung", "Live Preview"],
  ["Tampilan Warga dan Alur", "Resident View and Flow"],
  ["Preview memperlihatkan field biasa, pilihan, lampiran, dan tahapan sebelum dipublikasikan.", "Preview standard fields, options, attachments, and approval steps before publishing."],
  ["Biaya Pengajuan", "Request Fee"],
  ["Tanpa biaya", "Free"],
  ["Kirim Pengajuan", "Submit Request"],
  ["Preview Alur", "Flow Preview"],
  ["Pengajuan dibuat", "Request created"],
  ["Data diterima sistem", "Data received by the system"],
  ["Selesai", "Completed"],
  ["Setelah seluruh tahap diproses", "After all steps are processed"],
  ["Langsung selesai", "Completed immediately"],
  ["Validasi dan Publikasi", "Validation and Publishing"],
  ["Siap Dipublikasikan?", "Ready to Publish?"],
  ["Publish membuat revisi baru. Versi aktif sebelumnya otomatis masuk histori dan tetap dapat dipulihkan.", "Publishing creates a new revision. The previous active version is added to history and can still be restored."],
  ["Versi Aktif", "Active Version"],
  ["Belum ada", "None"],
  ["Belum disimpan", "Not saved"],
  ["Versi Berikutnya", "Next Version"],
  ["✓ Seluruh konfigurasi valid dan siap dipublikasikan.", "✓ All configuration is valid and ready to publish."],
  ["Simpan Draft", "Save Draft"],
  ["Menyimpan...", "Saving..."],
  ["Publikasikan Versi Baru", "Publish New Version"],
  ["Mempublikasikan...", "Publishing..."],
  ["Kembali", "Back"],
  ["Lanjut", "Next"],
  ["Riwayat versi", "Version history"],
  ["Versi awal", "Initial version"],
  ["Informasi", "Information"],
  ["Formulir", "Form"],
  ["Pembayaran", "Payment"],
  ["Tidak ada perubahan konfigurasi", "No configuration changes"],
  ["Lihat Versi Aktif", "View Active Version"],
  ["Preview Draft", "Preview Draft"],
  ["Periksa tampilan warga dan alur persetujuan tanpa mengubah konfigurasi.", "Review the resident view and approval flow without changing the configuration."],
  ["Alur Persetujuan", "Approval Flow"],
  ["Edit Draft", "Edit Draft"],
  ["Edit Master", "Edit Master"],
  ["Edit", "Edit"],
  ["Versi Aktif", "Active Version"],
  ["Belum dipublikasikan", "Not published"],
  ["Batal", "Cancel"],
  ["Memproses...", "Processing..."],
]);

const PLACEHOLDERS = new Map([
  ["Cari nama, kode, kategori, status, atau role...", "Search name, code, category, status, or role..."],
  ["Contoh: Izin Renovasi Rumah", "Example: Home Renovation Permit"],
  ["Perizinan", "Permits"],
  ["Jelaskan kegunaan dan persyaratan singkat pengajuan.", "Briefly explain the purpose and requirements of this request."],
  ["Satu pilihan per baris", "One option per line"],
  ["Transfer ke rekening kas warga dan tunggu validasi.", "Transfer to the residents' fund account and wait for validation."],
  ["Pilih salah satu", "Select one"],
]);

const TITLES = new Map([
  ["Naik", "Move up"],
  ["Turun", "Move down"],
  ["Duplikat", "Duplicate"],
  ["Hapus", "Delete"],
]);

function translateDynamic(text) {
  let match;

  match = text.match(/^Ada Draft v(\d+)$/);
  if (match) return `Draft v${match[1]} available`;

  match = text.match(/^(.+?) · (\d+) field · (\d+) tahap · Versi aktif (.+)$/);
  if (match) return `${match[1]} · ${match[2]} fields · ${match[3]} steps · Active version ${match[4]}`;

  match = text.match(/^Versi aktif (\d+)( · Draft (\d+))?\. Menyimpan draft tidak mengganggu warga\.$/);
  if (match) return `Active version ${match[1]}${match[3] ? ` · Draft ${match[3]}` : ""}. Saving a draft does not affect residents.`;

  if (text === "Belum pernah dipublikasikan.") return "Never published.";

  match = text.match(/^Riwayat versi · (\d+) versi$/);
  if (match) return `Version history · ${match[1]} versions`;

  match = text.match(/^Versi (\d+)$/);
  if (match) return `Version ${match[1]}`;

  match = text.match(/^Lihat perubahan dari Versi (\d+)$/);
  if (match) return `View changes from Version ${match[1]}`;

  match = text.match(/^(\d+) perubahan$/);
  if (match) return `${match[1]} changes`;

  match = text.match(/^Tidak ada perubahan konfigurasi dari Versi (\d+)\.$/);
  if (match) return `No configuration changes from Version ${match[1]}.`;

  match = text.match(/^(\d+) field · (\d+) tahap · Gratis$/);
  if (match) return `${match[1]} fields · ${match[2]} steps · Free`;

  match = text.match(/^Draft v(\d+) · Belum dipublikasikan$/);
  if (match) return `Draft v${match[1]} · Not published`;

  match = text.match(/^Versi Aktif v(\d+)$/);
  if (match) return `Active Version v${match[1]}`;

  match = text.match(/^Field (\d+)$/);
  if (match) return `Field ${match[1]}`;

  match = text.match(/^Tahap (\d+)$/);
  if (match) return `Step ${match[1]}`;

  match = text.match(/^Menambahkan field (.+) \((.+), wajib\)$/);
  if (match) return `Added field ${match[1]} (${match[2]}, required)`;

  match = text.match(/^Menambahkan field (.+) \((.+), opsional\)$/);
  if (match) return `Added field ${match[1]} (${match[2]}, optional)`;

  match = text.match(/^Menghapus field (.+)$/);
  if (match) return `Removed field ${match[1]}`;

  match = text.match(/^Memindahkan field (.+): urutan (\d+) → (\d+)$/);
  if (match) return `Moved field ${match[1]}: position ${match[2]} → ${match[3]}`;

  match = text.match(/^Menambahkan tahap (\d+): (.+)$/);
  if (match) return `Added step ${match[1]}: ${match[2]}`;

  match = text.match(/^Menghapus tahap (\d+): (.+)$/);
  if (match) return `Removed step ${match[1]}: ${match[2]}`;

  match = text.match(/^Tahap (\d+) · Nama: (.+)$/);
  if (match) return `Step ${match[1]} · Name: ${match[2]}`;

  match = text.match(/^Tahap (\d+) · Penanggung jawab: (.+)$/);
  if (match) return `Step ${match[1]} · Responsible role: ${match[2]}`;

  match = text.match(/^Tahap (\d+) · Tindakan: (.+)$/);
  if (match) return `Step ${match[1]} · Action: ${match[2]}`;

  match = text.match(/^Status pembayaran: (.+)$/);
  if (match) return `Payment status: ${match[1].replace("Berbayar", "Paid").replace("Gratis", "Free")}`;

  match = text.match(/^Nominal: (.+)$/);
  if (match) return `Amount: ${match[1]}`;

  match = text.match(/^Instruksi pembayaran: (.+)$/);
  if (match) return `Payment instructions: ${match[1]}`;

  return text;
}

function translateCore(text) {
  return EXACT.get(text) || translateDynamic(text);
}

function translateTextNode(node) {
  const value = node.nodeValue || "";
  const leading = value.match(/^\s*/)?.[0] || "";
  const trailing = value.match(/\s*$/)?.[0] || "";
  const core = value.trim();
  if (!core) return;
  const translated = translateCore(core);
  if (translated !== core) node.nodeValue = `${leading}${translated}${trailing}`;
}

function translateElement(element) {
  if (!(element instanceof Element)) return;

  if (element.hasAttribute("placeholder")) {
    const value = element.getAttribute("placeholder") || "";
    const translated = PLACEHOLDERS.get(value) || translateCore(value);
    if (translated !== value) element.setAttribute("placeholder", translated);
  }

  if (element.hasAttribute("title")) {
    const value = element.getAttribute("title") || "";
    const translated = TITLES.get(value) || translateCore(value);
    if (translated !== value) element.setAttribute("title", translated);
  }

  if (element.hasAttribute("aria-label")) {
    const value = element.getAttribute("aria-label") || "";
    const translated = translateCore(value);
    if (translated !== value) element.setAttribute("aria-label", translated);
  }
}

function translateTree(root) {
  if (!root) return;
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root);
    return;
  }

  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;

  if (root.nodeType === Node.ELEMENT_NODE) translateElement(root);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) translateTextNode(node);
    else translateElement(node);
    node = walker.nextNode();
  }
}

export default function MasterManagementEnglishUI() {
  useEffect(() => {
    let timer;

    function run() {
      const root = document.querySelector(".mm-root");
      if (!root) return;
      translateTree(root);
      document.querySelectorAll(".mm-ro-modal,.mm-version-diff,.mm-version-initial,.mm-version-no-change").forEach(translateTree);
    }

    function schedule() {
      clearTimeout(timer);
      timer = window.setTimeout(run, 20);
    }

    run();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label"],
    });

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  return null;
}
