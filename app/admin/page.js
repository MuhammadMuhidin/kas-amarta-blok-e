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
import AdminLoading from "./loading";

function normalize(value) {
  return String(value || "").trim();
}

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState("personal");
  const [tabRefreshKey, setTabRefreshKey] = useState(0);
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

  const [bootLoading, setBootLoading] = useState(true);
  const [dailyBackup, setDailyBackup] = useState(null);
  const [loadingDailyBackup, setLoadingDailyBackup] = useState(false);
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
      return false;
    }
    return true;
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
    if (nextTab === "personal") {
      await loadPersonal();
      return;
    }

    if (nextTab === "payment") {
      await Promise.all([loadAppConfig(), loadPayment(), loadDeposit()]);
      return;
    }

    if (nextTab === "deposit") {
      await Promise.all([
        loadAppConfig(),
        loadPersonal(),
        loadDeposit(),
        loadPayment(),
        loadTrash(),
        loadCashflow(),
      ]);
      return;
    }

    if (nextTab === "cashflow") {
      await loadCashflow();
      return;
    }

    if (nextTab === "monitoring") {
      await refreshMonitoring();
      return;
    }

    if (nextTab === "settings") {
      await loadAppConfig();
    }
  }

  function handleTabClick(nextTab) {
    if (tab === nextTab) {
      setTabRefreshKey((prev) => prev + 1);
      refreshTabData(nextTab);
      return;
    }

    setTab(nextTab);
  }

  async function addMember(e) {
    e.preventDefault();

    if (
      !member.house.trim() ||
      !member.name.trim() ||
      !member.trash.trim() ||
      !member.join_date.trim()
    ) {
      showPopup("Lengkapi semua data member terlebih dahulu", "error");
      return;
    }

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
        showPopup("Member berhasil ditambahkan", "success");
        setMember({ house: "", name: "", join_date: "", trash: "" });
        loadPersonal();
      } else {
        const data = await res.json();
        showPopup(data.error || "Gagal menambahkan member", "error");
      }
    } finally {
      setLoadingAdd(false);
    }
  }

  async function updateMemberInline(person, field, value) {
    const currentValue = normalize(person?.[field]);
    const nextValue = normalize(value).toUpperCase();

    if (!person?.id || !["trash", "active"].includes(field)) return;
    if (!nextValue || currentValue === nextValue) return;

    const csrfToken = getCookie("csrf_token");
    const previousPersonal = personal;

    setPersonal((prev) =>
      prev.map((item) =>
        item.id === person.id
          ? {
              ...item,
              [field]: nextValue,
            }
          : item,
      ),
    );

    try {
      const res = await fetch("/api/sheets/personal", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          id: person.id,
          field,
          value: nextValue,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal memperbarui data member");
      }

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
                person_id: p.id,
                house: p.house,
                name: p.name,
                period: payment.period,
                amount: appConfig.trash_fee,
                source: "payment",
              }),
            });
          }
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
        throw new Error(data.error || "Gagal menyimpan data booking");
      }

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
        throw new Error(data.error || "Gagal membayarkan data booking");
      }

      showPopup("Booking payment berhasil dibayarkan", "success");

      await Promise.all([
        loadDeposit(),
        loadPayment(),
        loadTrash(),
        loadCashflow(),
      ]);
    } catch (err) {
      showPopup(err.message || "Gagal membayarkan data booking", "error");
    } finally {
      setPayingDepositId("");
    }
  }

  async function addCashflow(e) {
    e.preventDefault();

    if (
      !cashflow.type.trim() ||
      !String(cashflow.amount || "").trim() ||
      !cashflow.note.trim()
    ) {
      showPopup("Lengkapi jenis, nominal dan catatan transaksi", "error");
      return;
    }

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
        showPopup("Transaksi berhasil dicatat", "success");
        setCashflow({ type: "", amount: "", note: "" });
        await loadCashflow();
      } else {
        const data = await res.json();
        showPopup(data.error || "Gagal mencatat transaksi", "error");
      }
    } finally {
      setLoadingCashflow(false);
    }
  }

useEffect(() => {
  async function bootstrap() {
    const validSession = await checkSession();

    if (!validSession) return;

    try {
      await Promise.all([
        loadAppConfig(),
        loadPersonal(),
        loadDailyBackupStatus(),
        loadPayment(),
        loadCashflow(),
        loadTrash(),
        loadDeposit(),
      ]);
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

  const monitoringIssueCount = useMemo(() => {
    return (
      trashMismatch.length +
      paymentCashflowIntegrity.length +
      suspiciousData.length
    );
  }, [trashMismatch, paymentCashflowIntegrity, suspiciousData]);

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

  if (bootLoading) {
    return <AdminLoading />;
  }

  return (
    <>
      <Toast show={!!popup} type={popup?.type} message={popup?.text} />

      <div className="admin-wrapper">
        <div className="admin-header">
          <button className="admin-home-btn" onClick={() => router.push("/")}>🏠 Home</button>
          <h1 className="admin-title">Cash Flow Management</h1>
        </div>

        <div className="admin-tabs">
          <button className={tabClassName("personal")} onClick={() => handleTabClick("personal")}>👤 Member</button>
          <button className={tabClassName("payment")} onClick={() => handleTabClick("payment")}>
            <div className="admin-tab-content">
              <span>💳 Payment</span>
              {pendingCurrentDeposits.length > 0 && (
                <span className="admin-deposit-badge">
                  {pendingCurrentDeposits.length} booking pending
                </span>
              )}
            </div>
          </button>
          <button className={tabClassName("deposit")} onClick={() => handleTabClick("deposit")}>💰 Booking Payment</button>
          <button className={tabClassName("cashflow")} onClick={() => handleTabClick("cashflow")}>📝 Cashflow</button>
          <button className={tabClassName("summary")} onClick={() => handleTabClick("summary")}>🛡️ Summary Backup</button>
          <button
            className={tabClassName("monitoring")}
            onClick={() => handleTabClick("monitoring")}
          >
            <div className="admin-tab-content">
              <span>🖥️ Monitoring</span>
          
              {monitoringIssueCount > 0 && (
                <span className="admin-monitoring-badge">
                  {monitoringIssueCount}
                </span>
              )}
            </div>
          </button>
          <button className={tabClassName("activity")} onClick={() => handleTabClick("activity")}>📋 Activity</button>
          <button className={tabClassName("settings")} onClick={() => handleTabClick("settings")}>⚙️ Settings</button>
        </div>

        {tab === "personal" && (
          <PersonalTab
            key={`personal-${tabRefreshKey}`}
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
            onUpdateMember={updateMemberInline}
          />
        )}

        {tab === "payment" && (
          <PaymentTab
            key={`payment-${tabRefreshKey}`}
            configError={configError}
            recordPayment={recordPayment}
            payment={payment}
            setPayment={setPayment}
            personal={personal}
            payments={payments}
            selected={selected}
            toggleHouse={toggleHouse}
            normalize={normalize}
            isHousePaidForPeriod={isHousePaidForPeriod}
            loadingPayment={loadingPayment}
          />
        )}

        {tab === "deposit" && (
          <DepositTab
            key={`deposit-${tabRefreshKey}`}
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
            key={`cashflow-${tabRefreshKey}`}
            addCashflow={addCashflow}
            cashflow={cashflow}
            setCashflow={setCashflow}
            loadingCashflow={loadingCashflow}
          />
        )}

        {tab === "summary" && <SummaryBackupTab key={`summary-${tabRefreshKey}`} />}

        {tab === "monitoring" && (
          <MonitoringTab
            key={`monitoring-${tabRefreshKey}`}
            loadingDailyBackup={loadingDailyBackup}
            dailyBackup={dailyBackup}
            paymentCashflowIntegrity={paymentCashflowIntegrity}
            trashMismatch={trashMismatch}
            suspiciousData={suspiciousData}
          />
        )}

        {tab === "activity" && <AdminActivityPanel key={`activity-${tabRefreshKey}`} />}
        {tab === "settings" && <AdminSettings key={`settings-${tabRefreshKey}`} />}
      </div>
    </>
  );
}
