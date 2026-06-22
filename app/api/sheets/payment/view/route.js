import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getCurrentPeriod } from "@/lib/depositUtils";
import { listPayments } from "@/features/payment/paymentRepository";
import { listActiveMembers } from "@/features/personal/personalRepository";

export const dynamic = "force-dynamic";

function normalize(value) {
  return String(value || "").trim();
}

function numberParam(value, fallback) {
  const parsed = Number(value || fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(req) {
  if (!(await isAdmin(req))) {
    return unauthorized();
  }

  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const status = normalize(searchParams.get("status") || "all");
    const period = normalize(searchParams.get("period") || "") || getCurrentPeriod();
    const page = Math.max(numberParam(searchParams.get("page"), 1), 1);
    const limitRaw = numberParam(searchParams.get("limit"), 15);
    const limit = Math.min(Math.max(limitRaw, 5), 50);
    const from = (page - 1) * limit;
    const to = from + limit;

    const [payments, members] = await Promise.all([
      listPayments(supabase),
      listActiveMembers(supabase),
    ]);

    const paidKeys = new Set(
      payments
        .filter((p) => String(p.period || "").slice(0, 7) === period)
        .map((p) => normalize(p.person_house || p.house || p.person_id)),
    );

    const withStatus = members.map((person) => ({
      ...person,
      paymentStatus: paidKeys.has(normalize(person.house)) || paidKeys.has(normalize(person.id))
        ? "Paid"
        : "Unpaid",
    }));

    let filtered = withStatus;
    if (status === "paid") {
      filtered = withStatus.filter((p) => p.paymentStatus === "Paid");
    } else if (status === "unpaid") {
      filtered = withStatus.filter((p) => p.paymentStatus === "Unpaid");
    }

    filtered.sort((a, b) => normalize(a.house).localeCompare(
      normalize(b.house),
      "id-ID",
      { numeric: true },
    ));

    const total = filtered.length;
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const items = filtered.slice(from, to);

    return NextResponse.json({
      ok: true,
      members: items,
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Gagal membaca data payment" },
      { status: 500 },
    );
  }
}
