import { generateId } from "@/lib/id";
import { recordAdminActivity } from "@/lib/adminActivity";
import {
  findTrashByPaymentId,
  insertTrash,
  listTrash,
} from "@/features/trash/trashRepository";

function normalize(value) {
  return String(value || "").trim();
}

export async function listTrashRecords(supabase) {
  return listTrash(supabase);
}

export async function createTrashPayment({ supabase, req, body }) {
  const paymentId = normalize(body.payment_id);
  const amount = Number(body.amount || 0);

  if (!paymentId || !amount) {
    return {
      status: 400,
      body: { error: "Payment ID and amount are required" },
    };
  }

  const existingTrash = await findTrashByPaymentId(supabase, paymentId);

  if (existingTrash) {
    await recordAdminActivity(req, {
      type: "idempotent",
      module: "trash",
      severity: "info",
      message: `Reuse existing trash payment ${paymentId}`,
      metadata: {
        trash_id: existingTrash.id,
        payment_id: paymentId,
        amount: Number(existingTrash.amount) || amount,
        date: existingTrash.date || null,
      },
    });

    return {
      status: 200,
      body: {
        success: true,
        existing: true,
        trash_id: existingTrash.id,
      },
    };
  }

  const trashId = generateId("TRASH-");
  const today = new Date().toISOString().slice(0, 10);

  await insertTrash(supabase, {
    id: trashId,
    payment_id: paymentId,
    amount,
    date: today,
  });

  await recordAdminActivity(req, {
    type: "create",
    module: "trash",
    severity: "success",
    message: `Record trash payment ${paymentId}`,
    metadata: {
      trash_id: trashId,
      payment_id: paymentId,
      amount,
      date: today,
      actor: "system",
    },
  });

  return {
    status: 200,
    body: {
      success: true,
      trash_id: trashId,
    },
  };
}
