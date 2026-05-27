export function getCookieValue(name) {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}

export async function readJson(path) {
  const res = await fetch(path, { cache: "no-store" });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

export async function sendJson(path, method, body) {
  const res = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": getCookieValue("csrf_token"),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}
