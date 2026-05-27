"use client";

import AdminActivityPanel from "@/components/AdminActivityPanel";
import AdminSettings from "@/components/AdminSettings";
import CashflowTab from "@/components/admin-tabs/CashflowTab";
import DepositTab from "@/components/admin-tabs/DepositTab";
import MonitoringTab from "@/components/admin-tabs/MonitoringTab";
import OverviewTab from "@/components/admin-tabs/OverviewTab";
import PaymentTab from "@/components/admin-tabs/PaymentTab";
import PersonalTab from "@/components/admin-tabs/PersonalTab";
import SummaryBackupTab from "@/components/admin-tabs/SummaryBackupTab";
import Toast from "@/components/Toast";
import { readJson, sendJson } from "@/components/admin/adminClientApi";
import { getCurrentPeriod, getDepositStatus as resolveDepositStatus } from "@/lib/depositUtils";
import useAdminDerivedState from "@/hooks/admin/useAdminDerivedState";
import AdminLoading from "@/app/admin/loading";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function normalize(value) {
  return String(value || "").trim();
}

export default function AdminPageClient() {
  const router = useRouter();
  const currentPeriod = getCurrentPeriod();
  const [tab, setTab] = useState("overview");
  const [tabRefreshKey, setTabRefreshKey] = useState(0);
  const [personal, setPersonal] = useState([]);
  const [payments, setPayments] = useState([]);
  const [trashRecords, setTrashRecords] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [cashflows, setCashflows] = useState([]);
  const [appConfig, setAppConfig] = useState(null);
  const [configError, setConfigError] = useState("");
  const [dailyBackup, setDailyBackup] = useState(null);
  const [loadingDailyBackup, setLoadingDailyBackup] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [popup, setPopup] = useState(null);
  const [member, setMember] = useState({ house: "", name: "", join_date: "", trash: "" });
  const [memberFilter, setMemberFilter] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [payment, setPayment] = useState({ period: "", amount: "" });
  const [cashflow, setCashflow] = useState({ type: "", amount: "", note: "" });
  const [depositForm, setDepositForm] = useState({ person_id: "", end_period: "" });
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [loadingCashflow, setLoadingCashflow] = useState(false);
  const [savingDeposit, setSavingDeposit] = useState(false);
  const [payingDepositId, setPayingDepositId] = useState("");

  const {
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
    searchedPersonal,
    sortedDeposits,
  } = useAdminDerivedState({
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
  });

  function showPopup(text, type = "success") {
    setPopup({ text, type });
    setTimeout(() => setPopup(null), 2500);
  }

  async function checkSession() {
    const res = await fetch("/api/admin/sessions/check", { cache: "no-store" });
    if (res.status !== 401) return true;
    router.replace("/login");
    return false;
  }

  async function loadAppConfig() {
    try {
      setConfigError("");
      const data = await readJson("/api/admin/settings/app");
      setAppConfig(data.config);
      setPayment((prev) => ({ ...prev, amount: data.config.monthly_fee }));
    } catch (err) {
      setAppConfig(null);
      setConfigError(err.message || "Failed load a configuration");
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

  function handleTabClick(nextTab) {
    if (tab === nextTab) {
      setTabRefreshKey((prev) => prev + 1);
      refreshTabData(nextTab);
      return;
    }
    setTab(nextTab);
  }

  function getDepositStatus(deposit) {
    return resolveDepositStatus(deposit, currentPeriod, normalize);
  }

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

  function isNewActiveMember(person) {
    if (person.active !== "Y" || !person.join_date) return false;
    return String(person.join_date).slice(0, 7) > currentPeriod;
  }

  function toggleMemberFilter(type) {
    setMemberFilter((prev) => (prev === type ? "" : type));
  }

  function toggleHouse(id) {
    const person = personal.find((item) => item.id === id);
    if (!person || isHousePaidForPeriod(person)) return;
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  async function addMember(e) {
    e.preventDefault();
    if (!member.house.trim() || !member.name.trim() || !member.trash.trim() || !member.join_date.trim()) {
      showPopup("Lengkapi semua data member terlebih dahulu", "error");
      return;
    }
    setLoadingAdd(true);
    try {
      await sendJson("/api/sheets/personal", "POST", member);
      showPopup("Member berhasil ditambahkan", "success");
      setMember({ house: "", name: "", join_date: "", trash: "" });
      await loadPersonal();
    } catch (err) {
      showPopup(err.message || "Gagal menambahkan member", "error");
    } finally {
      setLoadingAdd(false);
    }
  }

  async function updateMemberInline(person, field, value) {
    const currentValue = normalize(person?.[field]);
    const nextValue = normalize(value).toUpperCase();
    if (!person?.id || !["trash", "active"].includes(field)) return;
    if (!nextValue || currentValue === nextValue) return;
    const previousPersonal = personal;
    setPersonal((prev) => prev.map((item) => (item.id === person.id ? { ...item, [field]: nextValue } : item)));
    try {
      await sendJson("/api/sheets/personal", "PATCH", { id: person.id, field, value: nextValue });
      showPopup("Data member berhasil diperbarui", "success");
      await loadPersonal();
    } catch (err) {
      setPersonal(previousPersonal);
      showPopup(err.message || "Gagal memperbarui data member", "error");
      throw err;
    }
  }

  async function recordPayment(e) {
    e.preventDefault();
    if (!appConfig) return showPopup("Konfigurasi kas belum tersedia. Pembayaran tidak bisa dicatat.", "error");
    if (!payment.period) return showPopup("Masukkan periode pembayaran terlebih dahulu", "error");
    if (selected.length === 0) return showPopup("Pilih minimal 1 rumah yang belum dibayar", "error");
    setLoadingPayment(true);
    try {
      let success = 0;
      for (const id of selected) {
        const person = personal.find((item) => item.id === id);
        if (!person) continue;
        const paymentData = await sendJson("/api/sheets/payment", "POST", { house: person.house, period: payment.period, amount: payment.amount });
        success += 1;
        if ((person.trash || "").toUpperCase() === "Y") {
          await sendJson("/api/sheets/trash", "POST", {
            payment_id: paymentData.payment_id,
            person_id: person.id,
            house: person.house,
            name: person.name,
            period: payment.period,
            amount: appConfig.trash_fee,
            source: "payment",
          });
        }
      }
      showPopup(`Pembayaran berhasil dicatat untuk ${success} rumah`, "success");
      setSelected([]);
      setPayment({ period: "", amount: appConfig.monthly_fee });
      await Promise.all([loadPayment(), loadTrash(), loadCashflow()]);
    } finally {
      setLoadingPayment(false);
    }
  }

  async function saveDeposit(e) {
    e.preventDefault();
    if (!selectedDepositPerson || selectedDepositPeriods.length === 0) {
      showPopup("Pilih rumah dan periode booking terlebih dahulu", "error");
      return;
    }
    setSavingDeposit(true);
    try {
      await sendJson("/api/sheets/deposit", "POST", {
        person_id: selectedDepositPerson.id,
        house: selectedDepositPerson.house,
        name: selectedDepositPerson.name,
        periods: selectedDepositPeriods,
        amount: depositAmount,
      });
      showPopup("Booking payment berhasil disimpan", "success");
      setDepositForm({ person_id: "", end_period: "" });
      await loadDeposit();
    } catch (err) {
      showPopup(err.message || "Gagal menyimpan data booking", "error");
    } finally {
      setSavingDeposit(false);
    }
  }

  async function payDeposit(id) {
    setPayingDepositId(id);
    try {
      await sendJson("/api/sheets/deposit", "PATCH", { id, action: "PAY_NOW" });
      showPopup("Booking payment berhasil dibayarkan", "success");
      await Promise.all([loadDeposit(), loadPayment(), loadTrash(), loadCashflow()]);
    } catch (err) {
      showPopup(err.message || "Gagal membayarkan data booking", "error");
    } finally {
      setPayingDepositId("");
    }
  }

  async function addCashflow(e) {
    e.preventDefault();
    if (!cashflow.type.trim() || !String(cashflow.amount || "").trim() || !cashflow.note.trim()) {
      showPopup("Lengkapi jenis, nominal dan catatan transaksi", "error");
      return;
    }
    setLoadingCashflow(true);
    try {
      await sendJson("/api/sheets/cashflow", "POST", cashflow);
      showPopup("Transaksi berhasil dicatat", "success");
      setCashflow({ type: "", amount: "", note: "" });
      await loadCashflow();
    } catch (err) {
      showPopup(err.message || "Gagal mencatat transaksi", "error");
    } finally {
      setLoadingCashflow(false);
    }
  }

  useEffect(() => {
    async function bootstrap() {
      const validSession = await checkSession();
      if (!validSession) return;
      try {
        await Promise.all([loadAppConfig(), loadPersonal(), loadDailyBackupStatus(), loadPayment(), loadCashflow(), loadTrash(), loadDeposit()]);
      } finally {
        setBootLoading(false);
      }
    }
    bootstrap();
  }, []);

  useEffect(() => {
    refreshTabData(tab);
  }, [tab]);

  useEffect(() => {
    setSelected((prev) => prev.filter((id) => {
      const person = personal.find((item) => item.id === id);
      return person && !isHousePaidForPeriod(person);
    }));
  }, [payment.period, payments, personal]);

  function rowClassName(person, index) {
    if (person.active === "N") return "admin-row-inactive";
    if (isNewActiveMember(person)) return "admin-row-new-active";
    if (index % 2) return "admin-row-alt";
    return "";
  }

  function tabClassName(name) {
    return tab === name ? "admin-tab admin-tab-active" : "admin-tab";
  }

  if (bootLoading) return <AdminLoading />;

  return (
    <>
      <Toast show={!!popup} type={popup?.type} message={popup?.text} />
      <div className="admin-wrapper">
        <div className="admin-header">
          <button className="admin-home-btn" onClick={() => router.push("/")}>🏠 Home</button>
          <h1 className="admin-title">Cash Flow Management</h1>
        </div>
        <div className="admin-tabs">
          <button className={tabClassName("overview")} onClick={() => handleTabClick("overview")}>📌 Overview</button>
          <button className={tabClassName("personal")} onClick={() => handleTabClick("personal")}>👤 Member</button>
          <button className={tabClassName("payment")} onClick={() => handleTabClick("payment")}><div className="admin-tab-content"><span>💳 Payment</span>{pendingCurrentDeposits.length > 0 && <span className="admin-deposit-badge">{pendingCurrentDeposits.length} booking pending</span>}</div></button>
          <button className={tabClassName("deposit")} onClick={() => handleTabClick("deposit")}>💰 Booking Payment</button>
          <button className={tabClassName("cashflow")} onClick={() => handleTabClick("cashflow")}>📝 Cashflow</button>
          <button className={tabClassName("summary")} onClick={() => handleTabClick("summary")}>🛡️ Summary Backup</button>
          <button className={tabClassName("monitoring")} onClick={() => handleTabClick("monitoring")}><div className="admin-tab-content"><span>🖥️ Monitoring</span>{monitoringIssueCount > 0 && <span className="admin-monitoring-badge">{monitoringIssueCount}</span>}</div></button>
          <button className={tabClassName("activity")} onClick={() => handleTabClick("activity")}>📋 Activity</button>
          <button className={tabClassName("settings")} onClick={() => handleTabClick("settings")}>⚙️ Settings</button>
        </div>
        {tab === "overview" && <OverviewTab key={`overview-${tabRefreshKey}`} personal={personal} payments={payments} cashflows={cashflows} sortedDeposits={sortedDeposits} currentPeriod={currentPeriod} appConfig={appConfig} dailyBackup={dailyBackup} monitoringIssueCount={monitoringIssueCount} getDepositStatus={getDepositStatus} onNavigate={handleTabClick} />}
        {tab === "personal" && <PersonalTab key={`personal-${tabRefreshKey}`} member={member} setMember={setMember} addMember={addMember} loadingAdd={loadingAdd} memberFilter={memberFilter} toggleMemberFilter={toggleMemberFilter} stats={stats} memberSearch={memberSearch} setMemberSearch={setMemberSearch} searchedPersonal={searchedPersonal} rowClassName={rowClassName} onUpdateMember={updateMemberInline} />}
        {tab === "payment" && <PaymentTab key={`payment-${tabRefreshKey}`} configError={configError} recordPayment={recordPayment} payment={payment} setPayment={setPayment} personal={personal} payments={payments} selected={selected} toggleHouse={toggleHouse} normalize={normalize} isHousePaidForPeriod={isHousePaidForPeriod} loadingPayment={loadingPayment} />}
        {tab === "deposit" && <DepositTab key={`deposit-${tabRefreshKey}`} saveDeposit={saveDeposit} depositForm={depositForm} setDepositForm={setDepositForm} activePersons={activePersons} depositAmount={depositAmount} selectedDepositPerson={selectedDepositPerson} appConfig={appConfig} nextSixPeriods={nextSixPeriods} selectedDepositPeriods={selectedDepositPeriods} savingDeposit={savingDeposit} sortedDeposits={sortedDeposits} getDepositStatus={getDepositStatus} payingDepositId={payingDepositId} payments={payments} normalize={normalize} payDeposit={payDeposit} />}
        {tab === "cashflow" && <CashflowTab key={`cashflow-${tabRefreshKey}`} addCashflow={addCashflow} cashflow={cashflow} setCashflow={setCashflow} loadingCashflow={loadingCashflow} />}
        {tab === "summary" && <SummaryBackupTab key={`summary-${tabRefreshKey}`} />}
        {tab === "monitoring" && <MonitoringTab key={`monitoring-${tabRefreshKey}`} loadingDailyBackup={loadingDailyBackup} dailyBackup={dailyBackup} paymentCashflowIntegrity={paymentCashflowIntegrity} trashMismatch={trashMismatch} suspiciousData={suspiciousData} />}
        {tab === "activity" && <AdminActivityPanel key={`activity-${tabRefreshKey}`} />}
        {tab === "settings" && <AdminSettings key={`settings-${tabRefreshKey}`} />}
      </div>
    </>
  );
}
