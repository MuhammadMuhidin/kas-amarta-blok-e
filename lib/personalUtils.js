export function sortPersonal(personal) {
  return [...personal].sort((a, b) =>
    a.house.localeCompare(b.house, undefined, {
      numeric: true,
    }),
  );
}

export function filterPersonal(personal, filter) {
  if (!filter) return personal;

  if (filter === "ACTIVE") {
    return personal.filter((p) => p.active === "Y");
  }

  if (filter === "INACTIVE") {
    return personal.filter((p) => p.active === "N");
  }

  if (filter === "TRASH_ACTIVE") {
    return personal.filter(
      (p) => p.active === "Y" && p.trash === "Y",
    );
  }

  if (filter === "TRASH_INACTIVE") {
    return personal.filter((p) => p.trash !== "Y");
  }

  return personal;
}

export function searchPersonal(personal, keyword) {
  const normalized = keyword.toLowerCase().trim();

  if (!normalized) return personal;

  return personal.filter((p) => {
    return (
      p.name?.toLowerCase().includes(normalized) ||
      p.house?.toLowerCase().includes(normalized)
    );
  });
}

export function calculatePersonalStats(personal) {
  return personal.reduce(
    (acc, p) => {
      if (p.active === "Y") acc.active += 1;
      else acc.inactive += 1;

      if (p.active === "Y" && p.trash === "Y") {
        acc.trashActive += 1;
      }

      if (p.active === "Y" && p.trash !== "Y") {
        acc.trashInactive += 1;
      }

      return acc;
    },
    {
      active: 0,
      inactive: 0,
      trashActive: 0,
      trashInactive: 0,
    },
  );
}
