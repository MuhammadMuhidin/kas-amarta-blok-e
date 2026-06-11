"use client";

import AdminActivityPanel from "@/components/AdminActivityPanel";
import CashflowTab from "@/components/admin/tabs/CashflowTab";
import DepositTab from "@/components/admin/tabs/DepositTab";
import MonitoringTab from "@/components/admin/tabs/MonitoringTab";
import OverviewTab from "@/components/admin/tabs/OverviewTab";
import PaymentTab from "@/components/admin/tabs/PaymentTab";
import PersonalTab from "@/components/admin/tabs/PersonalTab";
import RoleManagementTab from "@/components/admin/tabs/RoleManagementTab";
import SettingsTab from "@/components/admin/tabs/SettingsTab";
import SummaryBackupTab from "@/components/admin/tabs/SummaryBackupTab";
import TimelineTab from "@/components/admin/tabs/TimelineTab";
import Toast from "@/components/Toast";
import { sendJson } from "@/components/admin/adminClientApi";
import { getCurrentPeriod } from "@/lib/depositUtils";
import { ADMIN_MODULES } from "@/lib/adminModules";
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
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function normalize(value) {
  return String(value || "").trim();
}

const icon = (codePoint, emoji = false) => `${String.fromCodePoint(codePoint)}${emoji ? String.fromCodePoint(0xfe0f) : ""}`;

const MODULE_ICONS = {
  overview: icon(0x1F4CC),
  personal: icon(0x1F464),
  payment: icon(0x1F4B3),
  deposit: icon(0x1F4B0),
  cashflow: icon(0x1F4DD),
  timeline: icon(0x1F4F8),
  summary: icon(0x1F6E1, true),
  monitoring: icon(0x1F5A5, true),
  activity: icon(0x1F4CB),
  role_management: icon(0x1F9E9),
  settings: icon(0x2699, true),
};

function getAllowedModules(moduleKeys = []) {
  const allowed = new Set(moduleKeys || []);
  return ADMIN_MODULES.filter((module) => allowed.has(module.key));
}

export default function AdminPageClient() {
  const router = useRouter();
  const currentPeriod = getCurrentPeriod();
  const [bootLoading, setBootLoading] = useState(true);
  const [sessionInfo, setSessionInfo] = useState({ access_role: "admin", modules: ["overview"] });
  const [payment, setPayment] = useState({ period: "", amount: "" });
  const [depositForm, setDepositForm] = useState({ person_id: "", end_period: "" });
  const [bookingBatchLoading, setBookingBatchLoading] = useState(false);

  const allowedModules = useMemo(
    () => getAllowedModules(sessionInfo.modules),
    [sessionInfo.modules],
  );
  const allowedTabKeys = useMemo(
    () => allowedModules.map((module) => module.key),
    [allowedModules],
  );

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
  } = useAdminTabs(refreshTabData, allowedTabKeys);

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

  function canAccess(moduleKey) {
    return allowedTabKeys.includes(moduleKey);
  }

  async function refreshBookingState() {
    await Promise.all([loadDeposit(), loadPayment(), loadTrash(), loadCashflow()]);
  }

  async function refreshMonitoringState() {
    await Promise.all([loadPayment(), loadTrash(), loadCashflow()]);
  }

  async function refreshOverviewState() {
    await Promise.all([loadPayment(), loadTrash(), loadCashflow()]);
  }

  async function refreshPaymentProofState() {
    await Promise.all([loadPayment(), loadTrash(), loadCashflow()]);
  }

  useEffect(() => {
    async function bootstrap() {
      const session = await checkSession();
      if (!session) return;

      setSessionInfo({
        access_role: session.access_role || "admin",
        modules: session.modules?.length ? session.modules : ["overview"],
      });

      try {
        await Promise.all([loadAppConfig(), loadPersonal(), loadPayment(), loadCashflow(), loadTrash(), loadDeposit()]);
      } finally {
        setBootLoading(false);
      }
    }
    bootstrap();
  }, []);

  useEffect(() => {
    if (!canAccess(tab)) return;
    refreshTabData(tab);
  }, [tab, allowedTabKeys.join("|")]);

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
          {allowedModules.map((module) => (
            <button key={module.key} className={tabClassName(module.key)} onClick={() => handleTabClick(module.key)}>
              {(module.key === "payment" || module.key === "monitoring") ? (
                <div className="admin-tab-content">
                  <span>{MODULE_ICONS[module.key]} {module.label}</span>
                  {module.key === "payment" && pendingCurrentDeposits.length > 0 && <span className="admin-deposit-badge">{pendingCurrentDeposits.length} booking pending</span>}
                  {module.key === "monitoring" && monitoringIssueCount > 0 && <span className="admin-monitoring-badge">{monitoringIssueCount}</span>}
                </div>
              ) : `${MODULE_ICONS[module.key]} ${module.label}`}
            </button>
          ))}
        </div>
        {tab === "overview" && canAccess("overview") && <OverviewTab key={`overview-${tabRefreshKey}`} personal={personal} payments={payments} trashRecords={trashRecords} cashflows={cashflows} sortedDeposits={sortedDeposits} currentPeriod={currentPeriod} appConfig={appConfig} dailyBackup={{ ok: true }} monitoringIssueCount={monitoringIssueCount} getDepositStatus={getDepositStatus} onNavigate={handleTabClick} onTrashAdvanceComplete={refreshOverviewState} />}
        {tab === "personal" && canAccess("personal") && <PersonalTab key={`personal-${tabRefreshKey}`} member={member} setMember={setMember} addMember={addMember} loadingAdd={loadingAdd} memberFilter={memberFilter} toggleMemberFilter={toggleMemberFilter} stats={stats} memberSearch={memberSearch} setMemberSearch={setMemberSearch} searchedPersonal={searchedPersonal} rowClassName={rowClassName} onUpdateMember={updateMemberInline} />}
        {tab === "payment" && canAccess("payment") && <PaymentTab key={`payment-${tabRefreshKey}`} configError={configError} recordPayment={recordPayment} payment={payment} setPayment={setPayment} personal={personal} payments={payments} selected={selected} toggleHouse={toggleHouse} resetSelected={resetSelected} normalize={normalize} isHousePaidForPeriod={isHousePaidForPeriod} loadingPayment={loadingPayment} paymentProgress={paymentProgress} wakeLock={wakeLock} onPaymentProofReviewed={refreshPaymentProofState} />}
        {tab === "deposit" && canAccess("deposit") && <DepositTab key={`deposit-${tabRefreshKey}`} saveDeposit={saveDeposit} depositForm={depositForm} setDepositForm={setDepositForm} activePersons={activePersons} depositAmount={depositAmount} selectedDepositPerson={selectedDepositPerson} appConfig={appConfig} nextSixPeriods={nextSixPeriods} selectedDepositPeriods={selectedDepositPeriods} savingDeposit={savingDeposit} sortedDeposits={sortedDeposits} getDepositStatus={getDepositStatus} payingDepositId={payingDepositId} payments={payments} normalize={normalize} payDeposit={payDeposit} onBatchComplete={refreshBookingState} onBatchStatusChange={setBookingBatchLoading} wakeLock={wakeLock} />}
        {tab === "cashflow" && canAccess("cashflow") && <CashflowTab key={`cashflow-${tabRefreshKey}`} addCashflow={addCashflow} cashflow={cashflow} setCashflow={setCashflow} loadingCashflow={loadingCashflow} />}
        {tab === "timeline" && canAccess("timeline") && <TimelineTab key={`timeline-${tabRefreshKey}`} showPopup={showPopup} />}
        {tab === "summary" && canAccess("summary") && <SummaryBackupTab key={`summary-${tabRefreshKey}`} />}
        {tab === "monitoring" && canAccess("monitoring") && <MonitoringTab key={`monitoring-${tabRefreshKey}`} paymentCashflowIntegrity={paymentCashflowIntegrity} trashMismatch={trashMismatch} trashAdvanceReimbursementIntegrity={trashAdvanceReimbursementIntegrity} depositPaymentIntegrity={depositPaymentIntegrity} suspiciousData={suspiciousData} onRepairComplete={refreshMonitoringState} />}
        {tab === "activity" && canAccess("activity") && <AdminActivityPanel key={`activity-${tabRefreshKey}`} />}
        {tab === "role_management" && canAccess("role_management") && <RoleManagementTab key={`role-management-${tabRefreshKey}`} />}
        {tab === "settings" && canAccess("settings") && <SettingsTab key={`settings-${tabRefreshKey}`} />}
      </div>
    </>
  );
}
