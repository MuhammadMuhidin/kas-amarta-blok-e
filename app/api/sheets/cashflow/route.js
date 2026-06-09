import { NextResponse } from "next/server";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  enforceRateLimit,
  RATE_LIMIT_SCOPES,
} from "@/lib/rateLimit";
import {
  createDirectCashflow,
  listCashflowRecords,
} from "@/features/cashflow/cashflowService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req) {
  if (!(await isAdmin(req))) {
    return unauthorized();
  }

  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const result = await listCashflowRecords({ supabase, searchParams });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Gagal membaca cashflow" }, { status: 500 });
  }
}

export async function POST(req) {
  if (!(await isAdmin(req))) {
    return unauthorized();
  }

  if (!validateCSRF(req)) {
    return NextResponse.json({ error: "Invalid CSRF" }, { status: 403 });
  }

  const cashflowLimit = await enforceRateLimit(
    req,
    RATE_LIMIT_SCOPES.cashflowCreate,
    { identity: "session" },
  );

  if (cashflowLimit) return cashflowLimit;

  try {
    const supabase = getSupabaseAdmin();
    const contentType = req.headers.get("content-type") || "";
    const isMultipart = contentType.includes("multipart/form-data");
    const body = isMultipart ? await req.formData() : await req.json();
    const result = await createDirectCashflow({ supabase, req, body, isMultipart });

    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal menyimpan cashflow" }, { status: 500 });
  }
}
