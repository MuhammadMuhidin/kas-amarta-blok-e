import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const modules = new Set([
  "personal",
  "payment",
  "deposit",
  "cashflow",
  "trash",
  "session",
  "settings-app",
  "settings-auth",
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

export async function GET(req) {
  try {
    if (!(await isAdmin(req))) {
      return unauthorized();
    }

    const { searchParams } = new URL(req.url);
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

    let query = supabase
      .from("admin_activities")
      .select(
        "id,type,module,severity,message,metadata,actor,device_name,ip,location,created_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: sort === "asc" });

    if (modules.has(module)) query = query.eq("module", module);
    if (severities.has(severity)) query = query.eq("severity", severity);
    if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00.000Z`);
    if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59.999Z`);

    if (search) {
      const safe = search.replaceAll("%", "").replaceAll(",", "");
      const pattern = `%${safe}%`;

      query = query.or(
        `message.ilike.${pattern},actor.ilike.${pattern},module.ilike.${pattern},type.ilike.${pattern},ip.ilike.${pattern},location.ilike.${pattern},device_name.ilike.${pattern}`,
      );
    }

    const { data, error, count } = await query.range(from, to);

    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      activities: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.max(Math.ceil((count || 0) / limit), 1),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Gagal membaca activity audit" },
      { status: 500 },
    );
  }
}
