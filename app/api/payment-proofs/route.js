import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { enforceRateLimit, RATE_LIMIT_SCOPES } from "@/lib/rateLimit";
import { listPublicPaymentConfirmations, submitPaymentProof } from "@/features/paymentProof/paymentProofService";
import { findPaymentProofById } from "@/features/paymentProof/paymentProofRepository";
import { queuePaymentProofSubmittedNotification } from "@/lib/notificationQueue";
import { notifyAdminPaymentProofSubmitted } from "@/features/paymentProof/paymentProofService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function deferTask(task) {
  if (process.env.VERCEL) {
    try {
      const { waitUntil } = await import("@vercel/functions");
      waitUntil(task.catch((error) => {
        console.error("Background task failed", { error: error instanceof Error ? error.message : String(error) });
      }));
      return true;
    } catch (error) {
      console.error("Vercel waitUntil unavailable", error);
    }
  }

  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const context = getCloudflareContext();
    if (context?.ctx?.waitUntil) {
      context.ctx.waitUntil(task.catch((error) => {
        console.error("Background task failed", { error: error instanceof Error ? error.message : String(error) });
      }));
      return true;
    }
  } catch {
    // Non-Cloudflare runtime or context unavailable.
  }

  return false;
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const result = await listPublicPaymentConfirmations(supabase);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal membaca konfirmasi pembayaran" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const formData = await req.formData();
    const personId = String(formData.get("person_id") || "").trim();
    const period = String(formData.get("period") || "").trim().slice(0, 7);
    const rateLimit = await enforceRateLimit(req, RATE_LIMIT_SCOPES.paymentProofSubmit, { identity: "client", targetId: `${personId}:${period}` });
    if (rateLimit) return rateLimit;

    const supabase = getSupabaseAdmin();
    const result = await submitPaymentProof({ supabase, formData });

    if (result.status >= 400) {
      return NextResponse.json(result.body, { status: result.status });
    }

    const proof = result.body?.proof;

    // Return 202 SEGERA ke user - proof sudah tersimpan di DB
    const response = NextResponse.json(
      { ...result.body, status: "accepted", message: "Bukti pembayaran diterima, sedang diproses" },
      { status: 202 }
    );

    // Background: kirim email notifikasi ke admin
    if (proof?.id) {
      deferTask(
        (async () => {
          try {
            const fullProof = await findPaymentProofById(supabase, proof.id);
            if (fullProof) {
              await notifyAdminPaymentProofSubmitted({
                proof: fullProof,
                member: { house: fullProof.person_house, name: fullProof.person_name || "-", trash: "N" },
                appConfig: { monthly_fee: fullProof.amount, trash_fee: fullProof.trash_amount || 0 },
              });
            }
          } catch (err) {
            console.error("Email notification failed", err);
          }
        })()
      );
    }

    // Background: queue Telegram notification
    if (proof?.id) {
      deferTask(
        (async () => {
          try {
            const fullProof = await findPaymentProofById(supabase, proof.id);
            if (fullProof) {
              await queuePaymentProofSubmittedNotification({
                proof: fullProof,
                totalAmount: Number(fullProof.amount || 0) + Number(fullProof.trash_amount || 0),
              });
            }
          } catch (error) {
            console.error("Telegram queue failed", error);
          }
        })()
      );
    }

    return response;
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal mengirim bukti transfer" }, { status: 500 });
  }
}
