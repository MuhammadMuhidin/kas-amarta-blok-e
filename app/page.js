"use client";

import React, { useState, useEffect, useMemo } from "react";

export default function CashflowPage() {
  /* ==== CONFIG ==== */
  const FETCH_URL = "/api/sheets/summary";
  const perPagePay = 9;
  const perPageInsight = 6;
  const chunk = 20;

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

  /* ==== INIT DATA ==== */
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(`${FETCH_URL}?t=${Date.now()}`, {
          cache: "no-store",
        });
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
    loadData();
  }, []);

  /* ==== HELPERS ==== */
  const formatCurrency = (n) => "Rp" + Number(n).toLocaleString("id-ID");

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

  const onScrollCashflow = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 1) {
      setLoadedCashflow((prev) => prev + chunk);
    }
  };

  /* ==== LOGIC: INSIGHT ==== */
  const activeMembersCount = useMemo(() => {
    if (!data.periods.length) return 0;
    const lastPeriod = [...data.periods].sort().pop();
    return data.persons.filter(am => {
        if (!am.join_date) return true;
        return am.join_date.slice(0, 7) <= lastPeriod;
    }).length;
  }, [data]);

  const insightList = useMemo(() => {
    if (!data.periods.length) return [];
    return data.persons
      .map((p) => {
        const validPeriods = data.periods.filter((pr) => {
          if (!p.join_date) return true;
          return pr >= p.join_date.slice(0, 7);
        });
        const paid = data.payments
          .filter((pay) => pay.person_id === p.id)
          .map((pay) => pay.period.slice(0, 7));
        const unpaid = validPeriods.filter((pr) => !paid.includes(pr));
        return { house: p.house, name: p.name, unpaid, jumlah: unpaid.length };
      })
      .filter((r) => r.jumlah >= 1)
      .sort((a, b) => a.house.localeCompare(b.house, undefined, { numeric: true }));
  }, [data]);

  const totalPageInsight = Math.max(1, Math.ceil(insightList.length / perPageInsight));
  const pagedInsight = insightList.slice((pageInsight - 1) * perPageInsight, pageInsight * perPageInsight);

  return (
    <div className="container">
      <style jsx global>{`
        :root {
          --font-base: clamp(14px, 1.4vw, 16px);
          --font-small: clamp(12px, 1.2vw, 14px);
          --font-large: clamp(18px, 2vw, 22px);
          --radius: 8px;
          --shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
          --bg: #fafafa;
          --text: #222;
          --surface: #fff;
          --border: #e5e5e5;
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --bg: #141414; --text: #e5e5e5; --surface: #1f1f1f; --border: #333;
          }
        }
        html, body { 
          overflow-x: hidden; 
          background: var(--bg);
          color: var(--text);
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 16px;
        }
        .container { max-width: 900px; margin: 0 auto; }
        h2 { margin-bottom: 16px; font-size: var(--font-large); font-weight: 700; }
        .tab { display: flex; gap: 8px; margin-bottom: 16px; }
        button {
          padding: 8px 14px; border-radius: var(--radius); border: 1px solid #dcdcdc;
          background: #f3f3f3; color: var(--text); cursor: pointer; font-size: var(--font-base); transition: 0.15s;
        }
        button:hover { background: #e9e9e9; }
        button.active { background: #007bff; color: white; border-color: #007bff; }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        
        .pay-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
        .pay-item { padding: 12px; border-radius: var(--radius); border: 1px solid var(--border); background: var(--surface); box-shadow: var(--shadow); font-size: var(--font-base); }
        
        .table-container { 
          overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius); 
          background: var(--surface); margin-top: 12px;
          -webkit-overflow-scrolling: touch;
        }
        .cashflow-body {
          max-height: calc(10 * 48px);
          overflow-y: auto;
        }
        table { min-width: 100%; border-collapse: collapse; white-space: nowrap; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid var(--border); }
        th { background: #f7f7f7; font-weight: 600; position: sticky; top: 0; z-index: 2; }
        
        .badge { padding: 4px 10px; border-radius: var(--radius); color: white; font-size: var(--font-small); }
        .income { background: #28a745; } .expense { background: #dc3545; }
        
        .summary { display: flex; justify-content: space-between; align-items: center; width: 100%; margin: 14px 0; }
        .summary-item { display: flex; flex-direction: column; }
        .summary-label { color: #666; font-size: var(--font-small); }
        .summary-value { font-weight: 600; }
        
        input, select { padding: 10px 12px; border-radius: var(--radius); border: 1px solid #cfcfcf; width: 100%; box-sizing: border-box; background: white; margin-top: 6px; font-size: var(--font-base); }
        
        .pagination { display: flex; gap: 14px; align-items: center; justify-content: center; margin-top: 12px; }
        .insight-card { background: var(--surface); border-radius: 6px; padding: 10px 12px; margin-bottom: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.06); border: 1px solid var(--border); }

        @media (max-width: 700px) { .pay-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 480px) { .pay-grid { grid-template-columns: 1fr; } }
        
        @media (prefers-color-scheme: dark) {
            button { background: #2a2a2a; border-color: #333; color: #eee; }
            input, select { background: #1f1f1f; border: 1px solid #333; color: #eee; }
            th { background: #1f1f1f !important; }
            .summary-label { color: #aaa; }
        }
      `}</style>

      {loading && <div style={{textAlign:'center', padding:'20px'}}>Processing...</div>}

      <h2>Uang Kas Amarta Residence (Blok E)</h2>

      <div className="tab">
        <button className={activeTab === "payment" ? "active" : ""} onClick={() => setActiveTab("payment")}>Payment</button>
        <button className={activeTab === "cashflow" ? "active" : ""} onClick={() => setActiveTab("cashflow")}>Cashflow</button>
        <button className={activeTab === "insight" ? "active" : ""} onClick={() => setActiveTab("insight")}>Insight</button>
      </div>

      {activeTab === "payment" && (
        <div id="payment">
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
      )}

      {activeTab === "cashflow" && (
        <div id="cashflow">
          <input placeholder="search note..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          <div className="summary">
            <div className="summary-item"><span className="summary-label">Income</span><span style={{color: "#28a745"}} className="summary-value">{formatCurrency(totals.inc)}</span></div>
            <div className="summary-item"><span className="summary-label">Expense</span><span style={{color: "#dc3545"}} className="summary-value">{formatCurrency(totals.exp)}</span></div>
            <div className="summary-item"><span className="summary-label">Net</span><span style={{color: "#007bff"}} className="summary-value">{formatCurrency(totals.net)}</span></div>
          </div>
          <div className="table-container cashflow-body" onScroll={onScrollCashflow}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {filteredCashflow.slice(0, loadedCashflow).map((c, i) => (
                  <tr key={i}>
                    <td>{c.date || "-"}</td>
                    <td><span className={`badge ${c.type}`}>{c.type}</span></td>
                    <td>{formatCurrency(c.amount)}</td>
                    <td style={{whiteSpace:'normal'}}>{c.note || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "insight" && (
        <div id="insight">
          <h3>Laporan Tunggakan Saat Ini</h3>
          <div style={{marginBottom:'10px', fontWeight:600}}>
            <div>• Total member aktif: {activeMembersCount} rumah</div>
          </div>
          <div id="insightList">
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
          {insightList.length > 0 && (
            <div className="pagination">
              <button disabled={pageInsight === 1} onClick={() => setPageInsight(p => p - 1)}>Prev</button>
              <span>Page {pageInsight}/{totalPageInsight}</span>
              <button disabled={pageInsight === totalPageInsight} onClick={() => setPageInsight(p => p + 1)}>Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
