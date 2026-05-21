export async function fetchPersonal() {
  const res = await fetch("/api/sheets/personal", {
    cache: "no-store",
    method: "GET",
  });

  return res.json();
}

export async function createPersonal(member, csrfToken) {
  return fetch("/api/sheets/personal", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify(member),
  });
}
