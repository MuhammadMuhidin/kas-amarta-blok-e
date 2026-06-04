import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function numberParam(value, fallback) {
  const parsed = Number(value || fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(req) {
  if (!(await isAdmin(req))) {
    return unauthorized();
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(numberParam(searchParams.get("page"), 1), 1);
  const limitRaw = numberParam(searchParams.get("limit"), 10);
  const limit = Math.min(Math.max(limitRaw, 5), 50);
  const from = (page - 1) * limit;
  const to = from + limit;

  const { data, error } = await supabase.rpc("tracelog_backup_summary");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = Array.isArray(data) ? data : [];
  const items = rows.slice(from, to);

  return NextResponse.json({
    ok: true,
    summary: items,
    pagination: {
      page,
      limit,
      total: rows.length,
      total_pages: Math.max(Math.ceil(rows.length / limit), 1),
    },
  });
}
