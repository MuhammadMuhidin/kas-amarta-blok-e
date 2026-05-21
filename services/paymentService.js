export async function fetchPayments() {
  const res = await fetch("/api/sheets/payment", {
    cache: "no-store",
    method: "GET",
  });

  return res.json();
}

export async function createPayment(payload, csrfToken) {
  return fetch("/api/sheets/payment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify(payload),
  });
}
