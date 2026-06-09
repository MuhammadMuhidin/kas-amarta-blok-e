import { NextResponse } from "next/server";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  enforceRateLimit,
  RATE_LIMIT_SCOPES,
} from "@/lib/rateLimit";
import {
  createDepositBookings,
  listDepositRecords,
  processDepositAction,
} from "@/features/deposit/depositService";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!(await isAdmin(req))) {
    return unauthorized();
  }

  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const result = await listDepositRecords({ supabase, searchParams });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Gagal membaca booking payment" }, { status: 500 });
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
    const result = await createDepositBookings({ supabase, req, body });

    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal menyimpan booking payment" }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    if (!(await isAdmin(req))) {
      return unauthorized();
    }

    if (!validateCSRF(req)) {
      return NextResponse.json({ error: "Invalid CSRF" }, { status: 403 });
    }

    const body = await req.json();
    const { id, action } = body;

    if (!["PAY_NOW", "UPDATE_SNAPSHOT"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (action === "PAY_NOW") {
      const payNowLimit = await enforceRateLimit(
        req,
        RATE_LIMIT_SCOPES.depositPayNow,
        {
          identity: "session",
          targetId: id,
        },
      );

      if (payNowLimit) return payNowLimit;
    }

    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    const result = await processDepositAction({ supabase, req, body, today });

    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal memproses booking payment" }, { status: 500 });
  }
}
