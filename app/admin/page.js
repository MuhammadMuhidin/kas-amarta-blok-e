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

  const [msg, setMsg] = useState("");
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

  async function refreshMonitoring() {
    await Promise.all([
      loadAppConfig(),
      loadDailyBackupStatus(),
      loadPayment(),
      loadTrash(),
      loadPersonal(),
      loadCashflow(),
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
  }, []);

  useEffect(() => {
    if (tab === "payment") {
      loadAppConfig();
    }

    if (tab === "monitoring") {
      refreshMonitoring();
    }
  }, [tab]);

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
        setMsg("Member added successfully");

        setMember({
          house: "",
          name: "",
          join_date: "",
          trash: "",
        });

        loadPersonal();
      } else {
        setMsg("Failed to add member");
      }
    } finally {
      setLoadingAdd(false);

      setTimeout(() => setMsg(""), 3000);
    }
  }

  function toggleHouse(id) {
    if (selected.includes(id)) {
      setSelected(selected.filter((x) => x !== id));
    } else {
      setSelected([...selected, id]);
    }
  }

  async function recordPayment(e) {
    e.preventDefault();

    if (!appConfig) {
      setMsg("Konfigurasi kas belum tersedia. Pembayaran tidak bisa dicatat.");
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

      setMsg(`Payment recorded for ${success} house successfully`);
      setSelected([]);
      setPayment({
        period: "",
        amount: appConfig.monthly_fee,
      });
    } finally {
      setLoadingPayment(false);

      setTimeout(() => setMsg(""), 3000);
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
        setMsg("Transaction recorded successfully");

        setCashflow({
          type: "",
          amount: "",
          note: "",
        });
      } else {
        setMsg("Failed to record transaction");
      }
    } finally {
      setLoadingCashflow(false);

      setTimeout(() => setMsg(""), 3000);
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
     SUSPICIOUS DATA
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

        {msg && <div style={styles.msg}>{msg}</div>}

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
            💳 Payment
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
                  .map((p) => (
                    <label
                      key={p.id}
                      style={{
                        ...styles.checkboxChip,
                        ...(selected.includes(p.id)
                          ? styles.checkboxChipActive
                          : {}),
                      }}
                    >
                      <input
                        type="checkbox"
                        style={styles.checkboxInput}
                        checked={selected.includes(p.id)}
                        onChange={() => toggleHouse(p.id)}
                      />

                      {p.house}
                    </label>
                  ))}
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
                <div style={styles.statusLabel}>Suspicious Data</div>

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
};
