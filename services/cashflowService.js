export async function fetchCashflows() {
  const res = await fetch("/api/sheets/cashflow", {
    cache: "no-store",
    method: "GET",
  });

  return res.json();
}

export async function createCashflow(payload, csrfToken) {
  return fetch("/api/sheets/cashflow", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify(payload),
  });
}
