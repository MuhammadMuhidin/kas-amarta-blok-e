import { NextResponse } from "next/server";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  createPersonal,
  listPersonalRecords,
  updatePersonalFlag,
} from "@/features/personal/personalService";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!(await isAdmin(req))) {
    return unauthorized();
  }

  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const result = await listPersonalRecords({ supabase, searchParams });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Gagal membaca data warga" }, { status: 500 });
  }
}

export async function POST(req) {
  if (!(await isAdmin(req))) {
    return unauthorized();
  }

  if (!validateCSRF(req)) {
    return NextResponse.json({ error: "Invalid CSRF" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const supabase = getSupabaseAdmin();
    const result = await createPersonal({ supabase, req, body });

    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal menyimpan data warga" }, { status: 500 });
  }
}

export async function PATCH(req) {
  if (!(await isAdmin(req))) {
    return unauthorized();
  }

  if (!validateCSRF(req)) {
    return NextResponse.json({ error: "Invalid CSRF" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const supabase = getSupabaseAdmin();
    const result = await updatePersonalFlag({ supabase, req, body });

    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal mengubah data warga" }, { status: 500 });
  }
}
