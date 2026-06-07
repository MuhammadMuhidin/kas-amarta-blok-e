import { NextResponse } from "next/server";
import { dbTable } from "@/lib/dbTable";
import { generateId } from "@/lib/id";
import { getAppConfig } from "@/lib/appConfig";
import { recordAdminActivity } from "@/lib/adminActivity";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const PERSONAL_TABLE = dbTable("personal");
const PAYMENT_TABLE = dbTable("payment");
const TRASH_TABLE = dbTable("trash");

function normalize(value) {
  return String(value || "").trim();
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

    const { data: memberRows, error: memberError } = await supabase
      .from(PERSONAL_TABLE)
      .select("id,house,name,trash,active,join_date")
      .eq("id", payment.person_id)
      .limit(1);

    if (memberError) {
      return NextResponse.json({ error: memberError.message || "Gagal membaca data warga" }, { status: 500 });
    }

    const member = memberRows?.[0];

    if (!member) {
      return NextResponse.json({ error: "Payment person not found" }, { status: 404 });
    }

    if (normalize(member.trash).toUpperCase() !== "Y") {
      return NextResponse.json({ error: "Person is not registered for trash payment" }, { status: 400 });
    }

    const { data: existingTrashRows, error: trashReadError } = await supabase
      .from(TRASH_TABLE)
      .select("id,payment_id,amount,date")
      .eq("payment_id", paymentId)
      .limit(1);

    if (trashReadError) {
      return NextResponse.json({ error: trashReadError.message || "Gagal membaca data sampah" }, { status: 500 });
    }

    const existingTrash = existingTrashRows?.[0];

    if (existingTrash) {
      return NextResponse.json({
        success: true,
        existing: true,
        trash_id: existingTrash.id,
      });
    }

    const appConfig = await getAppConfig();
    const trashAmount = Number(appConfig?.trash_fee || 0);

    if (!trashAmount) {
      return NextResponse.json({ error: "Tarif sampah belum dikonfigurasi" }, { status: 400 });
    }

    const trashId = generateId("TRASH-");
    const date = normalize(payment.date) || new Date().toISOString().slice(0, 10);

    const { error: insertError } = await supabase.from(TRASH_TABLE).insert({
      id: trashId,
      payment_id: paymentId,
      amount: trashAmount,
      date,
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message || "Gagal menyimpan data sampah" }, { status: 500 });
    }

    await recordAdminActivity(req, {
      type: "repair",
      module: "trash",
      severity: "success",
      message: `Repair missing trash record ${payment.person_house || "-"} ${payment.period || "-"}`,
      metadata: {
        trash_id: trashId,
        payment_id: paymentId,
        person_id: payment.person_id,
        house: payment.person_house,
        name: payment.person_name,
        period: payment.period,
        amount: trashAmount,
        date,
      },
    });

    return NextResponse.json({
      success: true,
      repaired: true,
      trash_id: trashId,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
