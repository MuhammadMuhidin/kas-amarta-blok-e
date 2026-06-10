import {
  createAdminActivitiesQuery,
  fetchAdminActivities,
} from "@/features/activity/activityRepository";

const modules = new Set([
  "personal",
  "payment",
  "deposit",
  "cashflow",
  "trash",
  "session",
  "settings-app",
  "settings-auth",
  "settings-access-matrix",
]);

const severities = new Set([
  "info",
  "success",
  "warning",
  "error",
]);

function clean(value) {
  return String(value || "").trim().toLowerCase();
}

function numberParam(value, fallback) {
  const parsed = Number(value || fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dateParam(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function applyActivityFilters(query, { module, severity, dateFrom, dateTo, search }) {
  let nextQuery = query;

  if (modules.has(module)) nextQuery = nextQuery.eq("module", module);
  if (severities.has(severity)) nextQuery = nextQuery.eq("severity", severity);
  if (dateFrom) nextQuery = nextQuery.gte("created_at", `${dateFrom}T00:00:00.000Z`);
  if (dateTo) nextQuery = nextQuery.lte("created_at", `${dateTo}T23:59:59.999Z`);

  if (search) {
    const safe = search.replaceAll("%", "").replaceAll(",", "");
    const pattern = `%${safe}%`;

    nextQuery = nextQuery.or(
      `message.ilike.${pattern},actor.ilike.${pattern},module.ilike.${pattern},type.ilike.${pattern},ip.ilike.${pattern},location.ilike.${pattern},device_name.ilike.${pattern}`,
    );
  }

  return nextQuery;
}

export async function listAdminActivities(searchParams) {
  const module = clean(searchParams.get("module"));
  const severity = clean(searchParams.get("severity"));
  const search = String(searchParams.get("search") || "").trim();
  const sort = clean(searchParams.get("sort")) === "asc" ? "asc" : "desc";
  const dateFrom = dateParam(searchParams.get("from"));
  const dateTo = dateParam(searchParams.get("to"));
  const page = Math.max(numberParam(searchParams.get("page"), 1), 1);
  const limitRaw = numberParam(searchParams.get("limit"), 20);
  const limit = Math.min(Math.max(limitRaw, 5), 50);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const query = applyActivityFilters(createAdminActivitiesQuery(sort), {
    module,
    severity,
    dateFrom,
    dateTo,
    search,
  });
  const { data, count } = await fetchAdminActivities(query, from, to);

  return {
    ok: true,
    activities: data,
    pagination: {
      page,
      limit,
      total: count,
      total_pages: Math.max(Math.ceil(count / limit), 1),
    },
  };
}
