import { fetchBackupSummary } from "@/features/summaryBackup/summaryBackupRepository";

function numberParam(value, fallback) {
  const parsed = Number(value || fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function listBackupSummary(searchParams) {
  const page = Math.max(numberParam(searchParams.get("page"), 1), 1);
  const limitRaw = numberParam(searchParams.get("limit"), 10);
  const limit = Math.min(Math.max(limitRaw, 5), 50);
  const from = (page - 1) * limit;
  const to = from + limit;
  const rows = await fetchBackupSummary();
  const items = rows.slice(from, to);

  return {
    ok: true,
    summary: items,
    pagination: {
      page,
      limit,
      total: rows.length,
      total_pages: Math.max(Math.ceil(rows.length / limit), 1),
    },
  };
}
