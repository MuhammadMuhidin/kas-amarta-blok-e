"use client";

import { useMemo } from "react";
import {
  buildPaymentCashflowIntegrity,
  buildSuspiciousData,
  buildTrashMismatch,
} from "@/lib/adminMonitoring";
import { addMonths, sortDeposits } from "@/lib/depositUtils";
import {
  calculatePersonalStats,
  filterPersonal,
  searchPersonal,
  sortPersonal,
} from "@/lib/personalUtils";

export default function useAdminDerivedState({
  personal,
  payments,
  trashRecords,
  deposits,
  cashflows,
  appConfig,
  depositForm,
  memberFilter,
  memberSearch,
  currentPeriod,
  normalize,
}) {
  const nextSixPeriods = useMemo(
    () => Array.from({ length: 6 }).map((_, index) => addMonths(currentPeriod, index + 2)),
    [currentPeriod],
  );

  const selectedDepositPeriods = useMemo(
    () => (!depositForm.end_period ? [] : nextSixPeriods.filter((period) => period <= depositForm.end_period)),
    [depositForm.end_period, nextSixPeriods],
  );

  const activePersons = useMemo(
    () => sortPersonal(personal.filter((item) => item.active === "Y")),
    [personal],
  );

  const selectedDepositPerson = useMemo(
    () => personal.find((item) => item.id === depositForm.person_id),
    [personal, depositForm.person_id],
  );

  const depositAmount = useMemo(
    () => Number(appConfig?.monthly_fee || 0),
    [appConfig],
  );

  const pendingCurrentDeposits = useMemo(
    () => deposits.filter((item) => item.period === currentPeriod && item.status !== "paid"),
    [deposits, currentPeriod],
  );

  const stats = useMemo(() => calculatePersonalStats(personal), [personal]);
  const monitoringStartPeriod = appConfig?.start_monitoring_date || "";

  const trashMismatch = useMemo(
    () => buildTrashMismatch({ personal, payments, trashRecords, monitoringStartPeriod, normalize }),
    [personal, payments, trashRecords, monitoringStartPeriod, normalize],
  );

  const paymentCashflowIntegrity = useMemo(
    () => buildPaymentCashflowIntegrity({ payments, cashflows, appConfig, monitoringStartPeriod, normalize }),
    [payments, cashflows, appConfig, monitoringStartPeriod, normalize],
  );

  const suspiciousData = useMemo(
    () => buildSuspiciousData({ personal, payments, cashflows, trashRecords, normalize }),
    [personal, payments, cashflows, trashRecords, normalize],
  );

  const monitoringIssueCount = useMemo(
    () => trashMismatch.length + paymentCashflowIntegrity.length + suspiciousData.length,
    [trashMismatch, paymentCashflowIntegrity, suspiciousData],
  );

  const filteredPersonal = useMemo(
    () => filterPersonal(sortPersonal(personal), memberFilter),
    [personal, memberFilter],
  );

  const searchedPersonal = useMemo(
    () => searchPersonal(filteredPersonal, memberSearch),
    [filteredPersonal, memberSearch],
  );

  const sortedDeposits = useMemo(
    () => sortDeposits(deposits, currentPeriod, normalize),
    [deposits, currentPeriod, normalize],
  );

  return {
    nextSixPeriods,
    selectedDepositPeriods,
    activePersons,
    selectedDepositPerson,
    depositAmount,
    pendingCurrentDeposits,
    stats,
    trashMismatch,
    paymentCashflowIntegrity,
    suspiciousData,
    monitoringIssueCount,
    filteredPersonal,
    searchedPersonal,
    sortedDeposits,
  };
}
