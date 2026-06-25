import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { dbTable } from "@/lib/dbTable";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PENGADUAN_TABLE = dbTable("pengaduan");

const VALID_STATUSES = ["baru", "diproses", "selesai", "ditolak"];

export async function PATCH(req, { params }) {
  try {
    if (!(await isAdmin(req))) return unauthorized();

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID pengaduan wajib diisi" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const status = String(body.status || "").trim().toLowerCase();

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Status tidak valid. Valid: ${VALID_STATUSES.join(", ")}` },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from(PENGADUAN_TABLE)
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, status")
      .single();

    if (error) {
      console.error("COMPLAINTS UPDATE ERROR:", error);
      return NextResponse.json({ error: "Gagal mengubah status" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, complaint: data });
  } catch (err) {
    console.error("COMPLAINTS UPDATE ERROR:", err);
    return NextResponse.json(
      { error: err.message || "Terjadi kesalahan" },
      { status: 500 },
    );
  }
}
