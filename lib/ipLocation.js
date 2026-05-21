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

function formatLocation({ city, region, country } = {}) {
  const parts = [city, region, country]
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

export async function getLocationByIp(ip) {
  const cleanIp = clean(ip);

  if (!cleanIp) return "Unknown location";

  try {
    const res = await fetch(
      `https://ipapi.co/${encodeURIComponent(cleanIp)}/json/`,
      {
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    if (!res.ok) return "Unknown location";

    const data = await res.json();

    if (data?.error) return "Unknown location";

    return formatLocation({
      city: data?.city,
      region: data?.region,
      country: data?.country_name || data?.country,
    });
  } catch (err) {
    console.error("Failed lookup IP location:", err.message);
    return "Unknown location";
  }
}

export async function getRequestLocation(req, ip) {
  const headerLocation = getLocationFromHeaders(req);

  if (headerLocation !== "Unknown location") {
    return headerLocation;
  }

  return getLocationByIp(ip);
}
