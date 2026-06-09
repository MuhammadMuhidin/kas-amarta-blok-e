import { NextResponse } from "next/server";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  enforceRateLimit,
  RATE_LIMIT_SCOPES,
} from "@/lib/rateLimit";
import { advanceUnpaidTrash } from "@/features/trash/trashAdvanceService";

export const dynamic = "force-dynamic";

function normalize(value) {
  return String(value || "").trim();
}

export async function POST(req) {
  try {
    if (!(await isAdmin(req))) return unauthorized();
    if (!validateCSRF(req)) return NextResponse.json({ error: "Invalid CSRF" }, { status: 403 });

    const body = await req.json();
    const period = normalize(body.period);

    if (!/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json({ error: "Valid period is required" }, { status: 400 });
    }

    const rateLimit = await enforceRateLimit(req, RATE_LIMIT_SCOPES.cashflowCreate, { identity: "session", targetId: `trash-advance-${period}` });
    if (rateLimit) return rateLimit;

    const supabase = getSupabaseAdmin();
    const result = await advanceUnpaidTrash({ supabase, req, period });

    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
