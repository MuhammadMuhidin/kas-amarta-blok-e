export function getR2PublicUrl(key) {
  const publicUrl = process.env.R2_PUBLIC_URL || process.env.CLOUDFLARE_R2_PUBLIC_URL;

  if (!publicUrl) {
    throw new Error("R2 public URL belum dikonfigurasi");
  }

  return `${publicUrl.replace(/\/$/, "")}/${key}`;
}

export function getReceiptPublicUrl(key) {
  return getR2PublicUrl(key);
}

function validateUploadedFile(file, {
  requiredMessage,
  maxSizeMessage,
  typeMessage,
  maxSize = 5 * 1024 * 1024,
  allowedTypes,
}) {
  if (!file || typeof file === "string" || file.size <= 0) {
    throw new Error(requiredMessage);
  }

  if (file.size > maxSize) {
    throw new Error(maxSizeMessage);
  }

  if (!allowedTypes.includes(file.type)) {
    throw new Error(typeMessage);
  }
}

export function validateReceiptFile(file) {
  validateUploadedFile(file, {
    requiredMessage: "Struk/nota wajib dilampirkan untuk expense",
    maxSizeMessage: "Ukuran file struk maksimal 5MB",
    typeMessage: "Format struk harus JPG, PNG, WEBP, atau PDF",
    allowedTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  });
}

export function validateActivityImageFile(file) {
  validateUploadedFile(file, {
    requiredMessage: "Foto kegiatan wajib dilampirkan",
    maxSizeMessage: "Ukuran foto kegiatan maksimal 5MB",
    typeMessage: "Format foto kegiatan harus JPG, PNG, atau WEBP",
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
  });
}
