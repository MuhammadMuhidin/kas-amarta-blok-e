import { NextResponse } from "next/server";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getJakartaDateString } from "@/lib/localDate";
import {
  enforceRateLimit,
  RATE_LIMIT_SCOPES,
} from "@/lib/rateLimit";
import {
  listPaymentRecords,
  recordPayment,
} from "@/features/payment/paymentService";

export const dynamic = "force-dynamic";

function normalize(value) {
  return String(value || "").trim();
}

export async function GET(req) {
  if (!(await isAdmin(req))) {
    return unauthorized();
  }

  try {
    const supabase = getSupabaseAdmin();
    const payments = await listPaymentRecords(supabase);

    return NextResponse.json(payments);
  } catch {
    return NextResponse.json({ error: "Gagal membaca payment" }, { status: 500 });
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
    const house = normalize(body.house);
    const period = normalize(body.period);
    const amount = Number(body.amount || 0);
    const bulkBatchId = normalize(body.bulk_batch_id);
    const bulkIndex = Number(body.bulk_index || 0);

    if (bulkBatchId) {
      if (bulkIndex === 0) {
        const bulkLimit = await enforceRateLimit(
          req,
          RATE_LIMIT_SCOPES.paymentBulkCreate,
          {
            identity: "session",
            targetId: `${period}:${bulkBatchId}`,
          },
        );

        if (bulkLimit) return bulkLimit;
      }
    } else {
      const paymentLimit = await enforceRateLimit(
        req,
        RATE_LIMIT_SCOPES.paymentCreate,
        {
          identity: "session",
          targetId: period,
        },
      );

      if (paymentLimit) return paymentLimit;
    }

    if (!house || !period || !amount) {
      return NextResponse.json(
        { error: "House, period, and amount are required" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    const today = getJakartaDateString();
    const result = await recordPayment({
      supabase,
      req,
      house,
      period,
      amount,
      bulkBatchId,
      today,
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal menyimpan payment" }, { status: 500 });
  }
}
