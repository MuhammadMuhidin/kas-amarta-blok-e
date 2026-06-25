import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { dbTable } from "@/lib/dbTable";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PENGADUAN_TABLE = dbTable("pengaduan");

function clean(value) {
  return String(value ?? "").trim();
}

export async function GET(req) {
  try {
    if (!(await isAdmin(req))) return unauthorized();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 10)));
    const offset = (page - 1) * limit;

    const supabase = getSupabaseAdmin();

    const [dataResult, countResult] = await Promise.all([
      supabase
        .from(PENGADUAN_TABLE)
        .select("id, nama, rumah, kritik, photo_url, status, ip_address, created_at, updated_at")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1),
      supabase
        .from(PENGADUAN_TABLE)
        .select("id", { count: "planned", head: true }),
    ]);

    if (dataResult.error) {
      console.error("COMPLAINTS LIST ERROR:", JSON.stringify(dataResult.error));
      const detail = dataResult.error.message || dataResult.error.code || dataResult.error.details || "Supabase query failed";
      return NextResponse.json({ error: "Gagal mengambil data pengaduan", detail }, { status: 500 });
    }

    const data = dataResult.data || [];
    const total = countResult.count || 0;
    const total_pages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      complaints: data || [],
      pagination: {
        page,
        limit,
        total,
        total_pages,
        next_offset: page < total_pages ? offset + limit : null,
      },
    });
  } catch (err) {
    console.error("COMPLAINTS LIST ERROR:", err);
    return NextResponse.json(
      { error: err.message || "Terjadi kesalahan" },
      { status: 500 },
    );
  }
}
