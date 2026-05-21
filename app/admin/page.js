"use client";

import AdminActivityPanel from "@/components/AdminActivityPanel";
import AdminSettings from "@/components/AdminSettings";
import CashflowTab from "@/components/admin-tabs/CashflowTab";
import DepositTab from "@/components/admin-tabs/DepositTab";
import MonitoringTab from "@/components/admin-tabs/MonitoringTab";
import PaymentTab from "@/components/admin-tabs/PaymentTab";
import PersonalTab from "@/components/admin-tabs/PersonalTab";
import SummaryBackupTab from "@/components/admin-tabs/SummaryBackupTab";
import Toast from "@/components/Toast";
import {
  buildPaymentCashflowIntegrity,
  buildSuspiciousData,
  buildTrashMismatch,
} from "@/lib/adminMonitoring";
import {
  addMonths,
  getCurrentPeriod,
  getDepositStatus as resolveDepositStatus,
  sortDeposits,
} from "@/lib/depositUtils";
import {
  calculatePersonalStats,
  filterPersonal,
  searchPersonal,
  sortPersonal,
} from "@/lib/personalUtils";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import "./page.css";

function normalize(value) {
  return String(value || "").trim();
}

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState("personal");
  const [personal, setPersonal] = useState([]);

  const [member, setMember] = useState({
    house: "",
    name: "",
    join_date: "",
    trash: "",
  });

  const [selected, setSelected] = useState([]);
  const [appConfig, setAppConfig] = useState(null);
  const [configError, setConfigError] = useState("");

  const [deposits, setDeposits] = useState([]);
  const [savingDeposit, setSavingDeposit] = useState(false);
  const [payingDepositId, setPayingDepositId] = useState("");
  const [depositForm, setDepositForm] = useState({
    person_id: "",
    end_period: "",
  });

  const [payment, setPayment] = useState({
    period: "",
    amount: "",
  });

  const [cashflow, setCashflow] = useState({
    type: "",
    amount: "",
    note: "",
  });

  const [dailyBackup, setDailyBackup] = useState(null);
  const [loadingDailyBackup, setLoadingDailyBackup] = useState(false);
  const [summaryBackup, setSummaryBackup] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [payments, setPayments] = useState([]);
  const [trashRecords, setTrashRecords] = useState([]);
  const [memberFilter, setMemberFilter] = useState("");
  const [memberSearch, setMemberSearch] = useState("");

  const [popup, setPopup] = useState(null);
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [loadingCashflow, setLoadingCashflow] = useState(false);
  const [cashflows, setCashflows] = useState([]);

  const currentPeriod = getCurrentPeriod();

  function getCookie(name) {
    return document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${name}=`))
      ?.split("=")[1];
  }

  function showPopup(text, type = "success") {
    setPopup({ text, type });
    setTimeout(() => setPopup(null), 2500);
  }

  async function checkSession() {
    const res = await fetch("/api/admin/sessions/check", {
      cache: "no-store",
    });

    if (res.status === 401) {
      router.replace("/login");
    }
  }

  function getDepositStatus(deposit) {
    return resolveDepositStatus(deposit, currentPeriod, normalize);
  }

  function isHousePaidForPeriod(person) {
    const period = normalize(payment.period);

    if (!period) return false;

    return payments.some((p) => {
      const samePeriod = normalize(p.period) === period;
      const samePerson = normalize(p.person_id) === normalize(person.id);
      const sameHouse = normalize(p.person_house) === normalize(person.house);

      return samePeriod && (samePerson || sameHouse);
    });
  }

  function isNewActiveMember(person) {
    if (person.active !== "Y") return false;
    if (!person.join_date) return false;

    const joinMonth = String(person.join_date).slice(0, 7);

    return joinMonth > currentPeriod;
  }

  function toggleMemberFilter(type) {
    setMemberFilter((prev) => (prev === type ? "" : type));
  }

  function toggleHouse(id) {
    const person = personal.find((p) => p.id === id);

    if (!person) return;
    if (isHousePaidForPeriod(person)) return;

    if (selected.includes(id)) {
      setSelected(selected.filter((x) => x !== id));
    } else {
      setSelected([...selected, id]);
    }
  }

  async function loadAppConfig() {
    try {
      setConfigError("");

      const res = await fetch("/api/admin/settings/app", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed load a configuration");
      }

      setAppConfig(data.config);
      setPayment((prev) => ({ ...prev, amount: data.config.monthly_fee }));
    } catch (err) {
      setAppConfig(null);
      setConfigError(err.message || "Failed load a configuration");
    }
  }

  async function loadPersonal() {
    const res = await fetch("/api/sheets/personal", {
      cache: "no-store",
      method: "GET",
    });

    const data = await res.json();
    setPersonal(data || []);
  }

  async function loadPayment() {
    const res = await fetch("/api/sheets/payment", {
      cache: "no-store",
      method: "GET",
    });

    const data = await res.json();
    setPayments(data || []);
  }

  async function loadTrash() {
    const res = await fetch("/api/sheets/trash", {
      cache: "no-store",
      method: "GET",
    });

    const data = await res.json();
    setTrashRecords(data || []);
  }

  async function loadDeposit() {
    const res = await fetch("/api/sheets/deposit", {
      cache: "no-store",
      method: "GET",
    });

    const data = await res.json();
    setDeposits(data || []);
  }

  async function loadCashflow() {
    const res = await fetch("/api/sheets/cashflow", {
      cache: "no-store",
      method: "GET",
    });

    const data = await res.json();
    setCashflows(data || []);
  }

  async function loadDailyBackupStatus() {
    setLoadingDailyBackup(true);

    try {
      const res = await fetch("/api/daily-backup-status", {
        cache: "no-store",
      });

      const data = await res.json();
      setDailyBackup(data);
    } finally {
      setLoadingDailyBackup(false);
    }
  }

  async function loadSummaryBackup() {
    setLoadingSummary(true);

    try {
      const res = await fetch("/api/summary-backup", {
        cache: "no-store",
      });

      const data = await res.json();
      setSummaryBackup(data || []);
    } finally {
      setLoadingSummary(false);
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

  async function addMember(e) {
    e.preventDefault();
    setLoadingAdd(true);

    try {
      const csrfToken = getCookie("csrf_token");
      const res = await fetch("/api/sheets/personal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify(member),
      });

      if (res.ok) {
        showPopup("Member added successfully", "success");
        setMember({ house: "", name: "", join_date: "", trash: "" });
        loadPersonal();
      } else {
        showPopup("Failed to add member", "error");
      }
    } finally {
      setLoadingAdd(false);
    }
  }

  async function recordPayment(e) {
    e.preventDefault();

    if (!appConfig) {
      showPopup("Konfigurasi kas belum tersedia. Pembayaran tidak bisa dicatat.", "error");
      return;
    }

    if (!payment.period) {
      showPopup("Masukkan periode pembayaran terlebih dahulu", "error");
      return;
    }

    if (selected.length === 0) {
      showPopup("Pilih minimal 1 rumah yang belum dibayar", "error");
      return;
    }

    setLoadingPayment(true);

    try {
      let success = 0;

      for (const id of selected) {
        const p = personal.find((x) => x.id === id);

        if (!p) continue;

        const csrfToken = getCookie("csrf_token");
        const res = await fetch("/api/sheets/payment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
          },
          body: JSON.stringify({
            house: p.house,
            period: payment.period,
            amount: payment.amount,
          }),
        });

        if (res.ok) {
          success += 1;
          const paymentData = await res.json();

          if ((p.trash || "").toUpperCase() === "Y") {
            await fetch("/api/sheets/trash", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-csrf-token": csrfToken,
              },
              body: JSON.stringify({
                payment_id: paymentData.payment_id,
                amount: appConfig.trash_fee,
              }),
            });
          }
        }
      }

      showPopup(`Payment recorded for ${success} house successfully`, "success");
      setSelected([]);
      setPayment({ period: "", amount: appConfig.monthly_fee });
    } finally {
      setLoadingPayment(false);
    }
  }

  async function saveDeposit(e) {
    e.preventDefault();

    if (!selectedDepositPerson || selectedDepositPeriods.length === 0) {
      showPopup("Pilih rumah dan periode titipan terlebih dahulu", "error");
      return;
    }

    setSavingDeposit(true);

    try {
      const csrfToken = getCookie("csrf_token");
      const res = await fetch("/api/sheets/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          person_id: selectedDepositPerson.id,
          house: selectedDepositPerson.house,
          name: selectedDepositPerson.name,
          periods: selectedDepositPeriods,
          amount: depositAmount,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed save deposit");
      }

      showPopup("Deposit balance saved successfully", "success");
      setDepositForm({ person_id: "", end_period: "" });
      await loadDeposit();
    } catch (err) {
      showPopup(err.message || "Failed save deposit", "error");
    } finally {
      setSavingDeposit(false);
    }
  }

  async function payDeposit(id) {
    setPayingDepositId(id);

    try {
      const csrfToken = getCookie("csrf_token");
      const res = await fetch("/api/sheets/deposit", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ id, action: "PAY_NOW" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed pay deposit");
      }

      showPopup("Deposit paid successfully", "success");

      await Promise.all([
        loadDeposit(),
        loadPayment(),
        loadTrash(),
        loadCashflow(),
      ]);
    } catch (err) {
      showPopup(err.message || "Failed pay deposit", "error");
    } finally {
      setPayingDepositId("");
    }
  }

  async function addCashflow(e) {
    e.preventDefault();
    setLoadingCashflow(true);

    try {
      const csrfToken = getCookie("csrf_token");
      const res = await fetch("/api/sheets/cashflow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify(cashflow),
      });

      if (res.ok) {
        showPopup("Transaction recorded successfully", "success");
        setCashflow({ type: "", amount: "", note: "" });
      } else {
        showPopup("Failed to record transaction", "error");
      }
    } finally {
      setLoadingCashflow(false);
    }
  }

  useEffect(() => {
    checkSession();
    loadAppConfig();
    loadPersonal();
    loadDailyBackupStatus();
    loadSummaryBackup();
    loadPayment();
    loadCashflow();
    loadTrash();
    loadDeposit();
  }, []);

  useEffect(() => {
    if (tab === "payment") {
      loadAppConfig();
      loadPayment();
    }

    if (tab === "monitoring") {
      refreshMonitoring();
    }
  }, [tab]);

  useEffect(() => {
    setSelected((prev) =>
      prev.filter((id) => {
        const person = personal.find((p) => p.id === id);
        return person && !isHousePaidForPeriod(person);
      }),
    );
  }, [payment.period, payments, personal]);

  const nextSixPeriods = useMemo(() => {
    const current = getCurrentPeriod();

    return Array.from({ length: 6 }).map((_, i) =>
      addMonths(current, i + 2),
    );
  }, []);

  const selectedDepositPeriods = useMemo(() => {
    if (!depositForm.end_period) return [];

    return nextSixPeriods.filter(
      (period) => period <= depositForm.end_period,
    );
  }, [depositForm.end_period, nextSixPeriods]);

  const activePersons = useMemo(() => {
    return sortPersonal(personal.filter((p) => p.active === "Y"));
  }, [personal]);

  const selectedDepositPerson = useMemo(() => {
    return personal.find((p) => p.id === depositForm.person_id);
  }, [personal, depositForm.person_id]);

  const depositAmount = useMemo(() => {
    if (!appConfig) return 0;
    return Number(appConfig.monthly_fee || 0);
  }, [appConfig]);

  const pendingCurrentDeposits = useMemo(() => {
    return deposits.filter(
      (d) => d.period === currentPeriod && d.status !== "paid",
    );
  }, [deposits, currentPeriod]);

  const stats = useMemo(() => {
    return calculatePersonalStats(personal);
  }, [personal]);

  const monitoringStartPeriod = appConfig?.start_monitoring_date || "";

  const trashMismatch = useMemo(() => {
    return buildTrashMismatch({
      personal,
      payments,
      trashRecords,
      monitoringStartPeriod,
      normalize,
    });
  }, [personal, payments, trashRecords, monitoringStartPeriod]);

  const paymentCashflowIntegrity = useMemo(() => {
    return buildPaymentCashflowIntegrity({
      payments,
      cashflows,
      appConfig,
      monitoringStartPeriod,
      normalize,
    });
  }, [payments, cashflows, appConfig, monitoringStartPeriod]);

  const suspiciousData = useMemo(() => {
    return buildSuspiciousData({
      personal,
      payments,
      cashflows,
      trashRecords,
      normalize,
    });
  }, [personal, payments, cashflows, trashRecords]);

  const filteredPersonal = useMemo(() => {
    return filterPersonal(sortPersonal(personal), memberFilter);
  }, [personal, memberFilter]);

  const searchedPersonal = useMemo(() => {
    return searchPersonal(filteredPersonal, memberSearch);
  }, [filteredPersonal, memberSearch]);

  const sortedDeposits = useMemo(() => {
    return sortDeposits(deposits, currentPeriod, normalize);
  }, [deposits, currentPeriod]);

  function rowClassName(person, index) {
    if (person.active === "N") return "admin-row-inactive";
    if (isNewActiveMember(person)) return "admin-row-new-active";
    if (index % 2) return "admin-row-alt";
    return "";
  }

  function tabClassName(name) {
    return tab === name ? "admin-tab admin-tab-active" : "admin-tab";
  }

  return (
    <>
      <Toast show={!!popup} type={popup?.type} message={popup?.text} />

      <div className="admin-wrapper">
        <div className="admin-header">
          <button className="admin-home-btn" onClick={() => router.push("/")}>« Home</button>
          <h1 className="admin-title">Cash Flow Management</h1>
        </div>

        <div className="admin-tabs">
          <button className={tabClassName("personal")} onClick={() => setTab("personal")}>👤 Personal</button>
          <button className={tabClassName("payment")} onClick={() => setTab("payment")}>
            <div className="admin-tab-content">
              <span>💳 Payment</span>
              {pendingCurrentDeposits.length > 0 && (
                <span className="admin-deposit-badge">
                  {pendingCurrentDeposits.length} deposit pending
                </span>
              )}
            </div>
          </button>
          <button className={tabClassName("deposit")} onClick={() => setTab("deposit")}>💰 Deposit Balance</button>
          <button className={tabClassName("cashflow")} onClick={() => setTab("cashflow")}>📝 Cashflow</button>
          <button className={tabClassName("summary")} onClick={() => setTab("summary")}>🛡️ Summary Backup</button>
          <button
            className={tabClassName("monitoring")}
            onClick={() => {
              setTab("monitoring");
              if (tab === "monitoring") refreshMonitoring();
            }}
          >
            🖥️ Monitoring
          </button>
          <button className={tabClassName("activity")} onClick={() => setTab("activity")}>📋 Activity</button>
          <button className={tabClassName("settings")} onClick={() => setTab("settings")}>⚙️ Settings</button>
        </div>

        {tab === "personal" && (
          <PersonalTab
            member={member}
            setMember={setMember}
            addMember={addMember}
            loadingAdd={loadingAdd}
            memberFilter={memberFilter}
            toggleMemberFilter={toggleMemberFilter}
            stats={stats}
            memberSearch={memberSearch}
            setMemberSearch={setMemberSearch}
            searchedPersonal={searchedPersonal}
            rowClassName={rowClassName}
          />
        )}

        {tab === "payment" && (
          <PaymentTab
            configError={configError}
            recordPayment={recordPayment}
            payment={payment}
            setPayment={setPayment}
            personal={personal}
            selected={selected}
            toggleHouse={toggleHouse}
            normalize={normalize}
            isHousePaidForPeriod={isHousePaidForPeriod}
            loadingPayment={loadingPayment}
          />
        )}

        {tab === "deposit" && (
          <DepositTab
            saveDeposit={saveDeposit}
            depositForm={depositForm}
            setDepositForm={setDepositForm}
            activePersons={activePersons}
            depositAmount={depositAmount}
            selectedDepositPerson={selectedDepositPerson}
            appConfig={appConfig}
            nextSixPeriods={nextSixPeriods}
            selectedDepositPeriods={selectedDepositPeriods}
            savingDeposit={savingDeposit}
            sortedDeposits={sortedDeposits}
            getDepositStatus={getDepositStatus}
            payingDepositId={payingDepositId}
            payments={payments}
            normalize={normalize}
            payDeposit={payDeposit}
          />
        )}

        {tab === "cashflow" && (
          <CashflowTab
            addCashflow={addCashflow}
            cashflow={cashflow}
            setCashflow={setCashflow}
            loadingCashflow={loadingCashflow}
          />
        )}

        {tab === "summary" && (
          <SummaryBackupTab
            loadingSummary={loadingSummary}
            summaryBackup={summaryBackup}
          />
        )}

        {tab === "monitoring" && (
          <MonitoringTab
            loadingDailyBackup={loadingDailyBackup}
            dailyBackup={dailyBackup}
            paymentCashflowIntegrity={paymentCashflowIntegrity}
            trashMismatch={trashMismatch}
            suspiciousData={suspiciousData}
          />
        )}

        {tab === "activity" && <AdminActivityPanel />}
        {tab === "settings" && <AdminSettings />}
      </div>
    </>
  );
}
