const DEFAULT_WIDTH = 1080;
const DEFAULT_MIN_HEIGHT = 1200;
const DEFAULT_EXPORT_SCALE = 2;
const ROW_HEIGHT = 38;
const MIN_ROWS_PER_COLUMN = 20;

function money(value) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
}

function clean(value) {
  return String(value || "").trim();
}

function clampExportScale(value) {
  const scale = Number(value || DEFAULT_EXPORT_SCALE);

  if (!Number.isFinite(scale)) return DEFAULT_EXPORT_SCALE;

  return Math.min(Math.max(scale, 1), 3);
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatPeriod(period) {
  if (!period || period === "-") return "-";

  const normalized = String(period).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(normalized)) return period;

  return new Date(`${normalized}-01`).toLocaleDateString("en-US", {
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

function drawCenteredText(ctx, text, x, y, font, fillStyle) {
  ctx.font = font;
  ctx.fillStyle = fillStyle;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
  ctx.textBaseline = "top";
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

function canvasToBlob(canvas, type = "image/jpeg", quality = 0.98) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to create JPG file."));
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
  title = "This Month Payment",
  subtitle = "AMARTA RESIDENCE 2 BLOK E",
  period = "",
  members = [],
  summaryItems = [],
  badgeText = "PAID",
  listTitle = "House List",
  noteText = "The following houses match the selected payment status for this period.",
  footerText = "Automatic data from the Amarta Residence Block E Cash System.",
  footerNote = "If any data is inaccurate, please confirm with the cash admin.",
  fileName = "payment-report.jpg",
  exportScale = DEFAULT_EXPORT_SCALE,
} = {}) {
  if (typeof document === "undefined") {
    throw new Error("JPG export is only available in the browser.");
  }

  const scale = clampExportScale(exportScale);
  const hasStatusColumn = members.some((member) => clean(member.status || member.statusText));
  const rowsPerColumn = Math.max(MIN_ROWS_PER_COLUMN, Math.ceil(members.length / 2));
  const width = DEFAULT_WIDTH;
  const dynamicHeight = 44 + 180 + 27 + 115 + 17 + 52 + 84 + 38 + rowsPerColumn * ROW_HEIGHT + 32 + 135 + 80;
  const height = Math.max(DEFAULT_MIN_HEIGHT, dynamicHeight);
  const margin = 44;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("Browser does not support canvas export.");

  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const colors = {
    bg: "#f5f7fa",
    surface: "#ffffff",
    text: "#111827",
    muted: "#4b5563",
    soft: "#6b7280",
    border: "#d1d5db",
    row: "#f9fafb",
    green: "#168044",
    greenDark: "#14532d",
    greenSoft: "#dcfce7",
    greenPanel: "#f4fdf7",
    greenBorder: "#bbf7d0",
    blue: "#2563eb",
    red: "#dc2626",
    orange: "#d97706",
    note: "#fef9c3",
    noteBorder: "#facc15",
  };

  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, width, height);

  const cardX = margin;
  const cardY = margin;
  const cardW = width - margin * 2;
  const cardH = height - margin * 2;

  fillRoundedRect(ctx, cardX, cardY, cardW, cardH, 23, colors.surface, colors.border, 1.5);

  const headerH = 180;
  fillRoundedRect(ctx, cardX, cardY, cardW, headerH, 23, colors.green);
  ctx.fillStyle = colors.green;
  ctx.fillRect(cardX, cardY + headerH - 23, cardW, 23);

  drawText(ctx, subtitle, cardX + 39, cardY + 31, "700 21px Arial, sans-serif", colors.greenSoft);
  drawText(ctx, title, cardX + 39, cardY + 64, "700 43px Arial, sans-serif", "#ffffff");
  drawText(ctx, `Period ${formatPeriod(period)}`, cardX + 40, cardY + 119, "400 23px Arial, sans-serif", "#ecfdf5");

  const badgeLabel = clean(badgeText) || "PAID";
  const badgeFont = "700 23px Arial, sans-serif";
  ctx.font = badgeFont;
  const pillW = Math.max(165, Math.ceil(ctx.measureText(badgeLabel).width + 52));
  const pillH = 42;
  const pillX = cardX + cardW - pillW - 39;
  const pillY = cardY + 43;
  fillRoundedRect(ctx, pillX, pillY, pillW, pillH, 21, "#ffffff");
  drawCenteredText(ctx, badgeLabel, pillX + pillW / 2, pillY + pillH / 2, badgeFont, colors.greenDark);
  drawText(ctx, `Export: ${formatDate(new Date().toISOString())}`, cardX + cardW - 39, cardY + 113, "400 18px Arial, sans-serif", colors.greenSoft, "right");

  const normalizedSummary = summaryItems.length
    ? summaryItems
    : [
        ["Recorded", `${members.length} houses`, "Selected data"],
        ["Export", formatDate(new Date().toISOString()), "Export date"],
      ];
  const summaryTop = cardY + headerH + 27;
  const summaryGap = 13;
  const summaryH = 115;
  const summaryW = (cardW - 78 - summaryGap * 2) / 3;

  normalizedSummary.slice(0, 3).forEach(([label, value, description], index) => {
    const x = cardX + 39 + index * (summaryW + summaryGap);
    fillRoundedRect(ctx, x, summaryTop, summaryW, summaryH, 14, colors.greenPanel, colors.greenBorder, 1);
    drawText(ctx, label, x + 17, summaryTop + 16, "700 18px Arial, sans-serif", colors.greenDark);
    drawText(ctx, value, x + 17, summaryTop + 45, index === 1 ? "700 26px Arial, sans-serif" : "700 29px Arial, sans-serif", colors.text);
    drawText(ctx, description || "", x + 17, summaryTop + 83, "400 16px Arial, sans-serif", colors.muted);
  });

  const noteTop = summaryTop + summaryH + 17;
  fillRoundedRect(ctx, cardX + 39, noteTop, cardW - 78, 52, 13, colors.note, colors.noteBorder, 1);
  drawText(ctx, "Note:", cardX + 56, noteTop + 15, "700 17.5px Arial, sans-serif", colors.text);
  drawText(ctx, noteText, cardX + 126, noteTop + 15, "400 17.5px Arial, sans-serif", colors.text);

  const listTop = noteTop + 84;
  drawText(ctx, listTitle, cardX + 39, listTop, "700 26px Arial, sans-serif", colors.text);
  drawText(ctx, `${members.length} houses`, cardX + cardW - 39, listTop + 5, "400 18px Arial, sans-serif", colors.muted, "right");

  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cardX + 39, listTop + 38);
  ctx.lineTo(cardX + cardW - 39, listTop + 38);
  ctx.stroke();

  const columnGap = 29;
  const columnWidth = (cardW - 78 - columnGap) / 2;
  const columnLeft = cardX + 39;
  const columnRight = columnLeft + columnWidth + columnGap;
  const tableHeaderY = listTop + 56;
  const firstColumnCount = Math.ceil(members.length / 2);

  function getStatusX(x) {
    return x + columnWidth - 112;
  }

  function drawTableHeader(x, y) {
    const statusX = getStatusX(x);

    drawText(ctx, "NO", x, y, "700 14.5px Arial, sans-serif", colors.soft);
    drawText(ctx, "HOUSE", x + 45, y, "700 14.5px Arial, sans-serif", colors.soft);
    drawText(ctx, "NAME", x + 121, y, "700 14.5px Arial, sans-serif", colors.soft);
    if (hasStatusColumn) {
      drawText(ctx, "STATUS", statusX, y, "700 14.5px Arial, sans-serif", colors.soft, "left");
    }

    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + 24);
    ctx.lineTo(x + columnWidth, y + 24);
    ctx.stroke();
  }

  drawTableHeader(columnLeft, tableHeaderY);
  drawTableHeader(columnRight, tableHeaderY);

  function drawRow(index, member, x, y) {
    if (index % 2 === 1) {
      fillRoundedRect(ctx, x - 7, y - 5, columnWidth + 7, ROW_HEIGHT - 5, 9, colors.row);
    }

    const status = clean(member.status || member.statusText);
    const statusColor = status === "Paid" ? colors.green : status === "Advanced" ? colors.red : colors.orange;
    const statusX = getStatusX(x);
    const nameMaxWidth = hasStatusColumn ? statusX - (x + 121) - 10 : columnWidth - 175;

    drawText(ctx, String(index).padStart(2, "0"), x, y + 1, "700 19px Arial, sans-serif", colors.blue);
    drawText(ctx, clean(member.house) || "-", x + 45, y - 2, "700 23.5px Arial, sans-serif", colors.text);
    drawText(ctx, truncateText(ctx, clean(member.name) || "-", nameMaxWidth), x + 121, y + 2, "400 20px Arial, sans-serif", colors.muted);

    if (hasStatusColumn) {
      drawText(ctx, status || "-", statusX, y + 2, "700 17px Arial, sans-serif", statusColor, "left");
    }
  }

  const rowsY = tableHeaderY + 38;
  members.forEach((member, index) => {
    const rowNumber = index + 1;
    const inFirstColumn = index < firstColumnCount;
    const columnIndex = inFirstColumn ? index : index - firstColumnCount;
    const x = inFirstColumn ? columnLeft : columnRight;
    const y = rowsY + columnIndex * ROW_HEIGHT;

    drawRow(rowNumber, member, x, y);
  });

  const footerTop = cardY + cardH - 135;
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cardX + 39, footerTop);
  ctx.lineTo(cardX + cardW - 39, footerTop);
  ctx.stroke();

  fillRoundedRect(ctx, cardX + 39, footerTop + 22, cardW - 78, 85, 13, colors.row, colors.border, 1);
  drawText(ctx, footerText, cardX + 56, footerTop + 37, "700 17.5px Arial, sans-serif", colors.text);
  drawText(ctx, footerNote, cardX + 56, footerTop + 59, "400 16px Arial, sans-serif", colors.muted);
  drawText(ctx, fileName, cardX + cardW - 56, footerTop + 54, "400 14px Arial, sans-serif", colors.soft, "right");

  const blob = await canvasToBlob(canvas);
  return shareOrDownloadBlob(blob, fileName, title);
}

export { money, formatDate, formatPeriod };
