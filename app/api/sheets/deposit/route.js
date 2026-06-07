import { NextResponse } from "next/server";
import { dbTable } from "@/lib/dbTable";
import { generateId } from "@/lib/id";
import { getAppConfig } from "@/lib/appConfig";
import { recordAdminActivity } from "@/lib/adminActivity";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import {
  getCurrentPeriod,
  sortDeposits,
} from "@/lib/depositUtils";
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
const DEPOSIT_TABLE = dbTable("deposit");

function normalize(value) {
  return String(value || "").trim();
}

function numberParam(value, fallback) {
  const parsed = Number(value || fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapDeposit(row) {
  return {
    id: row.id,
    person_id: row.person_id,
    house: row.house,
    name: row.name,
    period: row.period,
    amount: Number(row.amount) || 0,
    trash_amount: Number(row.trash_amount) || 0,
    status: row.status,
    created_at: row.created_at,
    paid_at: row.paid_at || "",
    payment_id: row.payment_id || "",
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

async function ensureTrashPayment({ supabase, paymentId, trashAmount, date }) {
  if (trashAmount <= 0) return false;

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

async function findExistingPayment({ supabase, person_id, person_house, period }) {
  const { data: paymentRows, error } = await supabase
    .from(PAYMENT_TABLE)
    .select("id,person_id,person_house,person_name,period,amount,date")
    .eq("period", period);

  if (error) throw new Error(error.message || "Gagal membaca payment");

  return (paymentRows || []).find((item) => {
    const samePerson = normalize(item.person_id) === normalize(person_id);
    const sameHouse = normalize(item.person_house) === normalize(person_house);
    return samePerson || sameHouse;
  }) || null;
}

export async function GET(req) {
  if (!(await isAdmin(req))) {
    return unauthorized();
  }

  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await supabase
    .from(DEPOSIT_TABLE)
    .select("id,person_id,house,name,period,amount,trash_amount,status,created_at,paid_at,payment_id");

  if (error) {
    return NextResponse.json({ error: "Gagal membaca booking payment" }, { status: 500 });
  }

  const data = (rows || []).map(mapDeposit);
  const { searchParams } = new URL(req.url);
  const paginated = searchParams.has("page") || searchParams.has("limit");

  if (!paginated) {
    return NextResponse.json(data);
  }

  const page = Math.max(numberParam(searchParams.get("page"), 1), 1);
  const limitRaw = numberParam(searchParams.get("limit"), 10);
  const limit = Math.min(Math.max(limitRaw, 5), 50);
  const from = (page - 1) * limit;
  const to = from + limit;
  const sorted = sortDeposits(data, getCurrentPeriod(), normalize);

  return NextResponse.json({
    ok: true,
    deposits: sorted.slice(from, to),
    pagination: {
      page,
      limit,
      total: sorted.length,
      total_pages: Math.max(Math.ceil(sorted.length / limit), 1),
    },
  });
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
    const { person_id, house, name, periods, amount } = body;

    if (!person_id || !house || !name || !Array.isArray(periods)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { data: memberRows, error: memberError } = await supabase
      .from(PERSONAL_TABLE)
      .select("id,house,name,trash,active,join_date")
      .eq("id", person_id)
      .limit(1);

    if (memberError) {
      return NextResponse.json({ error: memberError.message || "Gagal membaca data warga" }, { status: 500 });
    }

    const member = memberRows?.[0];

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const appConfig = await getAppConfig();
    const isTrashUser = String(member.trash || "").toUpperCase() === "Y";
    const trashAmount = isTrashUser ? Number(appConfig?.trash_fee) || 0 : 0;

    const { data: existingRows, error: existingError } = await supabase
      .from(DEPOSIT_TABLE)
      .select("id,person_id,period,status")
      .eq("person_id", person_id)
      .in("period", periods);

    if (existingError) {
      return NextResponse.json({ error: existingError.message || "Gagal membaca booking payment" }, { status: 500 });
    }

    const existing = existingRows || [];
    const now = new Date().toISOString();
    const values = periods
      .filter((period) => {
        return !existing.some(
          (r) => r.person_id === person_id && r.period === period && r.status !== "cancelled",
        );
      })
      .map((period) => ({
        id: generateId("DEP-"),
        person_id,
        house,
        name,
        period,
        amount,
        trash_amount: trashAmount,
        status: "pending",
        created_at: now,
        paid_at: null,
        payment_id: null,
      }));

    if (values.length > 0) {
      const { error } = await supabase.from(DEPOSIT_TABLE).insert(values);
      if (error) {
        return NextResponse.json({ error: error.message || "Gagal menyimpan booking payment" }, { status: 500 });
      }
    }

    await recordAdminActivity(req, {
      type: "create",
      module: "deposit",
      severity: "success",
      message: `Save deposit ${house} ${values.length} period`,
      metadata: {
        person_id,
        house,
        name,
        periods,
        amount,
        trash_amount: trashAmount,
        inserted: values.length,
        deposit_ids: values.map((item) => item.id),
      },
    });

    return NextResponse.json({ success: true, inserted: values.length });
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
    const supabase = getSupabaseAdmin();
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

    const today = new Date().toISOString().slice(0, 10);

    const { data: depositRows, error: depositError } = await supabase
      .from(DEPOSIT_TABLE)
      .select("id,person_id,house,name,period,amount,trash_amount,status,created_at,paid_at,payment_id")
      .eq("id", id)
      .limit(1);

    if (depositError) {
      return NextResponse.json({ error: depositError.message || "Gagal membaca booking payment" }, { status: 500 });
    }

    const deposit = depositRows?.[0];

    if (!deposit) {
      return NextResponse.json({ error: "Deposit not found" }, { status: 404 });
    }

    const appConfig = await getAppConfig();
    const currentMonthlyFee = Number(appConfig?.monthly_fee) || 0;
    const currentTrashFee = Number(appConfig?.trash_fee) || 0;

    const { data: memberRows, error: memberError } = await supabase
      .from(PERSONAL_TABLE)
      .select("id,house,name,trash,active,join_date")
      .eq("id", deposit.person_id)
      .limit(1);

    if (memberError) {
      return NextResponse.json({ error: memberError.message || "Gagal membaca data warga" }, { status: 500 });
    }

    const member = memberRows?.[0];

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const isTrashUser = normalize(member.trash).toUpperCase() === "Y";

    function validateBookingAmount(amount, trashAmount) {
      if (amount !== currentMonthlyFee) {
        return `Kas booking Rp${amount.toLocaleString("id-ID")} berbeda dengan tarif aktif Rp${currentMonthlyFee.toLocaleString("id-ID")}`;
      }

      if (!isTrashUser && trashAmount > 0) {
        return "Warga ini tidak terdaftar iuran sampah, trash booking harus Rp0";
      }

      if (isTrashUser && trashAmount !== currentTrashFee) {
        return `Trash booking Rp${trashAmount.toLocaleString("id-ID")} berbeda dengan tarif aktif Rp${currentTrashFee.toLocaleString("id-ID")}`;
      }

      return "";
    }

    if (action === "UPDATE_SNAPSHOT") {
      if (!["pending", "waiting"].includes(String(deposit.status || ""))) {
        return NextResponse.json({ error: "Only active booking can be edited" }, { status: 400 });
      }

      const amount = Number(body.amount);
      const trashAmount = Number(body.trash_amount || 0);

      if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(trashAmount) || trashAmount < 0) {
        return NextResponse.json({ error: "Invalid booking amount" }, { status: 400 });
      }

      const validationError = validateBookingAmount(amount, trashAmount);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }

      const { error } = await supabase
        .from(DEPOSIT_TABLE)
        .update({ amount, trash_amount: trashAmount, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) {
        return NextResponse.json({ error: error.message || "Gagal mengubah booking payment" }, { status: 500 });
      }

      await recordAdminActivity(req, {
        type: "update",
        module: "deposit",
        severity: "success",
        message: `Update booking snapshot ${deposit.house} ${deposit.period}`,
        metadata: {
          deposit_id: id,
          house: deposit.house,
          period: deposit.period,
          before: {
            amount: Number(deposit.amount) || 0,
            trash_amount: Number(deposit.trash_amount) || 0,
          },
          after: { amount, trash_amount: trashAmount },
        },
      });

      return NextResponse.json({ success: true });
    }

    const person_id = deposit.person_id;
    const person_house = deposit.house;
    const person_name = deposit.name;
    const period = deposit.period;
    const amount = Number(deposit.amount) || 0;
    const trashAmount = Number(deposit.trash_amount) || 0;

    const validationError = validateBookingAmount(amount, trashAmount);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const existingPayment = await findExistingPayment({ supabase, person_id, person_house, period });

    if (normalize(deposit.status).toLowerCase() === "paid" && normalize(deposit.payment_id)) {
      await ensurePaymentCashflow({
        supabase,
        paymentId: deposit.payment_id,
        personHouse: person_house,
        period,
        amount,
        date: deposit.paid_at || today,
      });
      await ensureTrashPayment({ supabase, paymentId: deposit.payment_id, trashAmount, date: deposit.paid_at || today });

      return NextResponse.json({
        success: true,
        existing: true,
        payment_id: deposit.payment_id,
      });
    }

    if (existingPayment) {
      const existingPaymentId = existingPayment.id;
      const existingPaymentDate = existingPayment.date || today;
      const existingPaymentAmount = Number(existingPayment.amount) || amount;
      const cashflowRecovered = await ensurePaymentCashflow({
        supabase,
        paymentId: existingPaymentId,
        personHouse: existingPayment.person_house || person_house,
        period,
        amount: existingPaymentAmount,
        date: existingPaymentDate,
      });
      const trashRecovered = await ensureTrashPayment({
        supabase,
        paymentId: existingPaymentId,
        trashAmount,
        date: existingPaymentDate,
      });

      const { error } = await supabase
        .from(DEPOSIT_TABLE)
        .update({
          status: "paid",
          paid_at: existingPaymentDate,
          payment_id: existingPaymentId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) {
        return NextResponse.json({ error: error.message || "Gagal mengubah booking payment" }, { status: 500 });
      }

      await recordAdminActivity(req, {
        type: "idempotent",
        module: "deposit",
        severity: "info",
        message: `Reuse existing payment for deposit ${person_house} ${period}`,
        metadata: {
          deposit_id: id,
          payment_id: existingPaymentId,
          person_id,
          house: person_house,
          name: person_name,
          period,
          amount: existingPaymentAmount,
          trash_amount: trashAmount,
          cashflow_recovered: cashflowRecovered,
          trash_recovered: trashRecovered,
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

    const { error: paymentError } = await supabase.from(PAYMENT_TABLE).insert({
      id: paymentId,
      person_id,
      person_house,
      person_name,
      period,
      amount,
      date: today,
    });

    if (paymentError) {
      return NextResponse.json({ error: paymentError.message || "Gagal menyimpan payment" }, { status: 500 });
    }

    await ensurePaymentCashflow({ supabase, paymentId, personHouse: person_house, period, amount, date: today });
    await ensureTrashPayment({ supabase, paymentId, trashAmount, date: today });

    const { error: depositUpdateError } = await supabase
      .from(DEPOSIT_TABLE)
      .update({
        status: "paid",
        paid_at: today,
        payment_id: paymentId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (depositUpdateError) {
      return NextResponse.json({ error: depositUpdateError.message || "Gagal mengubah booking payment" }, { status: 500 });
    }

    await recordAdminActivity(req, {
      type: "pay",
      module: "deposit",
      severity: "success",
      message: `Pay deposit ${person_house} ${period}`,
      metadata: {
        deposit_id: id,
        payment_id: paymentId,
        person_id,
        house: person_house,
        name: person_name,
        period,
        amount,
        trash_amount: trashAmount,
        paid_at: today,
        trash_recorded: trashAmount > 0,
      },
    });

    return NextResponse.json({
      success: true,
      payment_id: paymentId,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal memproses booking payment" }, { status: 500 });
  }
}
