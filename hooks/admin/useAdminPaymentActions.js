"use client";

import { useEffect, useState } from "react";
import { readJson, sendJson } from "@/components/admin/adminClientApi";

function buildBulkPaymentFailureMessage({ period, success, recovered, failures }) {
  const recoveredLines = recovered.length
    ? [
        "",
        "Detected as recorded after the error response:",
        ...recovered.map((item, index) => `${index + 1}. ${item.house || "-"} - ${item.name || "-"}: ${item.note}`),
      ]
    : [];

  const failureLines = failures.length
    ? failures.map((item, index) => `${index + 1}. ${item.house || "-"} - ${item.name || "-"}: ${item.error}`).join("\n")
    : "-";

  return [
    "[ADMIN ALERT] Bulk Record Payment needs review.",
    "",
    `Period: ${period || "-"}`,
    `Success: ${success} houses`,
    `Recovered: ${recovered.length} houses`,
    `Failed: ${failures.length} houses`,
    ...recoveredLines,
    "",
    "Failure details:",
    failureLines,
  ].join("\n");
}

async function notifyBulkPaymentFailures({ period, success, recovered, failures }) {
  if (!failures.length && !recovered.length) return;

  await sendJson("/api/waha/workflow", "POST", {
    period,
    source: "admin-bulk-payment-failure",
    message: buildBulkPaymentFailureMessage({ period, success, recovered, failures }),
  });
}

async function findRecordedPayment({ person, period, normalize }) {
  const latestPayments = await readJson("/api/sheets/payment");

  return latestPayments.find((item) => {
    const samePeriod = normalize(item.period).slice(0, 7) === normalize(period).slice(0, 7);
    const samePerson = normalize(item.person_id) === normalize(person.id);
    const sameHouse = normalize(item.person_house) === normalize(person.house);

    return samePeriod && (samePerson || sameHouse);
  });
}

async function ensureTrashPayment({ person, paymentId, appConfig, createTrashPayment }) {
  if ((person.trash || "").toUpperCase() !== "Y") {
    return "Payment found after the error response.";
  }

  const trashRecords = await readJson("/api/sheets/trash");
  const alreadyRecorded = trashRecords.some((item) => String(item.payment_id || "").trim() === String(paymentId || "").trim());

  if (alreadyRecorded) {
    return "Payment and trash record found after the error response.";
  }

  await createTrashPayment({
    payment_id: paymentId,
    person_id: person.id,
    house: person.house,
    name: person.name,
    amount: appConfig.trash_fee,
    source: "payment-recovery",
  });

  return "Payment found after the error response, and the trash record was completed.";
}

function createBulkBatchId(period) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${period || "period"}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function useAdminPaymentActions({
  personal,
  payments,
  appConfig,
  payment,
  setPayment,
  loadPayment,
  loadTrash,
  loadCashflow,
  showPopup,
  createPayment,
  createTrashPayment,
  normalize,
}) {
  const [selected, setSelected] = useState([]);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [paymentProgress, setPaymentProgress] = useState({ current: 0, total: 0 });

  function isHousePaidForPeriod(person) {
    const period = normalize(payment.period);
    if (!period) return false;

    return payments.some((item) => {
      const samePeriod = normalize(item.period) === period;
      const samePerson = normalize(item.person_id) === normalize(person.id);
      const sameHouse = normalize(item.person_house) === normalize(person.house);
      return samePeriod && (samePerson || sameHouse);
    });
  }

  function toggleHouse(id) {
    if (loadingPayment) return;

    const person = personal.find((item) => item.id === id);
    if (!person || isHousePaidForPeriod(person)) return;

    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function resetSelected() {
    if (loadingPayment) return;
    setSelected([]);
  }

  async function recordPayment(e) {
    e.preventDefault();

    if (!appConfig) {
      showPopup("Cash configuration is not available. Payment cannot be recorded.", "error");
      return;
    }

    if (!payment.period) {
      showPopup("Enter the payment period first", "error");
      return;
    }

    if (selected.length === 0) {
      showPopup("Select at least 1 unpaid house", "error");
      return;
    }

    const bulkBatchId = createBulkBatchId(payment.period);

    setLoadingPayment(true);
    setPaymentProgress({ current: 0, total: selected.length });

    try {
      let success = 0;
      const recovered = [];
      const failures = [];

      for (const [index, id] of selected.entries()) {
        setPaymentProgress({ current: index + 1, total: selected.length });
        const person = personal.find((item) => item.id === id);
        if (!person) continue;

        try {
          const paymentData = await createPayment({
            house: person.house,
            period: payment.period,
            amount: payment.amount,
            bulk_batch_id: bulkBatchId,
            bulk_index: index,
            bulk_total: selected.length,
          });

          if ((person.trash || "").toUpperCase() === "Y") {
            await createTrashPayment({
              payment_id: paymentData.payment_id,
              person_id: person.id,
              house: person.house,
              name: person.name,
              period: payment.period,
              amount: appConfig.trash_fee,
              source: "payment",
            });
          }

          success += 1;
        } catch (err) {
          try {
            const recordedPayment = await findRecordedPayment({ person, period: payment.period, normalize });

            if (recordedPayment?.id) {
              const note = await ensureTrashPayment({
                person,
                paymentId: recordedPayment.id,
                appConfig,
                createTrashPayment,
              });

              success += 1;
              recovered.push({
                id: person.id,
                house: person.house,
                name: person.name,
                note,
              });
              continue;
            }
          } catch (verifyErr) {
            failures.push({
              id: person.id,
              house: person.house,
              name: person.name,
              error: `${err.message || "Failed to record payment"}. Verification failed: ${verifyErr.message || "unknown"}`,
            });
            continue;
          }

          failures.push({
            id: person.id,
            house: person.house,
            name: person.name,
            error: err.message || "Failed to record payment",
          });
        }
      }

      await Promise.all([loadPayment(), loadTrash(), loadCashflow()]);

      if (failures.length > 0 || recovered.length > 0) {
        try {
          await notifyBulkPaymentFailures({ period: payment.period, success, recovered, failures });
        } catch (notifyErr) {
          showPopup(notifyErr.message || "Failed to trigger WhatsApp workflow", "error");
        }
      }

      if (success > 0) {
        setSelected((prev) => prev.filter((id) => failures.some((item) => item.id === id)));
      }

      if (failures.length === 0) {
        const recoveredText = recovered.length ? `, ${recovered.length} recovered` : "";
        showPopup(`Payment completed: ${success} successful${recoveredText}, 0 failed`, "success");
        setSelected([]);
        setPayment({ period: "", amount: appConfig.monthly_fee });
      } else if (success > 0) {
        const recoveredText = recovered.length ? `, ${recovered.length} recovered` : "";
        showPopup(`Payment completed: ${success} successful${recoveredText}, ${failures.length} failed`, "warning");
      } else {
        showPopup(`Payment completed: 0 successful, ${failures.length} failed`, "error");
      }
    } finally {
      setLoadingPayment(false);
      setPaymentProgress({ current: 0, total: 0 });
    }
  }

  useEffect(() => {
    if (loadingPayment) return;

    setSelected((prev) => prev.filter((id) => {
      const person = personal.find((item) => item.id === id);
      return person && !isHousePaidForPeriod(person);
    }));
  }, [payment.period, payments, personal, loadingPayment]);

  return {
    selected,
    loadingPayment,
    paymentProgress,
    toggleHouse,
    resetSelected,
    isHousePaidForPeriod,
    recordPayment,
  };
}