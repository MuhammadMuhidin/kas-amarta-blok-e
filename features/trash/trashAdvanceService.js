import { generateId } from "@/lib/id";
import { getAppConfig } from "@/lib/appConfig";
import { recordAdminActivity } from "@/lib/adminActivity";
import {
  insertTrashAdvanceCashflows,
  loadTrashAdvanceData,
} from "@/features/trash/trashAdvanceRepository";

function normalize(value) {
  return String(value || "").trim();
}

function normalizeUpper(value) {
  return normalize(value).toUpperCase();
}

function isActiveMember(row) {
  return ["Y", "YES", "TRUE", "1"].includes(normalizeUpper(row.active));
}

function isJoinedByPeriod(row, period) {
  const joinPeriod = normalize(row.join_date).slice(0, 7);
  return !joinPeriod || joinPeriod <= period;
}

function buildAdvanceRefId(personId, period) {
  return `TRASHADV-${normalize(personId)}-${normalize(period)}`;
}

function buildAdvanceNote(house, period) {
  return `Talangan Iuran Sampah ${house} Periode ${period}`;
}

function getPaidTrashPersonIds({ payments, trashRecords, period }) {
  const paymentMap = new Map(payments.map((row) => [normalize(row.id), row]));

  return new Set(
    trashRecords
      .map((row) => paymentMap.get(normalize(row.payment_id)))
      .filter((payment) => payment && normalize(payment.period) === period)
      .map((payment) => normalize(payment.person_id))
      .filter(Boolean),
  );
}

function getExistingAdvanceRefs(cashflows) {
  return new Set(
    cashflows
      .map((row) => normalize(row.payment_id))
      .filter((paymentId) => paymentId.startsWith("TRASHADV-")),
  );
}

function buildTrashAdvanceValues({ members, paidPersonIds, existingAdvanceRefs, period, trashFee, today }) {
  const unpaidMembers = members.filter((row) => !paidPersonIds.has(normalize(row.id)));
  const values = [];
  const advancedMembers = [];
  const skippedMembers = [];

  unpaidMembers.forEach((member) => {
    const personId = normalize(member.id);
    const house = normalize(member.house);
    const name = normalize(member.name);
    const paymentId = buildAdvanceRefId(personId, period);

    if (!personId || !house || existingAdvanceRefs.has(paymentId)) {
      skippedMembers.push({ person_id: personId, house, name, ref_id: paymentId, payment_id: paymentId });
      return;
    }

    const cashflowId = generateId("CSFLOW-");
    values.push({
      id: cashflowId,
      payment_id: paymentId,
      type: "expense",
      amount: trashFee,
      note: buildAdvanceNote(house, period),
      date: today,
      receipt_url: "",
    });
    advancedMembers.push({ person_id: personId, house, name, ref_id: paymentId, payment_id: paymentId, cashflow_id: cashflowId });
  });

  return { values, advancedMembers, skippedMembers };
}

export async function advanceUnpaidTrash({ supabase, req, period }) {
  if (!/^\d{4}-\d{2}$/.test(period)) {
    return { status: 400, body: { error: "Valid period is required" } };
  }

  const appConfig = await getAppConfig();
  const trashFee = Number(appConfig?.trash_fee || 0);

  if (!Number.isFinite(trashFee) || trashFee <= 0) {
    return { status: 400, body: { error: "Trash fee is not configured" } };
  }

  const today = new Date().toISOString().slice(0, 10);
  const data = await loadTrashAdvanceData(supabase);
  const paidPersonIds = getPaidTrashPersonIds({ payments: data.payments, trashRecords: data.trashRecords, period });
  const existingAdvanceRefs = getExistingAdvanceRefs(data.cashflows);
  const trashMembers = data.personal
    .filter((row) => isActiveMember(row))
    .filter((row) => normalizeUpper(row.trash) === "Y")
    .filter((row) => isJoinedByPeriod(row, period));
  const { values, advancedMembers, skippedMembers } = buildTrashAdvanceValues({
    members: trashMembers,
    paidPersonIds,
    existingAdvanceRefs,
    period,
    trashFee,
    today,
  });

  await insertTrashAdvanceCashflows(supabase, values);

  await recordAdminActivity(req, {
    type: values.length > 0 ? "create" : "idempotent",
    module: "trash",
    severity: values.length > 0 ? "warning" : "info",
    message: `Advance unpaid trash ${period}: ${values.length} cashflow expense`,
    metadata: {
      period,
      trash_fee: trashFee,
      advanced: values.length,
      skipped: skippedMembers.length,
      total_amount: values.length * trashFee,
      advanced_members: advancedMembers,
      skipped_members: skippedMembers,
    },
  });

  return {
    status: 200,
    body: {
      success: true,
      period,
      advanced: values.length,
      skipped: skippedMembers.length,
      total: values.length * trashFee,
      trash_fee: trashFee,
      advanced_members: advancedMembers,
      skipped_members: skippedMembers,
    },
  };
}
