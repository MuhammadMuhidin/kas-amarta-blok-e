"use client";

import AdminActivityPanel from "@/components/AdminActivityPanel";
import CashflowTab from "@/components/admin/tabs/CashflowTab";
import DepositTab from "@/components/admin/tabs/DepositTab";
import MonitoringTab from "@/components/admin/tabs/MonitoringTab";
import OverviewTab from "@/components/admin/tabs/OverviewTab";
import PaymentTab from "@/components/admin/tabs/PaymentTab";
import PersonalTab from "@/components/admin/tabs/PersonalTab";
import SettingsTab from "@/components/admin/tabs/SettingsTab";
import SummaryBackupTab from "@/components/admin/tabs/SummaryBackupTab";
import TimelineTab from "@/components/admin/tabs/TimelineTab";
import Toast from "@/components/Toast";
import { sendJson } from "@/components/admin/adminClientApi";
import { getCurrentPeriod } from "@/lib/depositUtils";
import useAdminCashflowActions from "@/hooks/admin/useAdminCashflowActions";
import useAdminDepositActions from "@/hooks/admin/useAdminDepositActions";
import useAdminDerivedState from "@/hooks/admin/useAdminDerivedState";
import useAdminLoaders from "@/hooks/admin/useAdminLoaders";
import useAdminMemberActions from "@/hooks/admin/useAdminMemberActions";
import useAdminPaymentActions from "@/hooks/admin/useAdminPaymentActions";
import useAdminSession from "@/hooks/admin/useAdminSession";
import useAdminTabs from "@/hooks/admin/useAdminTabs";
import useAdminToast from "@/hooks/admin/useAdminToast";
import useScreenWakeLock from "@/hooks/admin/useScreenWakeLock";
import AdminLoading from "@/app/admin/loading";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function normalize(value) {
  return String(value || "").trim();
}

export default function AdminPageClient() {
  const router = useRouter();
  const currentPeriod = getCurrentPeriod();
  const [bootLoading, setBootLoading] = useState(true);
  const [payment, setPayment] = useState({ period: "", amount: "" });
  const [depositForm, setDepositForm] = useState({ person_id: "", end_period: "" });
  const [bookingBatchLoading, setBookingBatchLoading] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);

  const { popup, showPopup } = useAdminToast();
  const { checkSession } = useAdminSession();

  const {
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
    refreshTabData,
  } = useAdminLoaders({ setPayment });

  const {
    tab,
    tabRefreshKey,
    handleTabClick,
    tabClassName,
  } = useAdminTabs(refreshTabData);

  const {
    member,
    setMember,
    memberFilter,
    memberSearch,
    setMemberSearch,
    loadingAdd,
    toggleMemberFilter,
    rowClassName,
    addMember,
    updateMemberInline,
  } = useAdminMemberActions({
    personal,
    setPersonal,
    loadPersonal,
    showPopup,
    submitMember: (payload) => sendJson("/api/sheets/personal", "POST", payload),
    patchMember: (payload) => sendJson("/api/sheets/personal", "PATCH", payload),
    normalize,
    currentPeriod,
  });

  const {
    activePersons,
    stats,
    searchedPersonal,
    sortedDeposits,
    pendingCurrentDeposits,
    nextSixPeriods,
    selectedDepositPerson,
    selectedDepositPeriods,
    depositAmount,
    paymentCashflowIntegrity,
    trashMismatch,
    depositPaymentIntegrity,
    suspiciousData,
    monitoringIssueCount,
  } = useAdminDerivedState({
    personal,
    payments,
    trashRecords,
    deposits,
    cashflows,
    appConfig,
    memberFilter,
    memberSearch,
    depositForm,
    currentPeriod,
    normalize,
  });

  const {
    selected,
    loadingPayment,
    paymentProgress,
    toggleHouse,
    resetSelected,
    isHousePaidForPeriod,
    recordPayment,
  } = useAdminPaymentActions({
    personal,
    payments,
    appConfig,
    loadPayment,
    loadTrash,
    loadCashflow,
    showPopup,
    createPayment: (payload) => sendJson("/api/sheets/payment", "POST", payload),
    createTrashPayment: (payload) => sendJson("/api/sheets/trash", "POST", payload),
    normalize,
    payment,
    setPayment,
  });

  const wakeLock = useScreenWakeLock(loadingPayment || bookingBatchLoading);

  const {
    savingDeposit,
    payingDepositId,
    getDepositStatus,
    saveDeposit,
    payDeposit,
  } = useAdminDepositActions({
    currentPeriod,
    normalize,
    depositForm,
    setDepositForm,
    selectedDepositPerson,
    selectedDepositPeriods,
    depositAmount,
    loadDeposit,
    loadPayment,
    loadTrash,
    loadCashflow,
    showPopup,
    createDeposit: (payload) => sendJson("/api/sheets/deposit", "POST", payload),
    payDepositBooking: (payload) => sendJson("/api/sheets/deposit", "PATCH", payload),
  });

  const {
    cashflow,
    setCashflow,
    loadingCashflow,
    addCashflow,
  } = useAdminCashflowActions({
    loadCashflow,
    showPopup,
    createCashflow: (payload) => sendJson("/api/sheets/cashflow", "POST", payload),
  });

  async function refreshBookingState() {
    await Promise.all([loadDeposit(), loadPayment(), loadTrash(), loadCashflow()]);
  }

  async function refreshMonitoringState() {
    await Promise.all([loadPayment(), loadTrash(), loadCashflow()]);
  }

  async function refreshOverviewState() {
    await Promise.all([loadPayment(), loadTrash(), loadCashflow()]);
  }

  function handleAdminMenuTabClick(nextTab) {
    handleTabClick(nextTab);
    setAdminMenuOpen(false);
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
    const hasRunningBatch = loadingPayment || bookingBatchLoading;
    if (!hasRunningBatch) return undefined;

    function handleBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = "";
      return "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [loadingPayment, bookingBatchLoading]);

  useEffect(() => {
    if (!adminMenuOpen) return undefined;

    const scrollY = window.scrollY;
    const { body, documentElement } = document;
    const previousBodyStyles = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };
    const previousHtmlOverflow = documentElement.style.overflow;

    body.classList.add("admin-menu-scroll-locked");
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    documentElement.style.overflow = "hidden";

    return () => {
      body.classList.remove("admin-menu-scroll-locked");
      body.style.overflow = previousBodyStyles.overflow;
      body.style.position = previousBodyStyles.position;
      body.style.top = previousBodyStyles.top;
      body.style.left = previousBodyStyles.left;
      body.style.right = previousBodyStyles.right;
      body.style.width = previousBodyStyles.width;
      documentElement.style.overflow = previousHtmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [adminMenuOpen]);

  if (bootLoading) return <AdminLoading />;

  return (
    <>
      <Toast show={!!popup} type={popup?.type} message={popup?.text} />
      <div className="admin-wrapper">
        <div className="admin-header">
          <button className="admin-home-btn" onClick={() => router.push("/")}>🏠 Home</button>
          <h1 className="admin-title">Cash Flow Management</h1>
        </div>
        <button
          type="button"
          className="admin-mobile-menu-btn"
          onClick={() => setAdminMenuOpen((open) => !open)}
          aria-controls="admin-mobile-menu"
          aria-expanded={adminMenuOpen}
        >
          ☰ Menu Admin
        </button>
        {adminMenuOpen && (
          <button
            type="button"
            className="admin-mobile-menu-backdrop"
            aria-label="Tutup menu admin"
            onClick={() => setAdminMenuOpen(false)}
          />
        )}
        <div id="admin-mobile-menu" className={`admin-tabs ${adminMenuOpen ? "admin-tabs-open" : ""}`}>
          <div className="admin-mobile-menu-header">
            <span>Menu Admin</span>
            <button type="button" onClick={() => setAdminMenuOpen(false)} aria-label="Tutup menu admin">×</button>
          </div>
          <button className={tabClassName("overview")} onClick={() => handleAdminMenuTabClick("overview")}>📌 Overview</button>
          <button className={tabClassName("personal")} onClick={() => handleAdminMenuTabClick("personal")}>👤 Member</button>
          <button className={tabClassName("payment")} onClick={() => handleAdminMenuTabClick("payment")}><div className="admin-tab-content"><span>💳 Payment</span>{pendingCurrentDeposits.length > 0 && <span className="admin-deposit-badge">{pendingCurrentDeposits.length} booking pending</span>}</div></button>
          <button className={tabClassName("deposit")} onClick={() => handleAdminMenuTabClick("deposit")}>💰 Booking Payment</button>
          <button className={tabClassName("cashflow")} onClick={() => handleAdminMenuTabClick("cashflow")}>📝 Cashflow</button>
          <button className={tabClassName("timeline")} onClick={() => handleAdminMenuTabClick("timeline")}>📸 Timeline</button>
          <button className={tabClassName("summary")} onClick={() => handleAdminMenuTabClick("summary")}>🛡️ Summary Backup</button>
          <button className={tabClassName("monitoring")} onClick={() => handleAdminMenuTabClick("monitoring")}><div className="admin-tab-content"><span>🖥️ Monitoring</span>{monitoringIssueCount > 0 && <span className="admin-monitoring-badge">{monitoringIssueCount}</span>}</div></button>
          <button className={tabClassName("activity")} onClick={() => handleAdminMenuTabClick("activity")}>📋 Activity</button>
          <button className={tabClassName("settings")} onClick={() => handleAdminMenuTabClick("settings")}>⚙️ Settings</button>
        </div>
        {tab === "overview" && <OverviewTab key={`overview-${tabRefreshKey}`} personal={personal} payments={payments} trashRecords={trashRecords} cashflows={cashflows} sortedDeposits={sortedDeposits} currentPeriod={currentPeriod} appConfig={appConfig} dailyBackup={dailyBackup} monitoringIssueCount={monitoringIssueCount} getDepositStatus={getDepositStatus} onNavigate={handleTabClick} onTrashAdvanceComplete={refreshOverviewState} />}
        {tab === "personal" && <PersonalTab key={`personal-${tabRefreshKey}`} member={member} setMember={setMember} addMember={addMember} loadingAdd={loadingAdd} memberFilter={memberFilter} toggleMemberFilter={toggleMemberFilter} stats={stats} memberSearch={memberSearch} setMemberSearch={setMemberSearch} searchedPersonal={searchedPersonal} rowClassName={rowClassName} onUpdateMember={updateMemberInline} />}
        {tab === "payment" && <PaymentTab key={`payment-${tabRefreshKey}`} configError={configError} recordPayment={recordPayment} payment={payment} setPayment={setPayment} personal={personal} payments={payments} selected={selected} toggleHouse={toggleHouse} resetSelected={resetSelected} normalize={normalize} isHousePaidForPeriod={isHousePaidForPeriod} loadingPayment={loadingPayment} paymentProgress={paymentProgress} wakeLock={wakeLock} />}
        {tab === "deposit" && <DepositTab key={`deposit-${tabRefreshKey}`} saveDeposit={saveDeposit} depositForm={depositForm} setDepositForm={setDepositForm} activePersons={activePersons} depositAmount={depositAmount} selectedDepositPerson={selectedDepositPerson} appConfig={appConfig} nextSixPeriods={nextSixPeriods} selectedDepositPeriods={selectedDepositPeriods} savingDeposit={savingDeposit} sortedDeposits={sortedDeposits} getDepositStatus={getDepositStatus} payingDepositId={payingDepositId} payments={payments} normalize={normalize} payDeposit={payDeposit} onBatchComplete={refreshBookingState} onBatchStatusChange={setBookingBatchLoading} wakeLock={wakeLock} />}
        {tab === "cashflow" && <CashflowTab key={`cashflow-${tabRefreshKey}`} addCashflow={addCashflow} cashflow={cashflow} setCashflow={setCashflow} loadingCashflow={loadingCashflow} />}
        {tab === "timeline" && <TimelineTab key={`timeline-${tabRefreshKey}`} showPopup={showPopup} />}
        {tab === "summary" && <SummaryBackupTab key={`summary-${tabRefreshKey}`} />}
        {tab === "monitoring" && <MonitoringTab key={`monitoring-${tabRefreshKey}`} loadingDailyBackup={loadingDailyBackup} dailyBackup={dailyBackup} paymentCashflowIntegrity={paymentCashflowIntegrity} trashMismatch={trashMismatch} depositPaymentIntegrity={depositPaymentIntegrity} suspiciousData={suspiciousData} onRepairComplete={refreshMonitoringState} />}
        {tab === "activity" && <AdminActivityPanel key={`activity-${tabRefreshKey}`} />}
        {tab === "settings" && <SettingsTab key={`settings-${tabRefreshKey}`} />}
      </div>
    </>
  );
}
