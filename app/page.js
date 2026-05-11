"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";

export default function CashflowPage() {
  /* ==== STATE ==== */
  const [data, setData] = useState({
    payments: [],
    cashflows: [],
    persons: [],
    periods: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("payment");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [pagePay, setPagePay] = useState(1);
  const [pageInsight, setPageInsight] = useState(1);
  const [loadedCashflow, setLoadedCashflow] = useState(20);

  const FETCH_URL = "/api/sheets/summary";
  const perPagePay = 9;
  const perPageInsight = 6;
  const chunk = 20;

  /* ==== INIT & FETCH ==== */
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${FETCH_URL}?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load data");
        const json = await res.json();
        setData(json);
        if (json.periods && json.periods.length > 0) {
          setSelectedPeriod([...json.periods].sort().pop());
        }
      } catch (err) {
        alert(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  /* ==== HELPERS ==== */
  const format = (n) => "Rp" + Number(n).toLocaleString("id-ID");

  /* ==== LOGIC: PAYMENT ==== */
  const paymentList = useMemo(() => {
    if (!selectedPeriod || !data.persons.length) return [];
    const per = selectedPeriod.slice(0, 7);
    return data.persons
      .map((p) => {
        let paid = false;
        let notApplicable = false;
        if (p.join_date && per < p.join_date.slice(0, 7)) {
          notApplicable = true;
        } else {
          paid = data.payments.some(
            (pay) => pay.person_id === p.id && pay.period.slice(0, 7) === per
          );
        }
        return { house: p.house, paid, notApplicable };
      })
      .sort((a, b) => a.house.localeCompare(b.house, undefined, { numeric: true }));
  }, [selectedPeriod, data]);

  const totalPagePay = Math.max(1, Math.ceil(paymentList.length / perPagePay));
  const pagedPayments = paymentList.slice((pagePay - 1) * perPagePay, pagePay * perPagePay);

  /* ==== LOGIC: CASHFLOW ==== */
  const filteredCashflow = useMemo(() => {
    return data.cashflows.filter((c) =>
      (c.note || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, data.cashflows]);

  const totals = useMemo(() => {
    let inc = 0, exp = 0;
    data.cashflows.forEach((c) => {
      if (c.type === "income") inc += c.amount;
      else exp += c.amount;
    });
    return { inc, exp, net: inc - exp };
  }, [data.cashflows]);

  /* ==== LOGIC: INSIGHT ==== */
  const activeMembersCount = useMemo(() => {
    if (!data.periods.length) return 0;
    const lastPeriod = [...data.periods].sort().pop();
    return data.persons.filter(am => {
        if (!am.join_date) return true;
        return am.join_date.slice(0, 7) <= lastPeriod;
    }).length;
  }, [data]);

  const insightResult = useMemo(() => {
    if (!data.periods.length) return [];
    return data.persons
      .map((p) => {
        const validPeriods = data.periods.filter((pr) => {
          if (!p.join_date) return true;
          return pr >= p.join_date.slice(0, 7);
        });
        const paid = data.payments
          .filter((pay) => pay.person_id === p.id && pay.person_house === p.house)
          .map((pay) => pay.period.slice(0, 7));
        const unpaid = validPeriods.filter((pr) => !paid.includes(pr));
        return { house: p.house, name: p.name, unpaid, jumlah: unpaid.length };
      })
      .filter((r) => r.jumlah >= 1)
      .sort((a, b) => a.house.localeCompare(b.house, undefined, { numeric: true }));
  }, [data]);

  const totalPageInsight = Math.max(1, Math.ceil(insightResult.length / perPageInsight));
  const pagedInsight = insightResult.slice((pageInsight - 1) * perPageInsight, pageInsight * perPageInsight);

  return (
    <>
      <style jsx global>{`
        :root {
            --font-base: clamp(14px, 1.3vw, 16px);
            --font-small: clamp(12px, 1vw, 14px);
            --font-large: clamp(22px, 2vw, 28px);
    
            --radius: 14px;
            --shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
    
            --bg: #f4f7fb;
            --text: #1f2937;
            --surface: #ffffff;
            --border: #e5e7eb;
    
            --primary: #2563eb;
            --success: #16a34a;
            --danger: #dc2626;
        }
    
        * {
            box-sizing: border-box;
        }
    
        html,
        body {
            overflow-x: hidden;
        }
    
        body {
            font-family: Inter, Arial, sans-serif;
            padding: 20px;
            max-width: 1200px;
            margin: 0 auto;
            background: linear-gradient(to bottom, #f8fafc, #eef2ff);
            color: var(--text);
            line-height: 1.5;
            font-size: var(--font-base);
        }
    
        h2 {
            margin-bottom: 20px;
            font-size: var(--font-large);
            font-weight: 800;
            letter-spacing: -0.4px;
        }
    
        h3 {
            margin-bottom: 14px;
        }
    
        /* ===== TAB ===== */
    
        .tab {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }
    
        button {
            padding: 10px 16px;
            border-radius: 999px;
            border: 1px solid var(--border);
            background: var(--surface);
            cursor: pointer;
            font-size: var(--font-base);
            font-weight: 600;
            transition: all 0.2s ease;
            color: var(--text);
        }
    
        button:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 4px 10px rgba(37, 99, 235, 0.08);
        }
    
        button.active {
            background: var(--primary);
            color: white;
            border-color: var(--primary);
        }
    
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
    
        .hidden {
            display: none;
        }
    
        /* ===== FORM ===== */
    
        input,
        select {
            padding: 11px 14px;
            border-radius: var(--radius);
            border: 1px solid #d1d5db;
            font-size: var(--font-base);
            width: 100%;
            background: white;
            margin-top: 6px;
            transition: 0.2s;
        }
    
        input:focus,
        select:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
        }
    
        /* ===== PAYMENT GRID ===== */
    
        .pay-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 14px;
            margin-top: 16px;
        }
    
        .pay-item {
            padding: 16px;
            border-radius: var(--radius);
            border: 1px solid var(--border);
            background: var(--surface);
            box-shadow: var(--shadow);
            transition: 0.2s;
        }
    
        .pay-item:hover {
            transform: translateY(-2px);
        }
    
        /* ===== SUMMARY ===== */
    
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 14px;
            margin: 18px 0;
        }
    
        .summary-item {
            background: var(--surface);
            border-radius: var(--radius);
            padding: 16px;
            border: 1px solid var(--border);
            box-shadow: var(--shadow);
        }
    
        .summary-label {
            color: #6b7280;
            font-size: var(--font-small);
            margin-bottom: 6px;
        }
    
        .summary-value {
            font-size: 18px;
            font-weight: 700;
        }
    
        /* ===== TABLE ===== */
    
        .table-container {
            overflow-x: auto;
            border-radius: 16px;
            background: var(--surface);
            margin-top: 14px;
            border: 1px solid var(--border);
            box-shadow: var(--shadow);
            -webkit-overflow-scrolling: touch;
        }
    
        table {
            width: max-content;
            min-width: 100%;
            border-collapse: collapse;
        }
    
        th,
        td {
            padding: 14px 16px;
            border-bottom: 1px solid var(--border);
            text-align: left;
            vertical-align: top;
        }
    
        th {
            background: #f8fafc;
            font-weight: 700;
            position: sticky;
            top: 0;
            zIndex: 2;
        }
    
        tr {
            transition: background 0.15s ease;
        }
    
        tr:hover {
            background: #f9fafb;
        }
    
        /* ===== NOTE COLUMN ===== */
    
        .note-cell {
            white-space: normal !important;
            word-break: break-word;
            line-height: 1.45;
            min-width: 260px;
            max-width: 520px;
        }
    
        /* ===== BADGE ===== */
    
        .badge {
            padding: 5px 12px;
            border-radius: 999px;
            color: white;
            font-size: var(--font-small);
            font-weight: 600;
            display: inline-block;
        }
    
        .income {
            background: var(--success);
        }
    
        .expense {
            background: var(--danger);
        }
    
        /* ===== PAGINATION ===== */
    
        .pagination {
            display: flex;
            gap: 14px;
            align-items: center;
            justify-content: center;
            margin-top: 18px;
            flex-wrap: wrap;
        }
    
        /* ===== INSIGHT ===== */
    
        .insight-card {
            background: var(--surface);
            border-radius: 14px;
            padding: 16px;
            margin-bottom: 12px;
            border: 1px solid var(--border);
            box-shadow: var(--shadow);
        }
    
        /* ===== CASHFLOW HEIGHT ===== */
    
        .cashflow-body {
            max-height: calc(10 * 56px);
            overflow-y: auto;
        }
    
        /* ===== DARK MODE ===== */
    
        @media (prefers-color-scheme: dark) {
            :root {
                --bg: #0f172a;
                --text: #f3f4f6;
                --surface: #111827;
                --border: #263041;
            }
    
            body {
                background: linear-gradient(to bottom, #0f172a, #111827);
            }
    
            button {
                background: #182233;
                border-color: #2a3649;
                color: #f3f4f6;
            }
    
            input,
            select {
                background: #111827;
                border-color: #374151;
                color: #f3f4f6;
            }
    
            th {
                background: #172033;
            }
    
            tr:hover {
                background: #182233;
            }
    
            .summary-label {
                color: #9ca3af;
            }
        }
    
        /* ===== MOBILE ===== */
    
        @media (max-width: 640px) {
            body {
                padding: 14px;
            }
    
            th,
            td {
                padding: 12px;
                font-size: 13px;
            }
    
            .note-cell {
                min-width: 180px;
                max-width: 260px;
            }
    
            .summary {
                grid-template-columns: 1fr;
            }
        }
    `}</style>

      {loading && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.1)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999}}>
          <div style={{background:'var(--surface)', padding:'20px', borderRadius:'8px'}}>Processing…</div>
        </div>
      )}

      <h2>Uang Kas Amarta Residence (Blok E)</h2>

      <div className="tab">
        <button className={activeTab === "payment" ? "active" : ""} onClick={() => setActiveTab("payment")}>Payment</button>
        <button className={activeTab === "cashflow" ? "active" : ""} onClick={() => setActiveTab("cashflow")}>Cashflow</button>
        <button className={activeTab === "insight" ? "active" : ""} onClick={() => setActiveTab("insight")}>Insight</button>
      </div>

      {/* PAYMENT TAB */}
      <div className={activeTab !== "payment" ? "hidden" : ""}>
        <label>Pilih Periode:</label>
        <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
          {data.periods.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <div className="pay-grid">
          {pagedPayments.map((p, idx) => (
            <div key={idx} className="pay-item">
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{p.house}</span>
                <span style={{ 
                  fontWeight: 700, 
                  color: p.notApplicable ? "#6c757d" : p.paid ? "#28a745" : "#dc3545" 
                }}>
                  {p.notApplicable ? "Belum Bergabung" : p.paid ? "Sudah Bayar" : "Belum Bayar"}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="pagination">
          <button disabled={pagePay === 1} onClick={() => setPagePay(p => p - 1)}>Prev</button>
          <span>Page {pagePay}/{totalPagePay}</span>
          <button disabled={pagePay === totalPagePay} onClick={() => setPagePay(p => p + 1)}>Next</button>
        </div>
      </div>

      {/* CASHFLOW TAB */}
      <div className={activeTab !== "cashflow" ? "hidden" : ""}>
        <input placeholder="search note..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setLoadedCashflow(20); }} />
        <div className="summary">
          <div className="summary-item"><span className="summary-label">Income</span><span style={{color: "#28a745"}} className="summary-value">{format(totals.inc)}</span></div>
          <div className="summary-item"><span className="summary-label">Expense</span><span style={{color: "#dc3545"}} className="summary-value">{format(totals.exp)}</span></div>
          <div className="summary-item"><span className="summary-label">Net</span><span style={{color: "#007bff"}} className="summary-value">{format(totals.net)}</span></div>
        </div>
        <div className="table-container cashflow-body" onScroll={(e) => {
          const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
          if (scrollTop + clientHeight >= scrollHeight - 1) setLoadedCashflow(prev => prev + chunk);
        }}>
          <table>
            <thead>
              <tr><th>Date</th><th>Type</th><th>Amount</th><th>Note</th></tr>
            </thead>
            <tbody>
              {filteredCashflow.slice(0, loadedCashflow).map((c, i) => (
                <tr key={i}>
                  <td>{c.date || "-"}</td>
                  <td><span className={`badge ${c.type}`}>{c.type}</span></td>
                  <td>{format(c.amount)}</td>
                  <td className="note-cell">{c.note || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* INSIGHT TAB */}
      <div className={activeTab !== "insight" ? "hidden" : ""}>
        <h3>Laporan Tunggakan Saat ini</h3>
        <div style={{marginBottom:'10px', fontWeight:600}}>
          <div>• Total member aktif: {activeMembersCount} rumah</div>
        </div>
        <div>
          {pagedInsight.length > 0 ? (
            pagedInsight.map((r, i) => (
              <div key={i} className="insight-card">
                <b>{(pageInsight-1)*perPageInsight + i + 1}. {r.house}</b>
                <div>• Nunggak: {r.jumlah} periode</div>
                <div>• Periode: {r.unpaid.join(", ")}</div>
              </div>
            ))
          ) : (
            <div className="insight-card">Tidak ada tunggakan.</div>
          )}
        </div>
        {insightResult.length > 0 && (
          <div className="pagination">
            <button disabled={pageInsight === 1} onClick={() => setPageInsight(p => p - 1)}>Prev</button>
            <span>Page {pageInsight}/{totalPageInsight}</span>
            <button disabled={pageInsight === totalPageInsight} onClick={() => setPageInsight(p => p + 1)}>Next</button>
          </div>
        )}
      </div>
    </>
  );
}
