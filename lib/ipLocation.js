function clean(value) {
  return String(value || "").trim();
}

function decodeHeaderValue(value) {
  if (!value) return "";

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

const COUNTRY_ALPHA2 = {
  indonesia: "ID",
  singapore: "SG",
  malaysia: "MY",
  thailand: "TH",
  vietnam: "VN",
  philippines: "PH",
  japan: "JP",
  china: "CN",
  taiwan: "TW",
  korea: "KR",
  "south korea": "KR",
  australia: "AU",
  germany: "DE",
  france: "FR",
  italy: "IT",
  spain: "ES",
  netherlands: "NL",
  canada: "CA",
  mexico: "MX",
  brazil: "BR",
  india: "IN",
  russia: "RU",
  turkey: "TR",
  egypt: "EG",
  "united kingdom": "GB",
  britain: "GB",
  england: "GB",
  "united states": "US",
  usa: "US",
};

function normalizeCountry(country) {
  const value = clean(country);

  if (!value) return "";

  return COUNTRY_ALPHA2[value.toLowerCase()] || value.toUpperCase();
}

function formatLocation({ city, region, country } = {}) {
  const parts = [
    city,
    region,
    normalizeCountry(country),
  ]
    .map(clean)
    .filter(Boolean);

  return parts.length ? parts.join(", ") : "Unknown location";
}

function getLocationFromHeaders(req) {
  const city =
    decodeHeaderValue(req.headers.get("x-vercel-ip-city")) ||
    decodeHeaderValue(req.headers.get("cf-ipcity"));

  const region =
    decodeHeaderValue(req.headers.get("x-vercel-ip-country-region")) ||
    decodeHeaderValue(req.headers.get("cf-region"));

  const country =
    decodeHeaderValue(req.headers.get("x-vercel-ip-country")) ||
    decodeHeaderValue(req.headers.get("cf-ipcountry"));

  return formatLocation({ city, region, country });
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!res.ok) return null;

    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function lookupIpApiCo(ip) {
  const data = await fetchJson(
    `https://ipapi.co/${encodeURIComponent(ip)}/json/`,
  );

  if (!data || data?.error) return "Unknown location";

  return formatLocation({
    city: data?.city,
    region: data?.region,
    country: data?.country_name || data?.country,
  });
}

async function lookupIpWhoIs(ip) {
  const data = await fetchJson(
    `https://ipwho.is/${encodeURIComponent(ip)}`,
  );

  if (!data || data?.success === false) return "Unknown location";

  return formatLocation({
    city: data?.city,
    region: data?.region,
    country: data?.country,
  });
}

async function lookupIpApiCom(ip) {
  const data = await fetchJson(
    `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,regionName,city`,
  );

  if (!data || data?.status !== "success") return "Unknown location";

  return formatLocation({
    city: data?.city,
    region: data?.regionName,
    country: data?.country,
  });
}

export async function getLocationByIp(ip) {
  const cleanIp = clean(ip);

  if (!cleanIp) return "Unknown location";

  const lookups = [
    lookupIpApiCo,
    lookupIpWhoIs,
    lookupIpApiCom,
  ];

  for (const lookup of lookups) {
    const location = await lookup(cleanIp);

    if (location !== "Unknown location") {
      return location;
    }
  }

  return "Unknown location";
}

export async function getRequestLocation(req, ip) {
  const headerLocation = getLocationFromHeaders(req);

  if (headerLocation !== "Unknown location") {
    return headerLocation;
  }

  return getLocationByIp(ip);
}
