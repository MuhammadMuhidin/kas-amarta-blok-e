export function getReceiptPublicUrl(key) {
  const publicUrl = process.env.R2_PUBLIC_URL || process.env.CLOUDFLARE_R2_PUBLIC_URL;

  if (!publicUrl) {
    throw new Error("R2 public URL belum dikonfigurasi");
  }

  return `${publicUrl.replace(/\/$/, "")}/${key}`;
}

export function validateReceiptFile(file) {
  if (!file || typeof file === "string" || file.size <= 0) {
    throw new Error("Struk/nota wajib dilampirkan untuk expense");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Ukuran file struk maksimal 5MB");
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

  if (!allowedTypes.includes(file.type)) {
    throw new Error("Format struk harus JPG, PNG, WEBP, atau PDF");
  }
}
