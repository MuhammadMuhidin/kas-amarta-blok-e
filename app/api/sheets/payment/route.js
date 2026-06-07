import { NextResponse } from "next/server";
import { dbTable } from "@/lib/dbTable";
import { generateId } from "@/lib/id";
import { getAppConfig } from "@/lib/appConfig";
import { recordAdminActivity } from "@/lib/adminActivity";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  enforceRateLimit,
  RATE_LIMIT_SCOPES,
} from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const PERSONAL_TABLE = dbTable("personal");
const PAYMENT_TABLE = dbTable("payment");
const CASHFLOW_TABLE = dbTable("cashflow");
const TRASH_TABLE = dbTable("trash");

function normalize(value) {
  return String(value || "").trim();
}

function mapPayment(row) {
  return {
    id: row.id,
    person_id: row.person_id,
    person_house: row.person_house,
    person_name: row.person_name,
    period: row.period,
    amount: Number(row.amount) || 0,
    date: row.date,
  };
}

async function ensurePaymentCashflow({ supabase, paymentId, personHouse, period, amount, date }) {
  const { data: existingRows, error: readError } = await supabase
    .from(CASHFLOW_TABLE)
    .select("id")
    .eq("payment_id", paymentId)
    .limit(1);

  if (readError) throw new Error(readError.message || "Gagal membaca cashflow");
  if (existingRows?.length) return false;

  const note = `Pembayaran Kas ${personHouse} Periode ${period}`;
  const { error } = await supabase.from(CASHFLOW_TABLE).insert({
    id: generateId("CSFLOW-"),
    payment_id: paymentId,
    type: "income",
    amount,
    note,
    date,
    receipt_url: "",
  });

  if (error) throw new Error(error.message || "Gagal menyimpan cashflow");
  return true;
}

async function ensurePaymentTrash({ supabase, paymentId, member, date }) {
  const isTrashUser = normalize(member?.trash).toUpperCase() === "Y";

  if (!isTrashUser) return false;

  const appConfig = await getAppConfig();
  const trashAmount = Number(appConfig?.trash_fee || 0);

  if (!trashAmount) {
    throw new Error("Tarif sampah belum dikonfigurasi.");
  }

  const { data: existingRows, error: readError } = await supabase
    .from(TRASH_TABLE)
    .select("id")
    .eq("payment_id", paymentId)
    .limit(1);

  if (readError) throw new Error(readError.message || "Gagal membaca data sampah");
  if (existingRows?.length) return false;

  const { error } = await supabase.from(TRASH_TABLE).insert({
    id: generateId("TRASH-"),
    payment_id: paymentId,
    amount: trashAmount,
    date,
  });

  if (error) throw new Error(error.message || "Gagal menyimpan data sampah");
  return true;
}

export async function GET(req) {
  if (!(await isAdmin(req))) {
    return unauthorized();
  }

  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await supabase
    .from(PAYMENT_TABLE)
    .select("id,person_id,person_house,person_name,period,amount,date");

  if (error) {
    return NextResponse.json({ error: "Gagal membaca payment" }, { status: 500 });
  }

  return NextResponse.json((rows || []).map(mapPayment));
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
    const today = new Date().toISOString().slice(0, 10);

    const { data: memberRows, error: memberError } = await supabase
      .from(PERSONAL_TABLE)
      .select("id,house,name,trash,active,join_date")
      .eq("house", house)
      .limit(1);

    if (memberError) {
      return NextResponse.json({ error: memberError.message || "Gagal membaca data warga" }, { status: 500 });
    }

    const member = memberRows?.[0];

    if (!member) {
      return NextResponse.json({ error: "House not found" }, { status: 404 });
    }

    const person_id = member.id;
    const person_house = member.house;
    const person_name = member.name;

    const { data: paymentRows, error: paymentError } = await supabase
      .from(PAYMENT_TABLE)
      .select("id,person_id,person_house,person_name,period,amount,date")
      .eq("period", period);

    if (paymentError) {
      return NextResponse.json({ error: paymentError.message || "Gagal membaca payment" }, { status: 500 });
    }

    const existingPayment = (paymentRows || []).find((item) => {
      const samePerson = normalize(item.person_id) === normalize(person_id);
      const sameHouse = normalize(item.person_house) === normalize(person_house);
      return samePerson || sameHouse;
    });

    if (existingPayment) {
      const existingPaymentId = existingPayment.id;
      const existingPaymentAmount = Number(existingPayment.amount) || amount;
      const existingPaymentDate = existingPayment.date || today;
      const cashflowRecovered = await ensurePaymentCashflow({
        supabase,
        paymentId: existingPaymentId,
        personHouse: existingPayment.person_house || person_house,
        period,
        amount: existingPaymentAmount,
        date: existingPaymentDate,
      });
      const trashRecovered = await ensurePaymentTrash({
        supabase,
        paymentId: existingPaymentId,
        member,
        date: existingPaymentDate,
      });

      await recordAdminActivity(req, {
        type: "idempotent",
        module: "payment",
        severity: "info",
        message: `Reuse existing payment ${person_house} ${period}`,
        metadata: {
          payment_id: existingPaymentId,
          person_id,
          house: person_house,
          name: person_name,
          period,
          amount: existingPaymentAmount,
          cashflow_recovered: cashflowRecovered,
          trash_recovered: trashRecovered,
          bulk_batch_id: bulkBatchId || null,
        },
      });

      return NextResponse.json({
        success: true,
        existing: true,
        cashflow_recovered: cashflowRecovered,
        trash_recovered: trashRecovered,
        payment_id: existingPaymentId,
      });
    }

    const paymentId = generateId("PAY-");

    const { error: insertError } = await supabase.from(PAYMENT_TABLE).insert({
      id: paymentId,
      person_id,
      person_house,
      person_name,
      period,
      amount,
      date: today,
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message || "Gagal menyimpan payment" }, { status: 500 });
    }

    const cashflowRecorded = await ensurePaymentCashflow({
      supabase,
      paymentId,
      personHouse: person_house,
      period,
      amount,
      date: today,
    });
    const trashRecorded = await ensurePaymentTrash({ supabase, paymentId, member, date: today });

    await recordAdminActivity(req, {
      type: "create",
      module: "payment",
      severity: "success",
      message: `Record payment ${person_house} ${period}`,
      metadata: {
        payment_id: paymentId,
        person_id,
        house: person_house,
        name: person_name,
        period,
        amount,
        cashflow_recorded: cashflowRecorded,
        trash_recorded: trashRecorded,
        bulk_batch_id: bulkBatchId || null,
      },
    });

    return NextResponse.json({
      success: true,
      payment_id: paymentId,
      cashflow_recorded: cashflowRecorded,
      trash_recorded: trashRecorded,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal menyimpan payment" }, { status: 500 });
  }
}
