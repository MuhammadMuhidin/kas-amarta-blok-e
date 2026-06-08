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

const icon = (codePoint, emoji = false) => `${String.fromCodePoint(codePoint)}${emoji ? String.fromCodePoint(0xfe0f) : ""}`;

export default function AdminPageClient() {
  const router = useRouter();
  const currentPeriod = getCurrentPeriod();
  const [bootLoading, setBootLoading] = useState(true);
  const [payment, setPayment] = useState({ period: "", amount: "" });
  const [depositForm, setDepositForm] = useState({ person_id: "", end_period: "" });
  const [bookingBatchLoading, setBookingBatchLoading] = useState(false);

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
    loadAppConfig,
    loadPersonal,
    loadPayment,
    loadTrash,
    loadDeposit,
    loadCashflow,
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
    trashAdvanceReimbursementIntegrity,
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

  useEffect(() => {
    async function bootstrap() {
      const validSession = await checkSession();
      if (!validSession) return;
      try {
        await Promise.all([loadAppConfig(), loadPersonal(), loadPayment(), loadCashflow(), loadTrash(), loadDeposit()]);
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

  if (bootLoading) return <AdminLoading />;

  return (
    <>
      <Toast show={!!popup} type={popup?.type} message={popup?.text} />
      <div className="admin-wrapper">
        <div className="admin-header">
          <button className="admin-home-btn" onClick={() => router.push("/")}>{icon(0x1F3E0)} Home</button>
          <h1 className="admin-title">Cash Flow Management</h1>
        </div>
        <div className="admin-tabs">
          <button className={tabClassName("overview")} onClick={() => handleTabClick("overview")}>{icon(0x1F4CC)} Overview</button>
          <button className={tabClassName("personal")} onClick={() => handleTabClick("personal")}>{icon(0x1F464)} Member</button>
          <button className={tabClassName("payment")} onClick={() => handleTabClick("payment")}><div className="admin-tab-content"><span>{icon(0x1F4B3)} Payment</span>{pendingCurrentDeposits.length > 0 && <span className="admin-deposit-badge">{pendingCurrentDeposits.length} booking pending</span>}</div></button>
          <button className={tabClassName("deposit")} onClick={() => handleTabClick("deposit")}>{icon(0x1F4B0)} Booking Payment</button>
          <button className={tabClassName("cashflow")} onClick={() => handleTabClick("cashflow")}>{icon(0x1F4DD)} Cashflow</button>
          <button className={tabClassName("timeline")} onClick={() => handleTabClick("timeline")}>{icon(0x1F4F8)} Timeline</button>
          <button className={tabClassName("summary")} onClick={() => handleTabClick("summary")}>{icon(0x1F6E1, true)} Summary Backup</button>
          <button className={tabClassName("monitoring")} onClick={() => handleTabClick("monitoring")}><div className="admin-tab-content"><span>{icon(0x1F5A5, true)} Monitoring</span>{monitoringIssueCount > 0 && <span className="admin-monitoring-badge">{monitoringIssueCount}</span>}</div></button>
          <button className={tabClassName("activity")} onClick={() => handleTabClick("activity")}>{icon(0x1F4CB)} Activity</button>
          <button className={tabClassName("settings")} onClick={() => handleTabClick("settings")}>{icon(0x2699, true)} Settings</button>
        </div>
        {tab === "overview" && <OverviewTab key={`overview-${tabRefreshKey}`} personal={personal} payments={payments} trashRecords={trashRecords} cashflows={cashflows} sortedDeposits={sortedDeposits} currentPeriod={currentPeriod} appConfig={appConfig} dailyBackup={{ ok: true }} monitoringIssueCount={monitoringIssueCount} getDepositStatus={getDepositStatus} onNavigate={handleTabClick} onTrashAdvanceComplete={refreshOverviewState} />}
        {tab === "personal" && <PersonalTab key={`personal-${tabRefreshKey}`} member={member} setMember={setMember} addMember={addMember} loadingAdd={loadingAdd} memberFilter={memberFilter} toggleMemberFilter={toggleMemberFilter} stats={stats} memberSearch={memberSearch} setMemberSearch={setMemberSearch} searchedPersonal={searchedPersonal} rowClassName={rowClassName} onUpdateMember={updateMemberInline} />}
        {tab === "payment" && <PaymentTab key={`payment-${tabRefreshKey}`} configError={configError} recordPayment={recordPayment} payment={payment} setPayment={setPayment} personal={personal} payments={payments} selected={selected} toggleHouse={toggleHouse} resetSelected={resetSelected} normalize={normalize} isHousePaidForPeriod={isHousePaidForPeriod} loadingPayment={loadingPayment} paymentProgress={paymentProgress} wakeLock={wakeLock} />}
        {tab === "deposit" && <DepositTab key={`deposit-${tabRefreshKey}`} saveDeposit={saveDeposit} depositForm={depositForm} setDepositForm={setDepositForm} activePersons={activePersons} depositAmount={depositAmount} selectedDepositPerson={selectedDepositPerson} appConfig={appConfig} nextSixPeriods={nextSixPeriods} selectedDepositPeriods={selectedDepositPeriods} savingDeposit={savingDeposit} sortedDeposits={sortedDeposits} getDepositStatus={getDepositStatus} payingDepositId={payingDepositId} payments={payments} normalize={normalize} payDeposit={payDeposit} onBatchComplete={refreshBookingState} onBatchStatusChange={setBookingBatchLoading} wakeLock={wakeLock} />}
        {tab === "cashflow" && <CashflowTab key={`cashflow-${tabRefreshKey}`} addCashflow={addCashflow} cashflow={cashflow} setCashflow={setCashflow} loadingCashflow={loadingCashflow} />}
        {tab === "timeline" && <TimelineTab key={`timeline-${tabRefreshKey}`} showPopup={showPopup} />}
        {tab === "summary" && <SummaryBackupTab key={`summary-${tabRefreshKey}`} />}
        {tab === "monitoring" && <MonitoringTab key={`monitoring-${tabRefreshKey}`} paymentCashflowIntegrity={paymentCashflowIntegrity} trashMismatch={trashMismatch} trashAdvanceReimbursementIntegrity={trashAdvanceReimbursementIntegrity} depositPaymentIntegrity={depositPaymentIntegrity} suspiciousData={suspiciousData} onRepairComplete={refreshMonitoringState} />}
        {tab === "activity" && <AdminActivityPanel key={`activity-${tabRefreshKey}`} />}
        {tab === "settings" && <SettingsTab key={`settings-${tabRefreshKey}`} />}
      </div>
    </>
  );
}
