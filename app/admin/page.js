"use client";

import AdminActivityPanel from "@/components/AdminActivityPanel";
import AdminSettings from "@/components/AdminSettings";
import Toast from "@/components/Toast";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import "./page.css";

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

  const normalize = (v) => String(v || "").trim();
  const currentPeriod = new Date().toISOString().slice(0, 7);

  function getCookie(name) {
    return document.cookie
      .split("; ")
      .find((row) => row.startsWith(name + "="))
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

  function getCurrentPeriod() {
    return new Date().toISOString().slice(0, 7);
  }

  function addMonths(period, count) {
    const [year, month] = period.split("-").map(Number);
    const date = new Date(year, month - 1 + count, 1);

    return date.toISOString().slice(0, 7);
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

  function getDepositStatus(d) {
    const isPaid =
      normalize(d.status).toLowerCase() === "paid" &&
      normalize(d.paid_at) !== "" &&
      normalize(d.payment_id) !== "";

    if (isPaid) return "paid";
    if (normalize(d.period) > currentPeriod) return "waiting";
    if (normalize(d.period) < currentPeriod) return "missed";

    return "pending";
  }

  function isNewActiveMember(p) {
    if (p.active !== "Y") return false;
    if (!p.join_date) return false;

    const joinMonth = String(p.join_date).slice(0, 7);
    const currentMonth = new Date().toISOString().slice(0, 7);

    return joinMonth > currentMonth;
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
          success++;
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
    return personal
      .filter((p) => p.active === "Y")
      .sort((a, b) =>
        a.house.localeCompare(b.house, undefined, { numeric: true }),
      );
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
    return personal.reduce(
      (acc, p) => {
        if (p.active === "Y") acc.active++;
        else acc.inactive++;

        if (p.trash === "Y") acc.trashActive++;
        else acc.trashInactive++;

        return acc;
      },
      { active: 0, inactive: 0, trashActive: 0, trashInactive: 0 },
    );
  }, [personal]);

  const MONITORING_START_PERIOD = appConfig?.start_monitoring_date || "";

  const trashMismatch = useMemo(() => {
    const issues = [];
    const monitoredPayments = payments.filter(
      (p) => p.period && p.period >= MONITORING_START_PERIOD,
    );
    const trashPaymentIds = new Set(
      trashRecords.map((t) => normalize(t.payment_id)),
    );
    const personalMap = new Map(personal.map((p) => [normalize(p.id), p]));
    const paymentMap = new Map(payments.map((p) => [normalize(p.id), p]));

    monitoredPayments.forEach((pay) => {
      const person = personalMap.get(normalize(pay.person_id));

      if (!person) {
        issues.push({
          type: "MISSING_PERSON",
          house: "-",
          name: "-",
          period: pay.period,
          detail: `Payment references missing person_id: ${pay.person_id}`,
        });
        return;
      }

      const isTrashUser = normalize(person.trash).toUpperCase() === "Y";
      const hasTrash = trashPaymentIds.has(normalize(pay.id));

      if (isTrashUser && !hasTrash) {
        issues.push({
          type: "PAYMENT_WITHOUT_TRASH",
          house: person.house || "-",
          name: person.name || "-",
          period: pay.period,
          detail: "Missing required trash record",
        });
      }

      if (!isTrashUser && hasTrash) {
        issues.push({
          type: "NON_TRASH_HAS_TRASH",
          house: person.house || "-",
          name: person.name || "-",
          period: pay.period,
          detail: "Non-trash user linked to trash record",
        });
      }
    });

    trashRecords.forEach((t) => {
      const tPaymentId = normalize(t.payment_id);
      const payment = paymentMap.get(tPaymentId);

      if (!payment) {
        issues.push({
          type: "ORPHAN_TRASH_RECORD",
          house: "-",
          name: "-",
          period: `Payment ID: ${tPaymentId}`,
          detail: "Trash record references invalid payment",
        });
        return;
      }

      if (payment.period < MONITORING_START_PERIOD) return;

      const person = personalMap.get(normalize(payment.person_id));

      if (!person) {
        issues.push({
          type: "MISSING_PERSON",
          house: "-",
          name: "-",
          period: payment.period,
          detail: `Payment references missing person_id: ${payment.person_id}`,
        });
        return;
      }

      if (normalize(person.trash).toUpperCase() !== "Y") {
        issues.push({
          type: "NON_TRASH_HAS_TRASH",
          house: person.house || "-",
          name: person.name || "-",
          period: payment.period,
          detail: "Non-trash user linked to trash record",
        });
      }
    });

    return Array.from(
      new Map(
        issues.map((i) => [
          [i.type, i.house, i.name, i.period, i.detail].join("|"),
          i,
        ]),
      ).values(),
    ).sort((a, b) => String(a.period).localeCompare(String(b.period)));
  }, [personal, payments, trashRecords, MONITORING_START_PERIOD]);

  const paymentCashflowIntegrity = useMemo(() => {
    const issues = [];
    const toNumber = (v) => Number(v || 0);
    const monthlyFee = toNumber(appConfig?.monthly_fee);
    const monitoredPayments = payments.filter(
      (p) => p.period && p.period >= MONITORING_START_PERIOD,
    );
    const paymentById = new Map(payments.map((p) => [normalize(p.id), p]));
    const paymentLinkedCashflow = cashflows.filter((c) => {
      const refId = normalize(c.ref_id);
      const datePeriod = normalize(c.date).slice(0, 7);

      if (normalize(c.type).toLowerCase() !== "income") return false;
      if (!refId) return false;
      if (refId.toUpperCase().startsWith("DIRECT")) return false;
      if (!datePeriod) return false;

      return datePeriod >= MONITORING_START_PERIOD;
    });
    const cashflowByRefId = new Map(
      paymentLinkedCashflow.map((c) => [normalize(c.ref_id), c]),
    );
    const duplicateMap = new Map();

    monitoredPayments.forEach((p) => {
      const paymentId = normalize(p.id);
      const amount = toNumber(p.amount);
      const duplicateKey = [
        normalize(p.person_id),
        normalize(p.person_house),
        normalize(p.period),
      ].join("|");

      if (!duplicateMap.has(duplicateKey)) {
        duplicateMap.set(duplicateKey, []);
      }

      duplicateMap.get(duplicateKey).push(p);

      if (monthlyFee && amount !== monthlyFee) {
        issues.push({
          type: "INVALID_PAYMENT_AMOUNT",
          house: p.person_house || "-",
          name: p.person_name || "-",
          period: p.period || "-",
          detail: `Payment amount ${amount} should be ${monthlyFee}`,
        });
      }

      const cashflow = cashflowByRefId.get(paymentId);

      if (!cashflow) {
        issues.push({
          type: "MISSING_CASHFLOW",
          house: p.person_house || "-",
          name: p.person_name || "-",
          period: p.period || "-",
          detail: `Payment ${paymentId} has no linked cashflow income`,
        });
        return;
      }

      if (toNumber(cashflow.amount) !== amount) {
        issues.push({
          type: "AMOUNT_MISMATCH",
          house: p.person_house || "-",
          name: p.person_name || "-",
          period: p.period || "-",
          detail: `Payment ${amount} but cashflow ${cashflow.amount}`,
        });
      }
    });

    paymentLinkedCashflow.forEach((c) => {
      const refId = normalize(c.ref_id);
      const payment = paymentById.get(refId);

      if (!payment) {
        issues.push({
          type: "ORPHAN_CASHFLOW",
          house: "-",
          name: "-",
          period: c.date || "-",
          detail: `Cashflow references invalid payment_id: ${refId}`,
        });
      }
    });

    duplicateMap.forEach((items) => {
      if (items.length > 1) {
        const first = items[0];
        issues.push({
          type: "DUPLICATE_PAYMENT",
          house: first.person_house || "-",
          name: first.person_name || "-",
          period: first.period || "-",
          detail: `${items.length} payments found for same house and period`,
        });
      }
    });

    return issues.sort((a, b) =>
      String(a.period).localeCompare(String(b.period)),
    );
  }, [payments, cashflows, appConfig, MONITORING_START_PERIOD]);

  const suspiciousData = useMemo(() => {
    const issues = [];

    function checkDuplicateId(sheetName, rows) {
      const map = new Map();

      rows.forEach((row, index) => {
        const id = normalize(row.id);
        if (!id) return;
        if (!map.has(id)) map.set(id, []);
        map.get(id).push(index + 2);
      });

      map.forEach((rowNumbers, id) => {
        if (rowNumbers.length > 1) {
          issues.push({
            sheet: sheetName,
            type: "DUPLICATE_ID",
            row: rowNumbers.join(", "),
            detail: `Duplicate ID: ${id}`,
          });
        }
      });
    }

    function checkEmptyFields(sheetName, rows, fields) {
      rows.forEach((row, index) => {
        const emptyFields = fields.filter(
          (field) => normalize(row[field]) === "",
        );

        if (emptyFields.length > 0) {
          issues.push({
            sheet: sheetName,
            type: "EMPTY_FIELD",
            row: index + 2,
            detail: `Empty field: ${emptyFields.join(", ")}`,
          });
        }
      });
    }

    checkDuplicateId("Personal", personal);
    checkDuplicateId("Payment", payments);
    checkDuplicateId("Cashflow", cashflows);
    checkDuplicateId("Trash", trashRecords);

    checkEmptyFields("Personal", personal, [
      "id",
      "house",
      "name",
      "trash",
      "active",
      "join_date",
    ]);

    checkEmptyFields("Payment", payments, [
      "id",
      "person_id",
      "person_house",
      "person_name",
      "period",
      "amount",
      "date",
    ]);

    checkEmptyFields("Cashflow", cashflows, [
      "id",
      "ref_id",
      "type",
      "amount",
      "note",
      "date",
    ]);

    return issues;
  }, [personal, payments, cashflows, trashRecords]);

  const filteredPersonal = useMemo(() => {
    const sorted = [...personal].sort((a, b) =>
      a.house.localeCompare(b.house, undefined, { numeric: true }),
    );

    if (!memberFilter) return sorted;
    if (memberFilter === "ACTIVE") return sorted.filter((p) => p.active === "Y");
    if (memberFilter === "INACTIVE") return sorted.filter((p) => p.active === "N");
    if (memberFilter === "TRASH_ACTIVE") {
      return sorted.filter((p) => p.active === "Y" && p.trash === "Y");
    }
    if (memberFilter === "TRASH_INACTIVE") {
      return sorted.filter((p) => p.trash !== "Y");
    }

    return sorted;
  }, [personal, memberFilter]);

  const searchedPersonal = useMemo(() => {
    const keyword = memberSearch.toLowerCase().trim();
    if (!keyword) return filteredPersonal;

    return filteredPersonal.filter((p) => {
      return (
        p.name?.toLowerCase().includes(keyword) ||
        p.house?.toLowerCase().includes(keyword)
      );
    });
  }, [filteredPersonal, memberSearch]);

  const sortedDeposits = useMemo(() => {
    const priority = {
      pending: 0,
      waiting: 1,
      missed: 2,
      paid: 3,
    };

    return [...deposits].sort((a, b) => {
      const statusCompare =
        priority[getDepositStatus(a)] - priority[getDepositStatus(b)];

      if (statusCompare !== 0) return statusCompare;

      return String(a.period).localeCompare(String(b.period));
    });
  }, [deposits]);

  function rowClassName(p, index) {
    if (p.active === "N") return "admin-row-inactive";
    if (isNewActiveMember(p)) return "admin-row-new-active";
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
          <div className="admin-card">
            <h3>Add Personal</h3>
            <form onSubmit={addMember} className="admin-form">
              <input className="admin-input" placeholder="House" value={member.house} onChange={(e) => setMember({ ...member, house: e.target.value })} />
              <input className="admin-input" placeholder="Name" value={member.name} onChange={(e) => setMember({ ...member, name: e.target.value })} />
              <select className="admin-input" value={member.trash} onChange={(e) => setMember({ ...member, trash: e.target.value })}>
                <option value="">Join trash collection?</option>
                <option value="Y">Yes</option>
                <option value="N">No</option>
              </select>
              <input className="admin-input" type="date" value={member.join_date} onChange={(e) => setMember({ ...member, join_date: e.target.value })} />
              <button className="admin-btn" disabled={loadingAdd}>{loadingAdd ? "Adding..." : "Add Member"}</button>
            </form>

            <h4>Member List</h4>
            <div className="admin-summary-cards">
              <div onClick={() => toggleMemberFilter("ACTIVE")} className={memberFilter === "ACTIVE" ? "admin-summary-card admin-summary-card-active" : "admin-summary-card"}><div>Active</div><b>{stats.active}</b></div>
              <div onClick={() => toggleMemberFilter("INACTIVE")} className={memberFilter === "INACTIVE" ? "admin-summary-card admin-summary-card-active" : "admin-summary-card"}><div>Inactive</div><b>{stats.inactive}</b></div>
              <div onClick={() => toggleMemberFilter("TRASH_ACTIVE")} className={memberFilter === "TRASH_ACTIVE" ? "admin-summary-card admin-summary-card-active" : "admin-summary-card"}><div>Trash Active</div><b>{stats.trashActive}</b></div>
              <div onClick={() => toggleMemberFilter("TRASH_INACTIVE")} className={memberFilter === "TRASH_INACTIVE" ? "admin-summary-card admin-summary-card-active" : "admin-summary-card"}><div>Trash Inactive</div><b>{stats.trashInactive}</b></div>
            </div>

            <input type="text" placeholder="Search name or house..." value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} className="admin-search-input" />

            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead><tr><th className="admin-th">ID</th><th className="admin-th">House</th><th className="admin-th">Name</th><th className="admin-th">Trash</th><th className="admin-th">Active</th><th className="admin-th">Join Date</th></tr></thead>
                <tbody>
                  {searchedPersonal.map((p, i) => (
                    <tr key={p.id} className={rowClassName(p, i)}>
                      <td className="admin-td">{p.id}</td><td className="admin-td">{p.house}</td><td className="admin-td">{p.name}</td><td className="admin-td">{p.trash}</td><td className="admin-td">{p.active}</td><td className="admin-td">{p.join_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "payment" && (
          <>
            {configError && <div className="admin-error-box">{configError}</div>}
            <div className="admin-card">
              <h3>Bulk Payment</h3>
              <form onSubmit={recordPayment} className="admin-form">
                <input className="admin-input" placeholder="Period (2026-02)" value={payment.period} onChange={(e) => setPayment({ ...payment, period: e.target.value })} />
                <input className="admin-input admin-readonly-input" type="number" value={payment.amount} readOnly aria-readonly="true" />
                <div className="admin-house-list">
                  {personal
                    .filter((p) => p.active === "Y")
                    .sort((a, b) => a.house.localeCompare(b.house, undefined, { numeric: true }))
                    .map((p) => {
                      const period = normalize(payment.period);
                      const joinPeriod = normalize(p.join_date).slice(0, 7);
                      const alreadyPaid = isHousePaidForPeriod(p);
                      const notJoined = period && joinPeriod && period < joinPeriod;
                      const disabledChip = alreadyPaid || notJoined;
                      const chipClass = [
                        "admin-checkbox-chip",
                        selected.includes(p.id) ? "admin-checkbox-chip-active" : "",
                        disabledChip ? "admin-checkbox-chip-disabled" : "",
                      ].filter(Boolean).join(" ");

                      return (
                        <label key={p.id} title={alreadyPaid ? "Already paid for this period" : notJoined ? "Not joined yet for this period" : ""} className={chipClass}>
                          <input type="checkbox" className="admin-checkbox-input" checked={selected.includes(p.id)} disabled={disabledChip} onChange={() => toggleHouse(p.id)} />
                          <div className="admin-house-chip-content">
                            <div className="admin-house-chip-house">{p.house}</div>
                            {alreadyPaid && <div className="admin-house-chip-paid">Paid</div>}
                            {notJoined && <div className="admin-house-chip-paid">Not join</div>}
                          </div>
                        </label>
                      );
                    })}
                </div>
                <button className="admin-btn" disabled={loadingPayment}>{loadingPayment ? "Recording..." : "Record Payment"}</button>
              </form>
            </div>
          </>
        )}

        {tab === "deposit" && (
          <div className="admin-card">
            <h3>Deposit Balance</h3>
            <form onSubmit={saveDeposit} className="admin-form">
              <select className="admin-input" value={depositForm.person_id} onChange={(e) => setDepositForm({ ...depositForm, person_id: e.target.value, end_period: "" })}>
                <option value="">Select active house</option>
                {activePersons.map((p) => <option key={p.id} value={p.id}>{p.house} - {p.name}</option>)}
              </select>
              <input className="admin-input admin-readonly-input" value={`Rp${depositAmount.toLocaleString("id-ID")}`} readOnly />
              {selectedDepositPerson && <div className="admin-deposit-meta">{(selectedDepositPerson.trash || "").toUpperCase() === "Y" ? `Layanan: Kas + Sampah. Sampah dicatat terpisah Rp${Number(appConfig?.trash_fee || 0).toLocaleString("id-ID")} saat Pay Now.` : "Layanan: Kas"}</div>}
              <div className="admin-deposit-chips">
                {nextSixPeriods.map((period) => {
                  const active = selectedDepositPeriods.includes(period);
                  return <button key={period} type="button" className={active ? "admin-deposit-chip admin-deposit-chip-active" : "admin-deposit-chip"} onClick={() => setDepositForm({ ...depositForm, end_period: period })} disabled={!depositForm.person_id}>{period}</button>;
                })}
              </div>
              <button className="admin-btn" disabled={savingDeposit}>{savingDeposit ? "Saving..." : "Save Deposit"}</button>
            </form>

            <h4>Deposit List</h4>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead><tr><th className="admin-th">House</th><th className="admin-th">Name</th><th className="admin-th">Period</th><th className="admin-th">Amount</th><th className="admin-th">Status</th><th className="admin-th">Action</th></tr></thead>
                <tbody>
                  {sortedDeposits.map((d, i) => {
                    const depositStatus = getDepositStatus(d);
                    const isPayingThisDeposit = payingDepositId === d.id;
                    const paymentExists = payments.some((p) => normalize(p.person_id) === normalize(d.person_id) && normalize(p.person_house) === normalize(d.house) && normalize(p.period) === normalize(d.period));
                    const canPay = depositStatus === "pending";
                    const buttonText = depositStatus === "paid" ? "Paid" : depositStatus === "waiting" ? "Waiting" : depositStatus === "missed" ? paymentExists ? "Paid" : "Unpaid" : "Pay Now";
                    const statusClass = `admin-deposit-status admin-deposit-status-${depositStatus}`;
                    const buttonClass = buttonText === "Paid" ? "admin-small-btn admin-small-btn-paid" : "admin-small-btn";

                    return (
                      <tr key={d.id || i} className={i % 2 ? "admin-row-alt" : ""}>
                        <td className="admin-td">{d.house}</td><td className="admin-td">{d.name}</td><td className="admin-td">{d.period}</td><td className="admin-td">Rp{Number(d.amount || 0).toLocaleString("id-ID")}</td><td className="admin-td"><span className={statusClass}>{depositStatus}</span></td><td className="admin-td"><button type="button" className={buttonClass} disabled={!canPay || isPayingThisDeposit || savingDeposit} onClick={() => payDeposit(d.id)}>{isPayingThisDeposit ? "Paying..." : buttonText}</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "cashflow" && (
          <div className="admin-card">
            <h3>Cashflow</h3>
            <form onSubmit={addCashflow} className="admin-form">
              <select className="admin-input" value={cashflow.type} onChange={(e) => setCashflow({ ...cashflow, type: e.target.value })}><option value="">Type</option><option value="income">Income</option><option value="expense">Expense</option></select>
              <input className="admin-input" placeholder="Amount" value={cashflow.amount} onChange={(e) => setCashflow({ ...cashflow, amount: e.target.value })} />
              <input className="admin-input" placeholder="Note" value={cashflow.note} onChange={(e) => setCashflow({ ...cashflow, note: e.target.value })} />
              <button className="admin-btn" disabled={loadingCashflow}>{loadingCashflow ? "Recording..." : "Record Transaction"}</button>
            </form>
          </div>
        )}

        {tab === "summary" && (
          <div className="admin-card">
            <div className="admin-summary-header"><h3>Summary Backup</h3></div>
            {loadingSummary ? <p>Loading summary...</p> : (
              <div className="admin-table-wrapper"><table className="admin-table"><thead><tr><th className="admin-th">Date</th><th className="admin-th">Income</th><th className="admin-th">Expense</th><th className="admin-th">Net</th><th className="admin-th">Personal Active</th></tr></thead><tbody>{summaryBackup.map((x, i) => <tr key={i} className={i % 2 ? "admin-row-alt" : ""}><td className="admin-td">{x.created_at}</td><td className="admin-td">Rp{Number(x.total_income || 0).toLocaleString()}</td><td className="admin-td">Rp{Number(x.total_expense || 0).toLocaleString()}</td><td className="admin-td">Rp{Number(x.net_saldo || 0).toLocaleString()}</td><td className="admin-td">{x.total_personal_active}</td></tr>)}</tbody></table></div>
            )}
          </div>
        )}

        {tab === "monitoring" && (
          <div className="admin-card">
            <div className="admin-monitor-grid">
              <StatusCard label="Daily Backup Status" value={loadingDailyBackup ? "Checking..." : dailyBackup?.ok ? dailyBackup.name : "Backup file not found"} meta={dailyBackup?.ok ? [`Last created: ${dailyBackup.created_at}`, `Retention: ${dailyBackup?.count} backup files`] : []} error={!loadingDailyBackup && !dailyBackup?.ok} />
              <StatusCard label="Payment Cashflow Integrity" value={`${paymentCashflowIntegrity.length} issue`} meta={[paymentCashflowIntegrity.length === 0 ? "No issue detected" : "Need review"]} />
              <StatusCard label="Trash Payment Integrity" value={`${trashMismatch.length} issue`} meta={[trashMismatch.length === 0 ? "No issue detected" : "Need review"]} />
              <StatusCard label="Data Quality Check" value={`${suspiciousData.length} issue`} meta={[suspiciousData.length === 0 ? "No suspicious data" : "Need review"]} />
            </div>

            <IssueTable title="Payment Cashflow Integrity" rows={paymentCashflowIntegrity} columns={["house", "name", "period", "type", "detail"]} />
            <IssueTable title="Trash Payment Integrity" rows={trashMismatch} columns={["house", "name", "period", "detail"]} />
            <IssueTable title="Suspicious Data" rows={suspiciousData} columns={["sheet", "row", "type", "detail"]} />
          </div>
        )}

        {tab === "activity" && <AdminActivityPanel />}
        {tab === "settings" && <AdminSettings />}
      </div>
    </>
  );
}

function StatusCard({ label, value, meta = [], error = false }) {
  return (
    <div className="admin-status-card">
      <div className="admin-status-label">{label}</div>
      <div className={error ? "admin-status-error" : "admin-status-value"}>{value}</div>
      {meta.map((item) => <div key={item} className="admin-status-meta">{item}</div>)}
    </div>
  );
}

function IssueTable({ title, rows, columns }) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="admin-monitor-detail">
      <h3>{title}</h3>
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>{columns.map((column) => <th key={column} className="admin-th">{column === "detail" ? "Issue" : column}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={i % 2 ? "admin-row-alt" : ""}>
                {columns.map((column) => <td key={column} className="admin-td admin-issue-text">{row[column]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
