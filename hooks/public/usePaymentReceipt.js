import { useMemo, useState, useEffect } from "react";
import { formatPeriod } from "@/lib/public/publicFormatters";

function normalize(value) {
  return String(value || "").trim();
}

function formatDateIndo(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

function formatDateTimeIndo(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (isNaN(date.getTime())) return String(value);
  return date.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }) + " WIB";
}

async function fetchPaymentProof(paymentId) {
  if (!paymentId) return null;
  try {
    const res = await fetch(`/api/public/payment-proof?payment_id=${encodeURIComponent(paymentId)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.ok ? data.proof : null;
  } catch {
    return null;
  }
}

async function fetchTrashAmount(paymentId) {
  if (!paymentId) return 0;
  try {
    const res = await fetch(`/api/public/trash-amount?payment_id=${encodeURIComponent(paymentId)}`, {
      cache: "no-store",
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.ok ? Number(data.trash_amount || 0) : 0;
  } catch {
    return 0;
  }
}

export function usePaymentReceipt({ resident, selectedPeriod, payments, paymentConfirmations }) {
  const [proofData, setProofData] = useState(null);
  const [trashAmount, setTrashAmount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch proof when payment ID is available
  useEffect(() => {
    const periodKey = selectedPeriod?.slice(0, 7);
    const confirmation = paymentConfirmations?.find(
      (c) =>
        normalize(c.person_id) === normalize(resident?.id) &&
        normalize(c.period || "").slice(0, 7) === periodKey
    );
    // Also find payment record to get payment.id as fallback (for trash amount when no proof exists)
    const payment = payments?.find(
      (p) =>
        normalize(p.person_id) === normalize(resident?.id) &&
        normalize(p.period || "").slice(0, 7) === periodKey
    );
    const paymentId = payment?.id || confirmation?.approved_payment_id;

    if (!paymentId) {
      setProofData(null);
      setTrashAmount(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let cancelled = false;

    Promise.all([
      fetchPaymentProof(paymentId),
      fetchTrashAmount(paymentId),
    ]).then(([proof, amount]) => {
      if (!cancelled) {
        setProofData(proof);
        setTrashAmount(amount);
        setIsLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setProofData(null);
        setTrashAmount(0);
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [resident, selectedPeriod, payments, paymentConfirmations]);

  const receiptData = useMemo(() => {
    // Jangan generate kwitansi kalau masih loading data bukti/sampah
    if (isLoading) return null;
    if (!resident || !resident.paid || !selectedPeriod) return null;

    const periodKey = selectedPeriod.slice(0, 7);
    const confirmations = paymentConfirmations || [];

    // Cari payment record untuk rumah & periode ini
    const payment = payments.find(
      (p) =>
        normalize(p.person_id) === normalize(resident.id) &&
        normalize(p.period || "").slice(0, 7) === periodKey
    );

    // Cari confirmation record
    const confirmation = confirmations.find(
      (c) =>
        normalize(c.person_id) === normalize(resident.id) &&
        normalize(c.period || "").slice(0, 7) === periodKey
    );

    if (!payment && !confirmation) return null;

    // Nominal kas wajib dari payment.amount (history)
    if (!payment || payment.amount === undefined || payment.amount === null || Number(payment.amount) === 0) {
      return null; // Data pembayaran tidak lengkap, kwitansi tidak bisa digenerate
    }
    const cashAmount = Number(payment.amount);

    // Nominal sampah: ambil dari table trash via payment_id
    const paymentId = payment?.id || confirmation?.approved_payment_id || "";

    const totalAmount = cashAmount + trashAmount;

    // Tanggal bayar: dari payment.date atau confirmation.reviewed_at
    const paymentDate = payment?.date || confirmation?.reviewed_at || "";

    // Approved by/at dari confirmation
    const approvedBy = confirmation?.reviewed_by || "admin";
    const approvedAt = confirmation?.reviewed_at
      ? formatDateIndo(confirmation.reviewed_at)
      : paymentDate
        ? formatDateIndo(paymentDate)
        : "";

    // Receipt No
    const receiptNo = paymentId
      ? `KWT-${paymentId.slice(-6).toUpperCase()}-${periodKey.replace("-", "")}`
      : "";

    // Proof data (from API)
    const proofId = proofData?.id || "";
    const proofFilename = proofData?.original_filename || "";
    const proofSubmittedAt = proofData?.submitted_at
      ? formatDateTimeIndo(proofData.submitted_at)
      : "";

    return {
      period: periodKey,
      house: resident.house,
      paymentDate: paymentDate ? formatDateIndo(paymentDate) : "",
      cashAmount,
      trashAmount,
      totalAmount,
      approvedBy,
      approvedAt,
      paymentId,
      receiptNo,
      proofId,
      proofFilename,
      proofSubmittedAt,
      fileName: `kwitansi-${resident.house}-${periodKey}.jpg`,
    };
  }, [resident, selectedPeriod, payments, paymentConfirmations, proofData, trashAmount]);

  return { receiptData, isLoading };
}