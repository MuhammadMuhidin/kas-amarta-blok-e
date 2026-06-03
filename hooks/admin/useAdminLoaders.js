"use client";

import { useState } from "react";
import { readJson } from "@/components/admin/adminClientApi";

export default function useAdminLoaders({ setPayment }) {
  const [personal, setPersonal] = useState([]);
  const [payments, setPayments] = useState([]);
  const [trashRecords, setTrashRecords] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [cashflows, setCashflows] = useState([]);
  const [appConfig, setAppConfig] = useState(null);
  const [configError, setConfigError] = useState("");
  const [dailyBackup, setDailyBackup] = useState(null);
  const [loadingDailyBackup, setLoadingDailyBackup] = useState(false);

  async function loadAppConfig() {
    try {
      setConfigError("");
      const data = await readJson("/api/admin/settings/app");
      setAppConfig(data.config);
      setPayment((prev) => ({ ...prev, amount: data.config.monthly_fee }));
    } catch (err) {
      setAppConfig(null);
      setConfigError(err.message || "Failed to load configuration");
    }
  }

  async function loadPersonal() {
    setPersonal(await readJson("/api/sheets/personal"));
  }

  async function loadPayment() {
    setPayments(await readJson("/api/sheets/payment"));
  }

  async function loadTrash() {
    setTrashRecords(await readJson("/api/sheets/trash"));
  }

  async function loadDeposit() {
    setDeposits(await readJson("/api/sheets/deposit"));
  }

  async function loadCashflow() {
    setCashflows(await readJson("/api/sheets/cashflow"));
  }

  async function loadDailyBackupStatus() {
    setLoadingDailyBackup(true);
    try {
      setDailyBackup(await readJson("/api/daily-backup-status"));
    } finally {
      setLoadingDailyBackup(false);
    }
  }

  async function refreshMonitoring() {
    await Promise.all([
      loadAppConfig(),
      loadDailyBackupStatus(),
      loadPayment(),
      loadTrash(),
      loadPersonal(),
      loadCashflow(),
      loadDeposit(),
    ]);
  }

  async function refreshTabData(nextTab) {
    if (nextTab === "overview") return refreshMonitoring();
    if (nextTab === "personal") return loadPersonal();
    if (nextTab === "payment") return Promise.all([loadAppConfig(), loadPayment(), loadDeposit()]);
    if (nextTab === "deposit") return Promise.all([loadAppConfig(), loadPersonal(), loadDeposit(), loadPayment(), loadTrash(), loadCashflow()]);
    if (nextTab === "cashflow") return loadCashflow();
    if (nextTab === "monitoring") return refreshMonitoring();
    if (nextTab === "settings") return loadAppConfig();
  }

  return {
    personal,
    setPersonal,
    payments,
    trashRecords,
    deposits,
    cashflows,
    appConfig,
    configError,
    dailyBackup,
    loadingDailyBackup,
    loadAppConfig,
    loadPersonal,
    loadPayment,
    loadTrash,
    loadDeposit,
    loadCashflow,
    loadDailyBackupStatus,
    refreshMonitoring,
    refreshTabData,
  };
}