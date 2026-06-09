import { NextResponse } from "next/server";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  createTrashPayment,
  listTrashRecords,
} from "@/features/trash/trashService";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!(await isAdmin(req))) {
    return unauthorized();
  }

  try {
    const supabase = getSupabaseAdmin();
    const trashRecords = await listTrashRecords(supabase);

    return NextResponse.json(trashRecords);
  } catch {
    return NextResponse.json({ error: "Gagal membaca data sampah" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    if (!(await isAdmin(req))) {
      return unauthorized();
    }

    if (!validateCSRF(req)) {
      return NextResponse.json({ error: "Invalid CSRF" }, { status: 403 });
    }

    const body = await req.json();
    const supabase = getSupabaseAdmin();
    const result = await createTrashPayment({ supabase, req, body });

    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err.message,
      },
      {
        status: 500,
      },
    );
  }
}
