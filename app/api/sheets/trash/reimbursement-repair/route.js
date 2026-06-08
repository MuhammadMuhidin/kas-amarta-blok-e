import { NextResponse } from "next/server";
import { dbTable } from "@/lib/dbTable";
import { generateId } from "@/lib/id";
import { recordAdminActivity } from "@/lib/adminActivity";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const PAYMENT_TABLE = dbTable("payment");
const CASHFLOW_TABLE = dbTable("cashflow");
const TRASH_TABLE = dbTable("trash");

function normalize(value) {
  return String(value || "").trim();
}

function formatPeriodLabel(period) {
  const normalized = normalize(period);
  const match = /^(\d{4})-(\d{2})$/.exec(normalized);

  if (!match) return normalized;

  const monthNames = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  const monthIndex = Number(match[2]) - 1;

  if (monthIndex < 0 || monthIndex >= monthNames.length) return normalized;

  return `${monthNames[monthIndex]} ${match[1]}`;
}

function buildTrashAdvanceRefId(personId, period) {
  return `TRASHADV-${normalize(personId)}-${normalize(period)}`;
}

function buildTrashReimbursementRefId(paymentId) {
  return `TRASHREIMB-${normalize(paymentId)}`;
}

function buildTrashReimbursementNote(house, period) {
  return `Pengembalian Talangan Iuran Sampah ${house} Periode ${formatPeriodLabel(period)}`;
}

export async function POST(req) {
  try {
    if (!(await isAdmin(req))) {
      return unauthorized();
    }

    if (!validateCSRF(req)) {
      return NextResponse.json({ error: "Invalid CSRF" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const paymentId = normalize(body.payment_id);

    if (!paymentId) {
      return NextResponse.json({ error: "Payment ID is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: paymentRows, error: paymentError } = await supabase
      .from(PAYMENT_TABLE)
      .select("id,person_id,person_house,person_name,period,amount,date")
      .eq("id", paymentId)
      .limit(1);

    if (paymentError) {
      return NextResponse.json({ error: paymentError.message || "Gagal membaca payment" }, { status: 500 });
    }

    const payment = paymentRows?.[0];

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const { data: trashRows, error: trashReadError } = await supabase
      .from(TRASH_TABLE)
      .select("id,payment_id,amount,date")
      .eq("payment_id", paymentId)
      .limit(1);

    if (trashReadError) {
      return NextResponse.json({ error: trashReadError.message || "Gagal membaca data sampah" }, { status: 500 });
    }

    if (!trashRows?.length) {
      return NextResponse.json({ error: "Trash record is required before reimbursement repair" }, { status: 400 });
    }

    const advancePaymentId = buildTrashAdvanceRefId(payment.person_id, payment.period);
    const reimbursementPaymentId = buildTrashReimbursementRefId(paymentId);

    const { data: advanceRows, error: advanceReadError } = await supabase
      .from(CASHFLOW_TABLE)
      .select("id,payment_id,type,amount,note,date")
      .eq("payment_id", advancePaymentId)
      .eq("type", "expense")
      .limit(1);

    if (advanceReadError) {
      return NextResponse.json({ error: advanceReadError.message || "Gagal membaca cashflow talangan sampah" }, { status: 500 });
    }

    const advance = advanceRows?.[0];

    if (!advance) {
      return NextResponse.json({ error: "Trash advance cashflow not found" }, { status: 404 });
    }

    const { data: reimbursementRows, error: reimbursementReadError } = await supabase
      .from(CASHFLOW_TABLE)
      .select("id,payment_id,type,amount,note,date")
      .eq("payment_id", reimbursementPaymentId)
      .limit(2);

    if (reimbursementReadError) {
      return NextResponse.json({ error: reimbursementReadError.message || "Gagal membaca cashflow pengembalian talangan sampah" }, { status: 500 });
    }

    if (reimbursementRows?.length) {
      return NextResponse.json({
        success: true,
        existing: true,
        cashflow_id: reimbursementRows[0].id,
      });
    }

    const amount = Number(advance.amount || 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid trash advance amount" }, { status: 400 });
    }

    const cashflowId = generateId("CSFLOW-");
    const date = normalize(payment.date) || new Date().toISOString().slice(0, 10);
    const note = buildTrashReimbursementNote(payment.person_house, payment.period);

    const { error: insertError } = await supabase.from(CASHFLOW_TABLE).insert({
      id: cashflowId,
      payment_id: reimbursementPaymentId,
      type: "income",
      amount,
      note,
      date,
      receipt_url: "",
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message || "Gagal menyimpan cashflow pengembalian talangan sampah" }, { status: 500 });
    }

    await recordAdminActivity(req, {
      type: "repair",
      module: "trash",
      severity: "success",
      message: `Repair trash reimbursement ${payment.person_house || "-"} ${payment.period || "-"}`,
      metadata: {
        cashflow_id: cashflowId,
        payment_id: paymentId,
        reimbursement_payment_id: reimbursementPaymentId,
        advance_payment_id: advancePaymentId,
        person_id: payment.person_id,
        house: payment.person_house,
        name: payment.person_name,
        period: payment.period,
        amount,
        date,
        note,
      },
    });

    return NextResponse.json({
      success: true,
      repaired: true,
      cashflow_id: cashflowId,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
