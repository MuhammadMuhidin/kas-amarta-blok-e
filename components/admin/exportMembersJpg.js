const DEFAULT_WIDTH = 1080;
const DEFAULT_MIN_HEIGHT = 1920;
const ROW_HEIGHT = 48;
const MIN_ROWS_PER_COLUMN = 20;

function money(value) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
}

function clean(value) {
  return String(value || "").trim();
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatPeriod(period) {
  if (!period || period === "-") return "-";

  const normalized = String(period).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(normalized)) return period;

  return new Date(`${normalized}-01`).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function fillRoundedRect(ctx, x, y, width, height, radius, fillStyle, strokeStyle = "", strokeWidth = 1) {
  drawRoundedRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = fillStyle;
  ctx.fill();

  if (strokeStyle) {
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = strokeStyle;
    ctx.stroke();
  }
}

function drawText(ctx, text, x, y, font, fillStyle, align = "left") {
  ctx.font = font;
  ctx.fillStyle = fillStyle;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.fillText(text, x, y);
}

function truncateText(ctx, value, maxWidth) {
  const text = clean(value) || "-";
  if (ctx.measureText(text).width <= maxWidth) return text;

  let next = text;
  while (next.length > 1 && ctx.measureText(`${next}…`).width > maxWidth) {
    next = next.slice(0, -1);
  }

  return `${next}…`;
}

function canvasToBlob(canvas, type = "image/jpeg", quality = 0.94) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Gagal membuat file JPG."));
    }, type, quality);
  });
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

async function shareOrDownloadBlob(blob, fileName, shareTitle) {
  const file = new File([blob], fileName, { type: "image/jpeg" });

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title: shareTitle,
      files: [file],
    });
    return "shared";
  }

  downloadBlob(blob, fileName);
  return "downloaded";
}

export async function shareMembersJpgReport({
  title = "PEMBAYARAN BULAN INI",
  subtitle = "AMARTA RESIDENCE 2 BLOK E",
  period = "",
  members = [],
  summaryItems = [],
  badgeText = "LAPORAN BULAN INI",
  listTitle = "Daftar Rumah",
  footerText = "Data otomatis dari Sistem Kas Amarta Residence Blok E",
  footerNote = "Hanya menampilkan data sesuai detail yang dipilih.",
  fileName = "laporan-pembayaran.jpg",
} = {}) {
  if (typeof document === "undefined") {
    throw new Error("Export JPG hanya tersedia di browser.");
  }

  const rowsPerColumn = Math.max(MIN_ROWS_PER_COLUMN, Math.ceil(members.length / 2));
  const dynamicHeight = 540 + 112 + rowsPerColumn * ROW_HEIGHT + 280;
  const width = DEFAULT_WIDTH;
  const height = Math.max(DEFAULT_MIN_HEIGHT, dynamicHeight);
  const margin = 54;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("Browser tidak mendukung canvas export.");

  canvas.width = width;
  canvas.height = height;

  const colors = {
    bg: "#f8fafc",
    surface: "#ffffff",
    primary: "#2563eb",
    text: "#0f172a",
    muted: "#64748b",
    border: "#e2e8f0",
    success: "#16a34a",
    successSoft: "#dcfce7",
    blueSoft: "#eff6ff",
    blueBorder: "#bfdbfe",
    row: "#f8fafc",
  };

  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, width, height);

  fillRoundedRect(ctx, margin, 52, width - margin * 2, 198, 34, colors.primary);
  drawText(ctx, title, width / 2, 88, "700 54px Arial, sans-serif", "#ffffff", "center");
  drawText(ctx, subtitle, width / 2, 158, "700 30px Arial, sans-serif", "#dbeafe", "center");
  drawText(ctx, `Periode: ${formatPeriod(period)}`, width / 2, 203, "400 28px Arial, sans-serif", "#eff6ff", "center");

  const normalizedSummary = summaryItems.length
    ? summaryItems
    : [
        ["Total Data", `${members.length} rumah`],
        ["Export", formatDate(new Date().toISOString())],
      ];
  const summaryTop = 290;
  const summaryHeight = Math.max(210, 70 + normalizedSummary.length * 43);
  const badgeTop = summaryTop + summaryHeight - 60;

  fillRoundedRect(ctx, margin, summaryTop, width - margin * 2, summaryHeight, 28, colors.surface, colors.border, 2);

  let summaryY = summaryTop + 28;
  normalizedSummary.forEach(([label, value]) => {
    drawText(ctx, label, margin + 34, summaryY, "400 28px Arial, sans-serif", colors.muted);
    drawText(ctx, value, width - margin - 34, summaryY, "700 28px Arial, sans-serif", colors.text, "right");
    summaryY += 43;
  });

  fillRoundedRect(ctx, width / 2 - 140, badgeTop, 280, 46, 23, colors.successSoft);
  drawText(ctx, badgeText, width / 2, badgeTop + 10, "700 22px Arial, sans-serif", colors.success, "center");

  const listTop = summaryTop + summaryHeight + 40;
  const listBottom = listTop + 112 + rowsPerColumn * ROW_HEIGHT + 72;

  fillRoundedRect(ctx, margin, listTop, width - margin * 2, listBottom - listTop, 28, colors.surface, colors.border, 2);
  drawText(ctx, listTitle, margin + 32, listTop + 28, "700 34px Arial, sans-serif", colors.text);
  drawText(ctx, `${members.length} data`, width - margin - 32, listTop + 34, "400 22px Arial, sans-serif", colors.muted, "right");

  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(margin + 30, listTop + 86);
  ctx.lineTo(width - margin - 30, listTop + 86);
  ctx.stroke();

  const columnGap = 26;
  const columnWidth = (width - margin * 2 - 60 - columnGap) / 2;
  const columnLeft = margin + 30;
  const columnRight = columnLeft + columnWidth + columnGap;
  const startY = listTop + 112;
  const firstColumnCount = Math.ceil(members.length / 2);

  function drawRow(index, member, x, y) {
    if (index % 2 === 1) {
      fillRoundedRect(ctx, x - 10, y - 8, columnWidth + 10, ROW_HEIGHT - 8, 14, colors.row);
    }

    drawText(ctx, `${String(index).padStart(2, "0")}.`, x, y, "700 25px Arial, sans-serif", colors.primary);
    drawText(ctx, clean(member.house) || "-", x + 62, y, "700 25px Arial, sans-serif", colors.text);
    ctx.font = "400 24px Arial, sans-serif";
    drawText(ctx, truncateText(ctx, clean(member.name) || "-", columnWidth - 210), x + 155, y + 1, "400 24px Arial, sans-serif", colors.muted);
    drawText(ctx, "✓", x + columnWidth - 18, y + 1, "700 25px Arial, sans-serif", colors.success, "right");
  }

  members.forEach((member, index) => {
    const rowNumber = index + 1;
    const inFirstColumn = index < firstColumnCount;
    const columnIndex = inFirstColumn ? index : index - firstColumnCount;
    const x = inFirstColumn ? columnLeft : columnRight;
    const y = startY + columnIndex * ROW_HEIGHT;

    drawRow(rowNumber, member, x, y);
  });

  const noteTop = listBottom + 35;
  fillRoundedRect(ctx, margin, noteTop, width - margin * 2, 105, 24, colors.blueSoft, colors.blueBorder, 2);
  drawText(ctx, footerText, width / 2, noteTop + 25, "400 24px Arial, sans-serif", colors.text, "center");
  drawText(ctx, footerNote, width / 2, noteTop + 61, "400 22px Arial, sans-serif", colors.muted, "center");
  drawText(ctx, fileName, width / 2, height - 50, "400 18px Arial, sans-serif", "#94a3b8", "center");

  const blob = await canvasToBlob(canvas);
  return shareOrDownloadBlob(blob, fileName, title);
}

export { money, formatDate, formatPeriod };
