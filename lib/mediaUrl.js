const MEDIA_KEY_PREFIXES = ["activity-images/", "cashflow-receipts/"];

export function normalizeMediaKey(key = "") {
  const value = String(key || "").trim().replace(/^\/+/, "");

  if (!value || value.includes("..") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) {
    return "";
  }

  return MEDIA_KEY_PREFIXES.some((prefix) => value.startsWith(prefix)) ? value : "";
}

export function buildMediaUrlFromKey(key = "") {
  const safeKey = normalizeMediaKey(key);

  if (!safeKey) return "";

  return `/api/media?key=${encodeURIComponent(safeKey)}`;
}

export function extractMediaKeyFromUrl(url = "") {
  const value = String(url || "").trim();

  if (!value) return "";

  const directKey = normalizeMediaKey(value);
  if (directKey) return directKey;

  try {
    const parsed = new URL(value, "https://amarta.local");
    const keyParam = parsed.searchParams.get("key");
    const keyFromParam = normalizeMediaKey(keyParam || "");

    if (keyFromParam) return keyFromParam;

    return normalizeMediaKey(decodeURIComponent(parsed.pathname.replace(/^\/+/, "")));
  } catch {
    return "";
  }
}

export function buildMediaUrlFromLegacyUrl(url = "") {
  const value = String(url || "").trim();
  const key = extractMediaKeyFromUrl(value);

  return key ? buildMediaUrlFromKey(key) : value;
}

export function withMediaImageUrl(image = {}) {
  if (!image || typeof image !== "object") return image;

  const mediaUrl = buildMediaUrlFromKey(image.image_key) || buildMediaUrlFromLegacyUrl(image.image_url);

  return {
    ...image,
    image_url: mediaUrl || image.image_url || "",
  };
}

export function withMediaPostUrls(post = {}) {
  if (!post || typeof post !== "object") return post;

  const images = Array.isArray(post.images) ? post.images.map(withMediaImageUrl) : post.images;
  const coverImageUrl = buildMediaUrlFromKey(post.cover_image_key) || buildMediaUrlFromLegacyUrl(post.cover_image_url);

  return {
    ...post,
    cover_image_url: coverImageUrl || post.cover_image_url || "",
    images,
  };
}

export function withMediaReceiptUrl(item = {}) {
  if (!item || typeof item !== "object") return item;

  return {
    ...item,
    receipt_url: buildMediaUrlFromLegacyUrl(item.receipt_url) || item.receipt_url || "",
  };
}
