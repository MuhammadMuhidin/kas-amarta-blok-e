"use client";

import AdminSettings from "@/components/AdminSettings";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

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

  function getCookie(name) {
    return document.cookie
      .split("; ")
      .find((row) => row.startsWith(name + "="))
      ?.split("=")[1];
  }

  function showPopup(text, type = "success") {
    setPopup({
      text,
      type,
    });

    setTimeout(() => {
      setPopup(null);
    }, 2500);
  }

function isHousePaidForPeriod(person) {
  const period = normalize(payment.period);

  if (!period) {
    return false;
  }

  return payments.some((p) => {
    const samePeriod = normalize(p.period) === period;
    const samePerson = normalize(p.person_id) === normalize(person.id);
    const sameHouse = normalize(p.person_house) === normalize(person.house);

    return samePeriod && (samePerson || sameHouse);
  });
}

  function getCurrentPeriod() {
    return new Date().toISOString().slice(0, 7);
  }

  function addMonths(period, count) {
    const [year, month] = period.split("-").map(Number);
    const date = new Date(year, month - 1 + count, 1);

    return date.toISOString().slice(0, 7);
  }

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
        a.house.localeCompare(b.house, undefined, {
          numeric: true,
        }),
      );
  }, [personal]);

  const selectedDepositPerson = useMemo(() => {
    return personal.find(
      (p) => p.id === depositForm.person_id,
    );
  }, [personal, depositForm.person_id]);

  const depositAmount = useMemo(() => {
    if (!appConfig) return 0;

    return Number(appConfig.monthly_fee || 0);
  }, [appConfig]);

  const normalize = (v) => String(v || "").trim();

  const currentPeriod = new Date()
    .toISOString()
    .slice(0, 7);

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

  const pendingCurrentDeposits = useMemo(() => {
    return deposits.filter(
      (d) =>
        d.period === currentPeriod &&
        d.status !== "paid",
    );
  }, [deposits, currentPeriod]);

  function isNewActiveMember(p) {
    if (p.active !== "Y") return false;
    if (!p.join_date) return false;

    const joinMonth = String(p.join_date).slice(0, 7);

    const currentMonth = new Date().toISOString().slice(0, 7);

    return joinMonth > currentMonth;
  }

  async function loadAppConfig() {
    try {
      setConfigError("");

      const res = await fetch("/api/admin/settings/app", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Failed load a configuration",
        );
      }

      setAppConfig(data.config);

      setPayment((prev) => ({
        ...prev,
        amount: data.config.monthly_fee,
      }));
    } catch (err) {
      setAppConfig(null);
      setConfigError(
        err.message || "Failed load a configuration",
      );
    }
  }

  async function loadPersonal() {
    const res = await fetch("/api/sheets/personal", {
      cache: "no-store",
      method: "GET",
    });

    const data = await res.json();

    setPersonal(data);
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

  async function refreshMonitoring() {
    await Promise.all([
      loadAppConfig(),
      loadDailyBackupStatus(),
      loadPayment(),
      loadTrash(),
      loadPersonal(),
      loadCashflow(),
      loadDeposit()
    ]);
  }

  useEffect(() => {
    loadAppConfig();
    loadPersonal();
    loadDailyBackupStatus();
    loadSummaryBackup();
    loadPayment();
    loadCashflow();
    loadTrash();
    loadDeposit()
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

        setMember({
          house: "",
          name: "",
          join_date: "",
          trash: "",
        });

        loadPersonal();
      } else {
        showPopup("Failed to add member", "error");
      }
    } finally {
      setLoadingAdd(false);
    }
  }

function toggleHouse(id) {
  const person = personal.find((p) => p.id === id);

  if (!person) return;

  if (isHousePaidForPeriod(person)) {
    return;
  }

  if (selected.includes(id)) {
    setSelected(selected.filter((x) => x !== id));
  } else {
    setSelected([...selected, id]);
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
            const csrfToken = getCookie("csrf_token");
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
      setPayment({
        period: "",
        amount: appConfig.monthly_fee,
      });
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
      setDepositForm({
        person_id: "",
        end_period: "",
      });

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
        body: JSON.stringify({
          id,
          action: "PAY_NOW",
        }),
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

        setCashflow({
          type: "",
          amount: "",
          note: "",
        });
      } else {
        showPopup("Failed to record transaction", "error");
      }
    } finally {
      setLoadingCashflow(false);
    }
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

  async function loadCashflow() {
    const res = await fetch("/api/sheets/cashflow", {
      cache: "no-store",
      method: "GET",
    });

    const data = await res.json();

    setCashflows(data || []);
  }

  function toggleMemberFilter(type) {
    setMemberFilter((prev) => (prev === type ? "" : type));
  }

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

    /* =========================================
     NORMALIZE
  ========================================= */

    const normalize = (v) => String(v || "").trim();

    /* =========================================
     PAYMENT YANG DIMONITOR
  ========================================= */

    const monitoredPayments = payments.filter(
      (p) => p.period && p.period >= MONITORING_START_PERIOD,
    );

    /* =========================================
     FAST LOOKUP
  ========================================= */

    // payment.id yang punya trash record
    const trashPaymentIds = new Set(
      trashRecords.map((t) => normalize(t.payment_id)),
    );

    // personal by id
    const personalMap = new Map(personal.map((p) => [normalize(p.id), p]));

    // payment by id
    const paymentMap = new Map(payments.map((p) => [normalize(p.id), p]));

    /* =========================================
     CASE 1 & 2
     VALIDASI PAYMENT TERHADAP USER
  ========================================= */

    monitoredPayments.forEach((pay) => {
      const person = personalMap.get(normalize(pay.person_id));

      // skip jika personal tidak ditemukan
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

      const paymentId = normalize(pay.id);

      const hasTrash = trashPaymentIds.has(paymentId);

      /* ================================
       CASE 1
       USER WAJIB TRASH
       TAPI TIDAK ADA RECORD
    ================================= */

      if (isTrashUser && !hasTrash) {
        issues.push({
          type: "PAYMENT_WITHOUT_TRASH",
          house: person.house || "-",
          name: person.name || "-",
          period: pay.period,
          detail: "Missing required trash record",
        });
      }

      /* ================================
       CASE 2
       USER NON-TRASH
       TAPI PUNYA RECORD TRASH
    ================================= */

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

    /* =========================================
     CASE 3
     ORPHAN TRASH RECORD
  ========================================= */

    trashRecords.forEach((t) => {
      const tPaymentId = normalize(t.payment_id);

      const payment = paymentMap.get(tPaymentId);

      /* ================================
       ORPHAN RECORD
    ================================= */

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

      /* ================================
       SKIP PAYMENT LAMA
    ================================= */

      if (payment.period < MONITORING_START_PERIOD) {
        return;
      }

      const person = personalMap.get(normalize(payment.person_id));

      /* ================================
       PAYMENT PUNYA PERSON INVALID
    ================================= */

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

      const isTrashUser = normalize(person.trash).toUpperCase() === "Y";

      /* ================================
       USER NON-TRASH
       TAPI ADA TRASH RECORD
    ================================= */

      if (!isTrashUser) {
        issues.push({
          type: "NON_TRASH_HAS_TRASH",
          house: person.house || "-",
          name: person.name || "-",
          period: payment.period,
          detail: "Non-trash user linked to trash record",
        });
      }
    });

    /* =========================================
     REMOVE DUPLICATE ISSUE
  ========================================= */

    const uniqueIssues = Array.from(
      new Map(
        issues.map((i) => [
          [i.type, i.house, i.name, i.period, i.detail].join("|"),
          i,
        ]),
      ).values(),
    );

    /* =========================================
     SORT
  ========================================= */

    uniqueIssues.sort((a, b) => {
      return String(a.period).localeCompare(String(b.period));
    });

    return uniqueIssues;
  }, [personal, payments, trashRecords]);

  /* =========================================
     PAYMENT CASHFLOW INTEGRITY DATA
    ========================================= */
  const paymentCashflowIntegrity = useMemo(() => {
    const issues = [];
  
    const normalize = (v) => String(v || "").trim();
    const toNumber = (v) => Number(v || 0);
  
    const monthlyFee = toNumber(appConfig?.monthly_fee);
  
    const monitoredPayments = payments.filter(
      (p) => p.period && p.period >= MONITORING_START_PERIOD,
    );
  
    const paymentById = new Map(
      payments.map((p) => [normalize(p.id), p]),
    );
  
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
  }, [
    payments,
    cashflows,
    appConfig,
    MONITORING_START_PERIOD,
  ]);
  
  /* =========================================
     DATA QUALITY CHECK
  ========================================= */
  const suspiciousData = useMemo(() => {
    const issues = [];

    const normalize = (v) => String(v || "").trim();

    function checkDuplicateId(sheetName, rows) {
      const map = new Map();

      rows.forEach((row, index) => {
        const id = normalize(row.id);

        if (!id) return;

        if (!map.has(id)) {
          map.set(id, []);
        }

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

    // default = tampil semua
    if (!memberFilter) {
      return sorted;
    }

    // active
    if (memberFilter === "ACTIVE") {
      return sorted.filter((p) => p.active === "Y");
    }

    // inactive
    if (memberFilter === "INACTIVE") {
      return sorted.filter((p) => p.active === "N");
    }

    // trash active
    if (memberFilter === "TRASH_ACTIVE") {
      return sorted.filter((p) => p.active === "Y" && p.trash === "Y");
    }

    // trash inactive
    if (memberFilter === "TRASH_INACTIVE") {
      return sorted.filter((p) => p.trash !== "Y");
    }

    return sorted;
  }, [personal, memberFilter]);

const searchedPersonal = useMemo(() => {
  const keyword = memberSearch.toLowerCase().trim();

  if (!keyword) {
    return filteredPersonal;
  }

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
    const statusA = getDepositStatus(a);
    const statusB = getDepositStatus(b);

    const statusCompare =
      priority[statusA] - priority[statusB];

    if (statusCompare !== 0) {
      return statusCompare;
    }

    return String(a.period).localeCompare(
      String(b.period),
    );
  });
}, [deposits]);
  
  return (
    <>
      <style jsx global>{`
        html,
        body {
          margin: 0;
          background: var(--admin-bg);
          color: var(--admin-text);
          color-scheme: light dark;
        }

        :root {
          --admin-bg: #f1f5f9;
          --admin-text: #0f172a;
          --admin-card: #ffffff;
          --admin-muted: #475569;
          --admin-border: #e5e7eb;
          --admin-input: #ffffff;
          --admin-row: #f9fafb;
          --admin-button: #e5e7eb;
          --admin-primary: #60a5fa;
        }

        @media (prefers-color-scheme: dark) {
          :root {
            --admin-bg: #020617;
            --admin-text: #e5e7eb;
            --admin-card: #0f172a;
            --admin-muted: #94a3b8;
            --admin-border: #1e293b;
            --admin-input: #1e293b;
            --admin-row: #111827;
            --admin-button: #1e293b;
            --admin-primary: #60a5fa;
          }
        }

        input,
        select,
        textarea,
        button {
          color-scheme: light dark;
        }
      `}</style>

      <div style={styles.wrapper}>
        <div style={styles.header}>
          <button style={styles.homeBtn} onClick={() => router.push("/")}>
            « Home
          </button>

          <h1 style={styles.title}>Cash Flow Management</h1>
        </div>

        {popup && (
          <div
            style={{
              ...styles.popup,
              background:
                popup.type === "success"
                  ? "#166534"
                  : "#991b1b",
            }}
          >
            {popup.text}
          </div>
        )}

        <div style={styles.tabs}>
          <button
            style={tab === "personal" ? styles.tabActive : styles.tab}
            onClick={() => setTab("personal")}
          >
            👤 Personal
          </button>

          <button
            style={tab === "payment" ? styles.tabActive : styles.tab}
            onClick={() => setTab("payment")}
          >
            <div style={styles.tabContent}>
              <span>💳 Payment</span>

              {pendingCurrentDeposits.length > 0 && (
                <span style={styles.depositBadge}>
                  {pendingCurrentDeposits.length} deposit pending
                </span>
              )}
            </div>
          </button>

          <button
            style={tab === "deposit" ? styles.tabActive : styles.tab}
            onClick={() => setTab("deposit")}
          >
            💰 Deposit Balance
          </button>

          <button
            style={tab === "cashflow" ? styles.tabActive : styles.tab}
            onClick={() => setTab("cashflow")}
          >
            📝 Cashflow
          </button>

          <button
            style={tab === "summary" ? styles.tabActive : styles.tab}
            onClick={() => setTab("summary")}
          >
            🛡️ Summary Backup
          </button>

          <button
            style={tab === "monitoring" ? styles.tabActive : styles.tab}
            onClick={() => {
              setTab("monitoring");

              if (tab === "monitoring") {
                refreshMonitoring();
              }
            }}
          >
            🖥️ Monitoring
          </button>

          <button
            style={tab === "settings" ? styles.tabActive : styles.tab}
            onClick={() => setTab("settings")}
          >
            ⚙️ Settings
          </button>
        </div>

        {tab === "personal" && (
          <div style={styles.card}>
            <h3>Add Personal</h3>

            <form onSubmit={addMember} style={styles.form}>
              <input
                style={styles.input}
                placeholder="House"
                value={member.house}
                onChange={(e) =>
                  setMember({ ...member, house: e.target.value })
                }
              />

              <input
                style={styles.input}
                placeholder="Name"
                value={member.name}
                onChange={(e) => setMember({ ...member, name: e.target.value })}
              />

              <select
                style={styles.input}
                value={member.trash}
                onChange={(e) =>
                  setMember({ ...member, trash: e.target.value })
                }
              >
                <option value="">Join trash collection?</option>
                <option value="Y">Yes</option>
                <option value="N">No</option>
              </select>

              <input
                style={styles.input}
                type="date"
                value={member.join_date}
                onChange={(e) =>
                  setMember({ ...member, join_date: e.target.value })
                }
              />

              <button
                style={{
                  ...styles.btn,
                  ...(loadingAdd ? styles.btnDisabled : {}),
                }}
                disabled={loadingAdd}
              >
                {loadingAdd ? "Adding..." : "Add Member"}
              </button>
            </form>

            <h4>Member List</h4>
            <div style={styles.summaryCards}>
              <div
                onClick={() => toggleMemberFilter("ACTIVE")}
                style={{
                  ...styles.summaryCard,
                  ...(memberFilter === "ACTIVE"
                    ? styles.summaryCardActive
                    : {}),
                }}
              >
                <div>Active</div>
                <b>{stats.active}</b>
              </div>

              <div
                onClick={() => toggleMemberFilter("INACTIVE")}
                style={{
                  ...styles.summaryCard,
                  ...(memberFilter === "INACTIVE"
                    ? styles.summaryCardActive
                    : {}),
                }}
              >
                <div>Inactive</div>
                <b>{stats.inactive}</b>
              </div>

              <div
                onClick={() => toggleMemberFilter("TRASH_ACTIVE")}
                style={{
                  ...styles.summaryCard,
                  ...(memberFilter === "TRASH_ACTIVE"
                    ? styles.summaryCardActive
                    : {}),
                }}
              >
                <div>Trash Active</div>
                <b>{stats.trashActive}</b>
              </div>

              <div
                onClick={() => toggleMemberFilter("TRASH_INACTIVE")}
                style={{
                  ...styles.summaryCard,
                  ...(memberFilter === "TRASH_INACTIVE"
                    ? styles.summaryCardActive
                    : {}),
                }}
              >
                <div>Trash Inactive</div>
                <b>{stats.trashInactive}</b>
              </div>
            </div>

            <input
              type="text"
              placeholder="Search name or house..."
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              style={styles.searchInput}
            />

            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>ID</th>
                    <th style={styles.th}>House</th>
                    <th style={styles.th}>Name</th>
                    <th style={styles.th}>Trash</th>
                    <th style={styles.th}>Active</th>
                    <th style={styles.th}>Join Date</th>
                  </tr>
                </thead>

                <tbody>
                   {searchedPersonal.map((p, i) => {
                      let rowStyle = i % 2 ? styles.rowAlt : null;

                      if (isNewActiveMember(p)) {
                        rowStyle = styles.rowNewActive;
                      }

                      if (p.active === "N") {
                        rowStyle = styles.rowInactive;
                      }

                      return (
                        <tr key={p.id} style={rowStyle}>
                          <td style={styles.td}>{p.id}</td>
                          <td style={styles.td}>{p.house}</td>
                          <td style={styles.td}>{p.name}</td>
                          <td style={styles.td}>{p.trash}</td>
                          <td style={styles.td}>{p.active}</td>
                          <td style={styles.td}>{p.join_date}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "payment" && (
          <>
          {configError && (
            <div style={styles.errorBox}>
              {configError}
            </div>
          )}

          <div style={styles.card}>
            <h3>Bulk Payment</h3>

            <form onSubmit={recordPayment} style={styles.form}>
              <input
                style={styles.input}
                placeholder="Period (2026-02)"
                value={payment.period}
                onChange={(e) =>
                  setPayment({ ...payment, period: e.target.value })
                }
              />

              <input
                style={{
                  ...styles.input,
                  ...styles.readOnlyInput,
                }}
                type="number"
                value={payment.amount}
                readOnly
                aria-readonly="true"
              />

              <div style={styles.houseList}>
{personal
  .filter((p) => p.active === "Y")
  .sort((a, b) =>
    a.house.localeCompare(b.house, undefined, {
      numeric: true,
    }),
  )
  .map((p) => {
const period = normalize(payment.period);
const joinPeriod = normalize(p.join_date).slice(0, 7);

const alreadyPaid = isHousePaidForPeriod(p);
const notJoined =
  period &&
  joinPeriod &&
  period < joinPeriod;

const disabledChip = alreadyPaid || notJoined;

return (
  <label
    key={p.id}
    title={
      alreadyPaid
        ? "Already paid for this period"
        : notJoined
          ? "Not joined yet for this period"
          : ""
    }
    style={{
      ...styles.checkboxChip,
      ...(selected.includes(p.id)
        ? styles.checkboxChipActive
        : {}),
      ...(disabledChip
        ? styles.checkboxChipPaid
        : {}),
    }}
  >
    <input
      type="checkbox"
      style={styles.checkboxInput}
      checked={selected.includes(p.id)}
      disabled={disabledChip}
      onChange={() => toggleHouse(p.id)}
    />

    <div style={styles.houseChipContent}>
      <div style={styles.houseChipHouse}>
        {p.house}
      </div>

      {alreadyPaid && (
        <div style={styles.houseChipPaid}>
          Paid
        </div>
      )}

      {notJoined && (
        <div style={styles.houseChipPaid}>
          Not join
        </div>
      )}
    </div>
  </label>
);
})}
              </div>

              <button
                style={{
                  ...styles.btn,
                  ...(loadingPayment ? styles.btnDisabled : {}),
                }}
                disabled={loadingPayment}
              >
                {loadingPayment ? "Recording..." : "Record Payment"}
              </button>
            </form>
          </div>
          </>
        )}

        {tab === "deposit" && (
          <div style={styles.card}>
            <h3>Deposit Balance</h3>

            <form onSubmit={saveDeposit} style={styles.form}>
              <select
                style={styles.input}
                value={depositForm.person_id}
                onChange={(e) =>
                  setDepositForm({
                    ...depositForm,
                    person_id: e.target.value,
                    end_period: "",
                  })
                }
              >
                <option value="">Select active house</option>

                {activePersons.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.house} - {p.name}
                  </option>
                ))}
              </select>

              <input
                style={{
                  ...styles.input,
                  ...styles.readOnlyInput,
                }}
                value={`Rp${depositAmount.toLocaleString("id-ID")}`}
                readOnly
              />

              {selectedDepositPerson && (
                <div style={styles.depositMeta}>
                  {(selectedDepositPerson.trash || "").toUpperCase() === "Y"
                    ? `Layanan: Kas + Sampah. Sampah dicatat terpisah Rp${Number(appConfig?.trash_fee || 0).toLocaleString("id-ID")} saat Pay Now.`
                    : "Layanan: Kas"}
                </div>
              )}

              <div style={styles.depositChips}>
                {nextSixPeriods.map((period) => {
                  const active = selectedDepositPeriods.includes(period);

                  return (
                    <button
                      key={period}
                      type="button"
                      style={{
                        ...styles.depositChip,
                        ...(active ? styles.depositChipActive : {}),
                      }}
                      onClick={() =>
                        setDepositForm({
                          ...depositForm,
                          end_period: period,
                        })
                      }
                      disabled={!depositForm.person_id}
                    >
                      {period}
                    </button>
                  );
                })}
              </div>

              <button
                style={{
                  ...styles.btn,
                  ...(savingDeposit ? styles.btnDisabled : {}),
                }}
                disabled={savingDeposit}
              >
                {savingDeposit ? "Saving..." : "Save Deposit"}
              </button>
            </form>

            <h4>Deposit List</h4>

            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>House</th>
                    <th style={styles.th}>Name</th>
                    <th style={styles.th}>Period</th>
                    <th style={styles.th}>Amount</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {sortedDeposits.map((d, i) => {
                    const depositStatus = getDepositStatus(d);

                    const isPayingThisDeposit = payingDepositId === d.id;

                    const paymentExists = payments.some(
                      (p) =>
                        normalize(p.person_id) === normalize(d.person_id) &&
                        normalize(p.person_house) === normalize(d.house) &&
                        normalize(p.period) === normalize(d.period),
                    );

                    const canPay = depositStatus === "pending";

                    const buttonText =
                      depositStatus === "paid"
                        ? "Paid"
                        : depositStatus === "waiting"
                          ? "Waiting"
                          : depositStatus === "missed"
                            ? paymentExists
                              ? "Paid"
                              : "Unpaid"
                            : "Pay Now";

                    return (
                      <tr key={d.id || i} style={i % 2 ? styles.rowAlt : null}>
                        <td style={styles.td}>{d.house}</td>

                        <td style={styles.td}>{d.name}</td>

                        <td style={styles.td}>{d.period}</td>

                        <td style={styles.td}>
                          Rp{Number(d.amount || 0).toLocaleString("id-ID")}
                        </td>

                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.depositStatus,
                              ...(depositStatus === "paid"
                                ? styles.depositStatusPaid
                                : depositStatus === "waiting"
                                  ? styles.depositStatusWaiting
                                  : depositStatus === "missed"
                                    ? styles.depositStatusMissed
                                    : styles.depositStatusPending),
                            }}
                          >
                            {depositStatus}
                          </span>
                        </td>

                        <td style={styles.td}>
                          <button
                            type="button"
                            style={{
                              ...styles.smallBtn,

                              ...(buttonText === "Paid"
                                ? styles.smallBtnPaid
                                : {}),

                              ...(
                                !canPay ||
                                isPayingThisDeposit ||
                                savingDeposit
                              )
                                ? styles.btnDisabled
                                : {},
                            }}
                            disabled={
                              !canPay ||
                              isPayingThisDeposit ||
                              savingDeposit
                            }
                            onClick={() => payDeposit(d.id)}
                          >
                            {isPayingThisDeposit
                              ? "Paying..."
                              : buttonText}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "cashflow" && (
          <div style={styles.card}>
            <h3>Cashflow</h3>

            <form onSubmit={addCashflow} style={styles.form}>
              <select
                style={styles.input}
                value={cashflow.type}
                onChange={(e) =>
                  setCashflow({ ...cashflow, type: e.target.value })
                }
              >
                <option value="">Type</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>

              <input
                style={styles.input}
                placeholder="Amount"
                value={cashflow.amount}
                onChange={(e) =>
                  setCashflow({ ...cashflow, amount: e.target.value })
                }
              />

              <input
                style={styles.input}
                placeholder="Note"
                value={cashflow.note}
                onChange={(e) =>
                  setCashflow({ ...cashflow, note: e.target.value })
                }
              />

              <button
                style={{
                  ...styles.btn,
                  ...(loadingCashflow ? styles.btnDisabled : {}),
                }}
                disabled={loadingCashflow}
              >
                {loadingCashflow ? "Recording..." : "Record Transaction"}
              </button>
            </form>
          </div>
        )}

        {tab === "summary" && (
          <div style={styles.card}>
            <div style={styles.summaryHeader}>
              <h3>Summary Backup</h3>
            </div>

            {loadingSummary ? (
              <p>Loading summary...</p>
            ) : (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Date</th>
                      <th style={styles.th}>Income</th>
                      <th style={styles.th}>Expense</th>
                      <th style={styles.th}>Net</th>
                      <th style={styles.th}>Personal Active</th>
                    </tr>
                  </thead>

                  <tbody>
                    {summaryBackup.map((x, i) => (
                      <tr key={i} style={i % 2 ? styles.rowAlt : null}>
                        <td style={styles.td}>{x.created_at}</td>

                        <td style={styles.td}>
                          Rp{Number(x.total_income || 0).toLocaleString()}
                        </td>

                        <td style={styles.td}>
                          Rp{Number(x.total_expense || 0).toLocaleString()}
                        </td>

                        <td style={styles.td}>
                          Rp{Number(x.net_saldo || 0).toLocaleString()}
                        </td>

                        <td style={styles.td}>{x.total_personal_active}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "monitoring" && (
          <div style={styles.card}>
            <div style={styles.monitorGrid}>
              {/* Daily Backup */}
              <div style={styles.statusCard}>
                <div style={styles.statusLabel}>Daily Backup Status</div>

                {loadingDailyBackup ? (
                  <div style={styles.statusValue}>Checking...</div>
                ) : dailyBackup?.ok ? (
                  <>
                    <div style={styles.statusValue}>{dailyBackup.name}</div>

                    <div style={styles.statusMeta}>
                      Last created: {dailyBackup.created_at}
                    </div>

                    <div style={styles.statusMeta}>
                      Retention: {dailyBackup?.count} backup files
                    </div>
                  </>
                ) : (
                  <div style={styles.statusError}>Backup file not found</div>
                )}
              </div>

              {/* Payment Cashflow Integrity */}
              <div style={styles.statusCard}>
                <div style={styles.statusLabel}>
                  Payment Cashflow Integrity
                </div>
              
                <div style={styles.statusValue}>
                  {paymentCashflowIntegrity.length} issue
                </div>
              
                <div style={styles.statusMeta}>
                  {paymentCashflowIntegrity.length === 0
                    ? "No issue detected"
                    : "Need review"}
                </div>
              </div>

              {/* Trash Integrity */}
              <div style={styles.statusCard}>
                <div style={styles.statusLabel}>Trash Payment Integrity</div>

                <div style={styles.statusValue}>
                  {trashMismatch.length} issue
                </div>

                <div style={styles.statusMeta}>
                  {trashMismatch.length === 0
                    ? "No issue detected"
                    : "Need review"}
                </div>
              </div>

              {/* Suspicious Data */}
              <div style={styles.statusCard}>
                <div style={styles.statusLabel}>Data Quality Check</div>

                <div style={styles.statusValue}>
                  {suspiciousData.length} issue
                </div>

                <div style={styles.statusMeta}>
                  {suspiciousData.length === 0
                    ? "No suspicious data"
                    : "Need review"}
                </div>
              </div>
            </div>

            {/* Detail Payment Cashlflow */}
            {paymentCashflowIntegrity.length > 0 && (
              <div style={styles.monitorDetail}>
                <h3>Payment Cashflow Integrity</h3>
            
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>House</th>
                        <th style={styles.th}>Name</th>
                        <th style={styles.th}>Period</th>
                        <th style={styles.th}>Type</th>
                        <th style={styles.th}>Issue</th>
                      </tr>
                    </thead>
            
                    <tbody>
                      {paymentCashflowIntegrity.map((x, i) => (
                        <tr key={i} style={i % 2 ? styles.rowAlt : null}>
                          <td style={{ ...styles.td, ...styles.issueText }}>
                            {x.house}
                          </td>
                          <td style={{ ...styles.td, ...styles.issueText }}>
                            {x.name}
                          </td>
                          <td style={{ ...styles.td, ...styles.issueText }}>
                            {x.period}
                          </td>
                          <td style={{ ...styles.td, ...styles.issueText }}>
                            {x.type}
                          </td>
                          <td style={{ ...styles.td, ...styles.issueText }}>
                            {x.detail}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Detail Trash */}
            {trashMismatch.length > 0 && (
              <div style={styles.monitorDetail}>
                <h3>Trash Payment Integrity</h3>

                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>House</th>
                        <th style={styles.th}>Name</th>
                        <th style={styles.th}>Period</th>
                        <th style={styles.th}>Issue</th>
                      </tr>
                    </thead>

                    <tbody>
                      {trashMismatch.map((x, i) => (
                        <tr key={i} style={i % 2 ? styles.rowAlt : null}>
                          <td style={{ ...styles.td, ...styles.issueText }}>
                            {x.house}
                          </td>
                          <td style={{ ...styles.td, ...styles.issueText }}>
                            {x.name}
                          </td>
                          <td style={{ ...styles.td, ...styles.issueText }}>
                            {x.period}
                          </td>
                          <td style={{ ...styles.td, ...styles.issueText }}>
                            {x.detail}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Detail Suspicious */}
            {suspiciousData.length > 0 && (
              <div style={styles.monitorDetail}>
                <h3>Suspicious Data</h3>

                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Sheet</th>
                        <th style={styles.th}>Row</th>
                        <th style={styles.th}>Type</th>
                        <th style={styles.th}>Detail</th>
                      </tr>
                    </thead>

                    <tbody>
                      {suspiciousData.map((x, i) => (
                        <tr key={i} style={i % 2 ? styles.rowAlt : null}>
                          <td style={{ ...styles.td, ...styles.issueText }}>
                            {x.sheet}
                          </td>
                          <td style={{ ...styles.td, ...styles.issueText }}>
                            {x.row}
                          </td>
                          <td style={{ ...styles.td, ...styles.issueText }}>
                            {x.type}
                          </td>
                          <td style={{ ...styles.td, ...styles.issueText }}>
                            {x.detail}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "settings" && <AdminSettings />}
      </div>
    </>
  );
}

const styles = {
  wrapper: {
    width: "100%",
    maxWidth: 900,
    minHeight: "100vh",
    margin: "0 auto",
    padding: 20,
    boxSizing: "border-box",
    overflowX: "hidden",
    fontFamily: "system-ui",
    background: "var(--admin-bg)",
    color: "var(--admin-text)",
  },

  header: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 20,
  },

  title: {
    fontSize: 28,
    fontWeight: 700,
    margin: 0,
    lineHeight: 1.2,
    color: "var(--admin-text)",
  },

  homeBtn: {
    padding: "8px 12px",
    border: "1px solid var(--admin-border)",
    borderRadius: 8,
    background: "var(--admin-button)",
    color: "var(--admin-text)",
    cursor: "pointer",
    fontSize: 14,
  },

  tabs: {
    display: "flex",
    gap: 10,
    marginBottom: 20,
    flexWrap: "wrap",
  },

  tab: {
    padding: "10px 18px",
    background: "var(--admin-button)",
    color: "var(--admin-text)",
    border: "1px solid var(--admin-border)",
    borderRadius: 10,
    cursor: "pointer",
    flexShrink: 0,
  },

  tabActive: {
    padding: "10px 18px",
    background: "var(--admin-primary)",
    color: "#020617",
    border: "1px solid var(--admin-primary)",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 600,
    flexShrink: 0,
  },

  card: {
    background: "var(--admin-card)",
    color: "var(--admin-text)",
    padding: 20,
    borderRadius: 18,
    border: "1px solid var(--admin-border)",
    boxShadow: "0 10px 30px rgba(0,0,0,.18)",
  },

  form: {
    display: "grid",
    gap: 14,
    width: "100%",
    marginBottom: 25,
  },

  input: {
    padding: 12,
    border: "1px solid var(--admin-border)",
    borderRadius: 10,
    fontSize: 15,
    width: "100%",
    boxSizing: "border-box",
    background: "var(--admin-input)",
    color: "var(--admin-text)",
    outline: "none",
  },

  btn: {
    padding: 12,
    border: "none",
    borderRadius: 10,
    background: "var(--admin-primary)",
    color: "#020617",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 600,
  },

  btnDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },

  tableWrapper: {
    width: "100%",
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 620,
    tableLayout: "auto",
    color: "var(--admin-text)",
    background: "var(--admin-card)",
  },

  th: {
    textAlign: "center",
    verticalAlign: "middle",
    padding: "14px 12px",
    whiteSpace: "nowrap",
    background: "var(--admin-row)",
    color: "var(--admin-text)",
    borderBottom: "2px solid var(--admin-border)",
  },

  td: {
    textAlign: "center",
    verticalAlign: "middle",
    padding: "12px",
    borderBottom: "1px solid var(--admin-border)",
    whiteSpace: "nowrap",
    color: "var(--admin-text)",
    background: "transparent",
  },

  rowAlt: {
    background: "var(--admin-row)",
  },

  rowInactive: {
    background: "#7f1d1d",
    color: "#fecaca",
    fontWeight: 500,
  },

  rowNewActive: {
    background: "#0927b0",
    color: "#fecaca",
    fontWeight: 500,
  },

  houseList: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 8,
    marginTop: 10,
  },

  checkbox: {
    display: "grid",
    gridTemplateColumns: "22px 1fr",
    alignItems: "center",
    justifyContent: "start",
    gap: 10,
    minHeight: 44,
    color: "var(--admin-text)",
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontSize: 15,
  },

  msg: {
    background: "#dcfce7",
    color: "#166534",
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
  },

  summary: {
    marginBottom: 12,
    fontSize: 14,
    color: "var(--admin-muted)",
  },

  summaryHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
    fontSize: 14,
    color: "var(--admin-muted)",
    marginBottom: 16,
  },

  summaryCards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 10,
    marginBottom: 16,
  },

  summaryCard: {
    padding: 12,
    borderRadius: 10,
    background: "var(--admin-row)",
    color: "var(--admin-text)",
    border: "1px solid var(--admin-border)",
    textAlign: "center",
    cursor: "pointer",
    transition: "0.15s ease",
  },

  summaryCardActive: {
    background: "var(--admin-primary)",
    color: "#020617",
    border: "1px solid var(--admin-primary)",
    cursor: "pointer",
  },

  checkboxInput: {
    display: "none",
  },

  checkboxChip: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-row)",
    color: "var(--admin-text)",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
    transition: "0.15s ease",
    userSelect: "none",
  },

  checkboxChipActive: {
    background: "var(--admin-primary)",
    border: "1px solid var(--admin-primary)",
    color: "#020617",
    fontWeight: 700,
  },

  monitorGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
    marginBottom: 18,
  },

  statusCard: {
    padding: 16,
    borderRadius: 14,
    background: "var(--admin-row)",
    border: "1px solid var(--admin-border)",
  },

  statusLabel: {
    fontSize: 13,
    color: "var(--admin-muted)",
    marginBottom: 8,
    fontWeight: 600,
  },

  statusValue: {
    fontSize: 16,
    fontWeight: 700,
    color: "var(--admin-text)",
    wordBreak: "break-word",
    marginBottom: 6,
  },

  statusMeta: {
    fontSize: 13,
    color: "var(--admin-muted)",
    marginTop: 4,
  },

  statusError: {
    fontSize: 14,
    color: "#991b1b",
    fontWeight: 700,
  },

  successBox: {
    padding: 16,
    background: "#ecfdf5",
    border: "1px solid #10b981",
    borderRadius: 10,
    color: "#065f46",
    fontWeight: 500,
    textAlign: "center",
  },

  monitorSection: {
    marginTop: 22,
    paddingTop: 18,
    borderTop: "1px solid var(--admin-border)",
  },

  monitorDetail: {
    marginTop: 20,
  },

  issueText: {
    color: "#991b1b",
    fontWeight: 600,
  },

  errorBox: {
  marginBottom: 14,
  padding: 12,
  borderRadius: 12,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
  fontSize: 13,
  fontWeight: 700,
  },

  readOnlyInput: {
    background: "var(--admin-row)",
    color: "var(--admin-muted)",
    cursor: "not-allowed",
    fontWeight: 700,
  },

  searchInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    marginBottom: 14,
    borderRadius: 12,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-card)",
    color: "var(--admin-text)",
    fontSize: 14,
    outline: "none",
  },

  depositChips: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },

  depositChip: {
    padding: "9px 12px",
    borderRadius: 999,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-row)",
    color: "var(--admin-text)",
    cursor: "pointer",
    fontWeight: 600,
  },

  depositChipActive: {
    background: "var(--admin-primary)",
    color: "#020617",
    border: "1px solid var(--admin-primary)",
  },

  smallBtn: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "none",
    background: "var(--admin-primary)",
    color: "#020617",
    fontWeight: 700,
    cursor: "pointer",
  },

  depositMeta: {
    marginTop: -8,
    marginBottom: 8,
    fontSize: 13,
    color: "var(--admin-muted)",
  },

  tabContent: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    flexWrap: "wrap",
  },

  depositBadge: {
    background: "#16a34a",
    color: "#dcfce7",
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: 999,
    lineHeight: 1.2,
  },

  depositStatus: {
    display: "inline-block",
    padding: "4px 9px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    textTransform: "capitalize",
  },

  depositStatusPaid: {
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #86efac",
  },

  depositStatusWaiting: {
    background: "var(--admin-row)",
    color: "var(--admin-muted)",
    border: "1px solid var(--admin-border)",
  },

  depositStatusPending: {
    background: "#fef3c7",
    color: "#92400e",
    border: "1px solid #fcd34d",
  },

  depositStatusMissed: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fca5a5",
  },

  smallBtnPaid: {
    background: "#16a34a",
    color: "#ffffff",
  },

  popup: {
    position: "fixed",
    top: 20,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 9999,
    color: "#fff",
    padding: "12px 16px",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    boxShadow: "0 10px 25px rgba(0,0,0,.25)",
    maxWidth: "calc(100vw - 32px)",
    textAlign: "center",
  },

checkboxChipPaid: {
  opacity: 0.55,
  cursor: "not-allowed",
  background: "#cbd5e1",
  color: "#334155",
  border: "1px solid #94a3b8",
},

checkboxChipPaidText: {
  marginLeft: 6,
  fontSize: 11,
  fontWeight: 800,
},

houseChipContent: {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  width: "100%",
},

houseChipHouse: {
  fontWeight: 700,
  lineHeight: 1.2,
},

houseChipPaid: {
  fontSize: 11,
  fontWeight: 700,
  opacity: 0.7,
},
};
