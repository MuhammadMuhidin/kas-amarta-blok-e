"use client"

import AdminSettings from "@/components/AdminSettings"
import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"

export default function AdminPage() {
  const router = useRouter()
  const [isDark, setIsDark] = useState(false)
  const [tab, setTab] = useState("personal")
  const [personal, setPersonal] = useState([])

  const [member, setMember] = useState({
    house: "",
    name: "",
    join_date: "",
    trash: ""
  })

  const [selected, setSelected] = useState([])
  const [payment, setPayment] = useState({
    period: "",
    amount: 25000
  })

  const [cashflow, setCashflow] = useState({
    type: "",
    amount: "",
    note: ""
  })

  const [summaryBackup, setSummaryBackup] = useState([])
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [payments, setPayments] = useState([])
  const [trashRecords, setTrashRecords] = useState([])
  const [memberFilter, setMemberFilter] = useState("")

  const [msg, setMsg] = useState("")
  const [loadingAdd, setLoadingAdd] = useState(false)
  const [loadingPayment, setLoadingPayment] = useState(false)
  const [loadingCashflow, setLoadingCashflow] = useState(false)

  // Ambil objek style dinamis berdasarkan state isDark
  const s = useMemo(() => getStyles(isDark), [isDark])

  function getCookie(name) {
    return document.cookie
      .split("; ")
      .find((row) => row.startsWith(name + "="))
      ?.split("=")[1];
  }

  async function loadPersonal() {
    const res = await fetch("/api/sheets/personal", {
      cache: "no-store",
      method: "GET",
    });
    const data = await res.json();
    setPersonal(data)
  }

  async function loadPayment() {
    const res = await fetch("/api/sheets/payment", {
      cache: "no-store",
      method: "GET",
    });
    const data = await res.json()
    setPayments(data || [])
  }

  async function loadTrash() {
    const res = await fetch("/api/sheets/trash", {
      cache: "no-store",
      method: "GET",
    });
    const data = await res.json()
    setTrashRecords(data || [])
  }

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const syncTheme = () => setIsDark(media.matches)

    syncTheme()
    media.addEventListener("change", syncTheme)

    loadPersonal()
    loadSummaryBackup()
    loadPayment()
    loadTrash()

    return () => {
      media.removeEventListener("change", syncTheme)
    }
  }, [])

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

    setTimeout(() => {
      setMsg("");
    }, 3000);
  }
}

  function toggleHouse(id) {
    if (selected.includes(id)) {
      setSelected(selected.filter(x => x !== id))
    } else {
      setSelected([...selected, id])
    }
  }

  async function recordPayment(e) {
    e.preventDefault()
    setLoadingPayment(true)
    try {
      let success = 0
      for (const id of selected) {
        const p = personal.find(x => x.id === id)
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
            amount: payment.amount
          })
        })

        if (res.ok) {
          success++
          const paymentData = await res.json()
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
                amount: payment.amount
              })
            })
          }
        }
      }
      setMsg(`Payment recorded for ${success} house successfully`)
      setSelected([])
      setPayment({ period: "", amount: 25000 })
    } finally {
      setLoadingPayment(false)
      setTimeout(() => setMsg(""), 3000)
    }
  }

  async function addCashflow(e) {
    e.preventDefault()
    setLoadingCashflow(true)
    try {
      const csrfToken = getCookie("csrf_token");
      const res = await fetch("/api/sheets/cashflow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify(cashflow)
      })

      if (res.ok) {
        setMsg("Transaction recorded successfully")
        setCashflow({ type: "", amount: "", note: "" })
      } else {
        setMsg("Failed to record transaction")
      }
    } finally {
      setLoadingCashflow(false)
      setTimeout(() => setMsg(""), 3000)
    }
  }

  async function loadSummaryBackup() {
    setLoadingSummary(true)
    try {
      const res = await fetch("/api/summary-backup", { cache: "no-store" })
      const data = await res.json()
      setSummaryBackup(data || [])
    } finally {
      setLoadingSummary(false)
    }
  }

  function toggleMemberFilter(type) {
    setMemberFilter(prev => prev === type ? "" : type)
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
      { active: 0, inactive: 0, trashActive: 0, trashInactive: 0 }
    );
  }, [personal]);

  const MONITORING_START_PERIOD = "2026-06";

  const trashMismatch = useMemo(() => {
    const issues = [];
    const normalize = (v) => String(v || "").trim();
    const monitoredPayments = payments.filter((p) => p.period && p.period >= MONITORING_START_PERIOD);
    const trashPaymentIds = new Set(trashRecords.map((t) => normalize(t.payment_id)));
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
      const paymentId = normalize(pay.id);
      const hasTrash = trashPaymentIds.has(paymentId);

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

      const isTrashUser = normalize(person.trash).toUpperCase() === "Y";
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

    const uniqueIssues = Array.from(
      new Map(issues.map((i) => [[i.type, i.house, i.name, i.period, i.detail].join("|"), i])).values()
    );

    uniqueIssues.sort((a, b) => String(a.period).localeCompare(String(b.period)));
    return uniqueIssues;
  }, [personal, payments, trashRecords]);

  const filteredPersonal = useMemo(() => {
    const sorted = [...personal].sort((a, b) => a.house.localeCompare(b.house, undefined, { numeric: true }))
    if (!memberFilter) return sorted
    if (memberFilter === "ACTIVE") return sorted.filter(p => p.active === "Y")
    if (memberFilter === "INACTIVE") return sorted.filter(p => p.active === "N")
    if (memberFilter === "TRASH_ACTIVE") return sorted.filter(p => p.active === "Y" && p.trash === "Y")
    if (memberFilter === "TRASH_INACTIVE") return sorted.filter(p => p.trash !== "Y")
    return sorted
  }, [personal, memberFilter])

  return (
    <>
      <div style={s.wrapper}>
        <div style={s.header}>
          <button style={s.homeBtn} onClick={() => router.push("/")}>
            « Home
          </button>
          <h1 style={s.title}>Cash Flow Management</h1>
        </div>

        {msg && <div style={s.msg}>{msg}</div>}

        <div style={s.tabs}>
          <button style={tab === "personal" ? s.tabActive : s.tab} onClick={() => setTab("personal")}>
            Personal
          </button>
          <button style={tab === "payment" ? s.tabActive : s.tab} onClick={() => setTab("payment")}>
            Payment
          </button>
          <button style={tab === "cashflow" ? s.tabActive : s.tab} onClick={() => setTab("cashflow")}>
            Cashflow
          </button>
          <button style={tab === "summary" ? s.tabActive : s.tab} onClick={() => setTab("summary")}>
            Summary Backup
          </button>
          <button style={tab === "monitoring" ? s.tabActive : s.tab} onClick={() => setTab("monitoring")}>
            Monitoring
          </button>
          <button style={tab === "settings" ? s.tabActive : s.tab} onClick={() => setTab("settings")}>
            Settings
          </button>
        </div>

        {tab === "personal" && (
          <div style={s.card}>
            <h3>Add Personal</h3>
            <form onSubmit={addMember} style={s.form}>
              <input
                style={s.input}
                placeholder="House"
                value={member.house}
                onChange={e => setMember({ ...member, house: e.target.value })}
              />
              <input
                style={s.input}
                placeholder="Name"
                value={member.name}
                onChange={e => setMember({ ...member, name: e.target.value })}
              />
              <select
                style={s.input}
                value={member.trash}
                onChange={e => setMember({ ...member, trash: e.target.value })}
              >
                <option value="" style={{ color: isDark ? "#fff" : "#000" }}>Join trash collection?</option>
                <option value="Y" style={{ color: isDark ? "#fff" : "#000" }}>Yes</option>
                <option value="N" style={{ color: isDark ? "#fff" : "#000" }}>No</option>
              </select>
              <input
                style={s.input}
                type="date"
                value={member.join_date}
                onChange={e => setMember({ ...member, join_date: e.target.value })}
              />
              <button
                style={{ ...s.btn, ...(loadingAdd ? s.btnDisabled : {}) }}
                disabled={loadingAdd}
              >
                {loadingAdd ? "Adding..." : "Add Member"}
              </button>
            </form>

            <h4>Member List</h4>
            <div style={s.summaryCards}>
              <div onClick={() => toggleMemberFilter("ACTIVE")} style={{ ...s.summaryCard, ...(memberFilter === "ACTIVE" ? s.summaryCardActive : {}) }}>
                <div>Active</div>
                <b>{stats.active}</b>
              </div>
              <div onClick={() => toggleMemberFilter("INACTIVE")} style={{ ...s.summaryCard, ...(memberFilter === "INACTIVE" ? s.summaryCardActive : {}) }}>
                <div>Inactive</div>
                <b>{stats.inactive}</b>
              </div>
              <div onClick={() => toggleMemberFilter("TRASH_ACTIVE")} style={{ ...s.summaryCard, ...(memberFilter === "TRASH_ACTIVE" ? s.summaryCardActive : {}) }}>
                <div>Trash Active</div>
                <b>{stats.trashActive}</b>
              </div>
              <div onClick={() => toggleMemberFilter("TRASH_INACTIVE")} style={{ ...s.summaryCard, ...(memberFilter === "TRASH_INACTIVE" ? s.summaryCardActive : {}) }}>
                <div>Trash Inactive</div>
                <b>{stats.trashInactive}</b>
              </div>
            </div>

            <div style={s.tableWrapper}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>ID</th>
                    <th style={s.th}>House</th>
                    <th style={s.th}>Name</th>
                    <th style={s.th}>Trash</th>
                    <th style={s.th}>Active</th>
                    <th style={s.th}>Join Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPersonal.map((p, i) => {
                    let rowStyle = i % 2 ? s.rowAlt : null;
                    if (p.active === "N") {
                      rowStyle = s.rowInactive;
                    }
                    return (
                      <tr key={p.id} style={rowStyle}>
                        <td style={s.td}>{p.id}</td>
                        <td style={s.td}>{p.house}</td>
                        <td style={s.td}>{p.name}</td>
                        <td style={s.td}>{p.trash}</td>
                        <td style={s.td}>{p.active}</td>
                        <td style={s.td}>{p.join_date}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "payment" && (
          <div style={s.card}>
            <h3>Bulk Payment</h3>
            <form onSubmit={recordPayment} style={s.form}>
              <input
                style={s.input}
                placeholder="Period (2026-02)"
                value={payment.period}
                onChange={e => setPayment({ ...payment, period: e.target.value })}
              />
              <input
                style={s.input}
                type="number"
                value={payment.amount}
                onChange={e => setPayment({ ...payment, amount: e.target.value })}
              />
              <div style={s.houseList}>
                {personal
                  .filter(p => p.active === "Y")
                  .sort((a, b) => a.house.localeCompare(b.house, undefined, { numeric: true }))
                  .map(p => (
                    <label key={p.id} style={s.checkbox}>
                      <input
                        type="checkbox"
                        checked={selected.includes(p.id)}
                        onChange={() => toggleHouse(p.id)}
                      />
                      {p.house}
                    </label>
                  ))}
              </div>
              <button
                style={{ ...s.btn, ...(loadingPayment ? s.btnDisabled : {}) }}
                disabled={loadingPayment}
              >
                {loadingPayment ? "Recording..." : "Record Payment"}
              </button>
            </form>
          </div>
        )}

        {tab === "cashflow" && (
          <div style={s.card}>
            <h3>Cashflow</h3>
            <form onSubmit={addCashflow} style={s.form}>
              <select
                style={s.input}
                value={cashflow.type}
                onChange={e => setCashflow({ ...cashflow, type: e.target.value })}
              >
                <option value="" style={{ color: isDark ? "#fff" : "#000" }}>Type</option>
                <option value="income" style={{ color: isDark ? "#fff" : "#000" }}>Income</option>
                <option value="expense" style={{ color: isDark ? "#fff" : "#000" }}>Expense</option>
              </select>
              <input
                style={s.input}
                placeholder="Amount"
                value={cashflow.amount}
                onChange={e => setCashflow({ ...cashflow, amount: e.target.value })}
              />
              <input
                style={s.input}
                placeholder="Note"
                value={cashflow.note}
                onChange={e => setCashflow({ ...cashflow, note: e.target.value })}
              />
              <button
                style={{ ...s.btn, ...(loadingCashflow ? s.btnDisabled : {}) }}
                disabled={loadingCashflow}
              >
                {loadingCashflow ? "Recording..." : "Record Transaction"}
              </button>
            </form>
          </div>
        )}

        {tab === "summary" && (
          <div style={s.card}>
            <div style={s.summaryHeader}>
              <h3>Summary Backup</h3>
            </div>
            {loadingSummary ? (
              <p>Loading summary...</p>
            ) : (
              <div style={s.tableWrapper}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Date</th>
                      <th style={s.th}>Income</th>
                      <th style={s.th}>Expense</th>
                      <th style={s.th}>Net</th>
                      <th style={s.th}>Personal Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryBackup.map((x, i) => (
                      <tr key={i} style={i % 2 ? s.rowAlt : null}>
                        <td style={s.td}>{x.created_at}</td>
                        <td style={s.td}>Rp{Number(x.total_income || 0).toLocaleString()}</td>
                        <td style={s.td}>Rp{Number(x.total_expense || 0).toLocaleString()}</td>
                        <td style={s.td}>Rp{Number(x.net_saldo || 0).toLocaleString()}</td>
                        <td style={s.td}>{x.total_personal_active}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "monitoring" && (
          <div style={s.card}>
            <h3>Trash Payment Integrity Check</h3>
            <div style={s.summaryCards}>
              <div style={s.summaryCard}>
                <div>Detected Issue</div>
                <b>{trashMismatch.length}</b>
              </div>
            </div>

            {trashMismatch.length === 0 ? (
              <div style={s.alertSuccess}>
                Tidak ada issue
              </div>
            ) : (
              <div style={s.tableWrapper}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>House</th>
                      <th style={s.th}>Name</th>
                      <th style={s.th}>Period</th>
                      <th style={s.th}>Issue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trashMismatch.map((x, i) => (
                      <tr key={i} style={i % 2 ? s.rowAlt : null}>
                        <td style={s.td}>{x.house}</td>
                        <td style={s.td}>{x.name}</td>
                        <td style={s.td}>{x.period}</td>
                        <td style={s.tdIssue}>{x.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "settings" && (
          <div style={s.card}>
            <AdminSettings isDark={isDark} />
          </div>
        )}
      </div>
    </>
  )
}

// Mengubah style menjadi dinamis menggunakan parameter isDark
const getStyles = (isDark) => ({
  wrapper: {
    width: "100%",
    maxWidth: 900,
    margin: "0 auto",
    padding: "20px",
    boxSizing: "border-box",
    overflowX: "hidden",
    fontFamily: "system-ui",
    background: isDark ? "#020617" : "#f1f5f9",
    color: isDark ? "#f8fafc" : "#0f172a",
    transition: "background 0.2s ease, color 0.2s ease"
  },

  header: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 20
  },

  title: {
    fontSize: 28,
    fontWeight: 700,
    margin: 0,
    lineHeight: 1.2,
    color: isDark ? "#f8fafc" : "#0f172a",
  },

  homeBtn: {
    padding: "8px 12px",
    border: "none",
    borderRadius: 8,
    background: isDark ? "#334155" : "#e5e7eb",
    color: isDark ? "#f8fafc" : "#0f172a",
    cursor: "pointer",
    fontSize: 14
  },

  tabs: {
    display: "flex",
    gap: 10,
    marginBottom: 20,
    flexWrap: "wrap"
  },

  tab: {
    padding: "10px 18px",
    background: isDark ? "#1e293b" : "#e5e7eb",
    color: isDark ? "#cbd5e1" : "#0f172a",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    flexShrink: 0
  },

  tabActive: {
    padding: "10px 18px",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 500,
    flexShrink: 0
  },

  card: {
    background: isDark ? "#111827" : "#ffffff",
    color: isDark ? "#f8fafc" : "#0f172a",
    padding: 20,
    borderRadius: 14,
    border: isDark ? "1px solid #334155" : "none",
    boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.25)" : "0 2px 12px rgba(0,0,0,0.06)",
  },

  form: {
    display: "grid",
    gap: 12,
    width: "100%",
    marginBottom: 25
  },

  input: {
    padding: "12px",
    border: isDark ? "1px solid #4b5563" : "1px solid #d1d5db",
    background: isDark ? "#1f2937" : "#ffffff",
    color: isDark ? "#f8fafc" : "#0f172a",
    borderRadius: 8,
    fontSize: 15,
    width: "100%",
    boxSizing: "border-box"
  },

  btn: {
    padding: "12px",
    border: "none",
    borderRadius: 8,
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 500
  },

  btnDisabled: {
    opacity: 0.6,
    cursor: "not-allowed"
  },

  tableWrapper: {
    overflowX: "auto"
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 500,
    tableLayout: "auto"
  },

  th: {
    textAlign: "center",
    verticalAlign: "middle",
    padding: "10px",
    borderBottom: isDark ? "2px solid #4b5563" : "2px solid #e5e7eb",
    color: isDark ? "#94a3b8" : "#475569",
    whiteSpace: "nowrap"
  },

  td: {
    textAlign: "center",
    verticalAlign: "middle",
    padding: "10px",
    borderBottom: isDark ? "1px solid #374151" : "1px solid #f1f5f9",
    whiteSpace: "nowrap"
  },

  tdIssue: {
    textAlign: "center",
    verticalAlign: "middle",
    padding: "10px",
    borderBottom: isDark ? "1px solid #374151" : "1px solid #f1f5f9",
    whiteSpace: "nowrap",
    color: isDark ? "#f87171" : "#991b1b",
    fontWeight: 600
  },

  rowAlt: {
    background: isDark ? "#1f2937" : "#f9fafb"
  },

  rowInactive: {
    background: isDark ? "#7f1d1d" : "#fee2e2",
    color: isDark ? "#fecaca" : "#991b1b",
    fontWeight: 500
  },

  houseList: {
    display: "grid",
    gridTemplateColumns: "repeat(3,1fr)",
    gap: 8,
    marginTop: 10
  },

  checkbox: {
    display: "flex",
    gap: 6,
    alignItems: "center"
  },

  msg: {
    background: isDark ? "#064e3b" : "#dcfce7",
    color: isDark ? "#6ee7b7" : "#15803d",
    padding: 10,
    borderRadius: 6,
    marginBottom: 20
  },

  alertSuccess: {
    padding: 16,
    background: isDark ? "#064e3b" : "#ecfdf5",
    border: isDark ? "1px solid #059669" : "1px solid #10b981",
    borderRadius: 10,
    color: isDark ? "#a7f3d0" : "#065f46",
    fontWeight: 500,
    textAlign: "center",
  },

  summaryHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16
  },

  summaryCards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 10,
    marginBottom: 16
  },

  summaryCard: {
    padding: 12,
    borderRadius: 10,
    background: isDark ? "#1f2937" : "#f8fafc",
    border: isDark ? "1px solid #374151" : "1px solid #e2e8f0",
    color: isDark ? "#f8fafc" : "#0f172a",
    textAlign: "center",
    cursor: "pointer",
    transition: "0.15s ease"
  },

  summaryCardActive: {
    background: "#2563eb",
    color: "#fff",
    border: "1px solid #2563eb",
    cursor: "pointer"
  }
})
