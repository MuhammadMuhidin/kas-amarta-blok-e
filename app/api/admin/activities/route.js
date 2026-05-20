import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const modules = new Set([
  "personal",
  "payment",
  "deposit",
  "cashflow",
  "settings",
  "setting",
  "session",
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

export async function GET(req) {
  try {
    if (!(await isAdmin(req))) {
      return unauthorized();
    }

    const { searchParams } = new URL(req.url);
    const module = clean(searchParams.get("module"));
    const severity = clean(searchParams.get("severity"));
    const limitRaw = Number(searchParams.get("limit") || 100);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 200)
      : 100;

    let query = supabase
      .from("admin_activities")
      .select(
        "id,type,module,severity,message,metadata,actor,device_name,ip,location,created_at",
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(limit);

    if (modules.has(module)) {
      query = query.eq("module", module);
    }

    if (severities.has(severity)) {
      query = query.eq("severity", severity);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      activities: data || [],
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err.message || "Gagal membaca activity audit",
      },
      {
        status: 500,
      },
    );
  }
}
