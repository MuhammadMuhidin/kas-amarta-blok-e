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
  const [showInsightModal, setShowInsightModal] = useState(false);
  const [modalType, setModalType] = useState("last");

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
  const insight = data.insight || {};

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
      <div className="page-wrap">
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
          body { font-family: Arial, sans-serif; background: var(--bg); color: var(--text); line-height: 1.42; font-size: var(--font-base); }
          h2 { margin-bottom: 16px; font-size: var(--font-large); font-weight: 700; }
          .tab { display: flex; gap: 8px; margin-bottom: 16px; }
          button { padding: 8px 14px; border-radius: var(--radius); border: 1px solid #dcdcdc; background: #f3f3f3; cursor: pointer; font-size: var(--font-base); transition: 0.15s; }
          button:hover { background: #e9e9e9; }
          button.active { background: #007bff; color: white; border-color: #007bff; }
          .hidden { display: none; }
          input, select { padding: 10px 12px; border-radius: var(--radius); border: 1px solid #cfcfcf; font-size: var(--font-base); width: 100%; box-sizing: border-box; background: white; margin-top: 6px; }
          .pay-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
          .pay-item { padding: 12px; border-radius: var(--radius); border: 1px solid var(--border); background: var(--surface); box-shadow: var(--shadow); font-size: var(--font-base); }
          .table-container { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); margin-top: 12px; }
          table { min-width: 100%; border-collapse: collapse; white-space: nowrap; }
          th, td { padding: 12px; border-bottom: 1px solid var(--border); text-align: left; }
          th { background: #f7f7f7; font-weight: 600; }
          .badge { padding: 4px 10px; border-radius: var(--radius); color: white; font-size: var(--font-small); }
          .income { background: #28a745; }
          .expense { background: #dc3545; }
          .summary { display: flex; justify-content: space-between; align-items: center; width: 100%; margin: 14px 0; }
          .summary-item { display: flex; flex-direction: column; }
          .summary-label { color: #666; font-size: var(--font-small); }
          .summary-value { font-weight: 600; }
          .pagination { display: flex; gap: 14px; align-items: center; justify-content: center; margin-top: 12px; }
          .insight-card { background: var(--surface); border-radius: 6px; padding: 10px 12px; margin-bottom: 10px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06); border: 1px solid var(--border); }
          @media (prefers-color-scheme: dark) {
            :root { --bg: #141414; --text: #e5e5e5; --surface: #1f1f1f; --border: #333; }
            button { background: #2a2a2a; border-color: #333; color: #eee; }
            input, select, th { background: #1f1f1f; color: #eee; border-color: #333; }
          }
          .cashflow-body { max-height: calc(10 * 48px); overflow-y: auto; }
          .page-wrap { width:100%; max-width:900px; margin:0 auto; padding:16px; box-sizing:border-box; }
          .insight-summary { background: var(--surface); border:1px solid var(--border); border-radius:12px; padding:16px; margin-bottom:20px; }
          .insight-row { display:flex; justify-content:space-between; align-items:center; gap:16px; padding:12px 0; border-bottom:1px dashed var(--border); }
          .insight-row:last-child { border-bottom:none; }
          .insight-divider { margin:18px 0; border:none; border-top:2px solid var(--border); }
          .insight-link { border: none; background: none; color: #007bff; cursor: pointer; padding: 0; margin-left: 6px; font-size: inherit; }
          .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 16px; }
          .modal-box { width: 100%; max-width: 760px; background: var(--surface); border-radius: 12px; padding: 18px; max-height: 85vh; overflow-y: auto; }
          .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
          .detail-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          .detail-table th, .detail-table td { border: 1px solid var(--border); padding: 10px; }
          .final-balance strong { font-size:22px; color:#16a34a; }
        `}</style>

        {loading && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
            <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: '8px' }}>Processing…</div>
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
                    <td>{c.note || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* INSIGHT TAB */}
        <div className={activeTab !== "insight" ? "hidden" : ""}>
          <h3>Laporan Ringkasan Kas</h3>
          <div className="insight-summary">
            <div className="insight-row">
              <span>Pemasukan {insight?.lastMonth?.month}</span>
              <strong style={{ color: "#28a745" }}>{format(insight?.lastMonth?.incomeTotal || 0)}</strong>
            </div>

            <div className="insight-row">
              <span>Pengeluaran {insight?.lastMonth?.month}</span>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <strong style={{ color: "#dc3545" }}>{format(insight?.lastMonth?.expenseTotal || 0)}</strong>
                <button type="button" className="insight-link" onClick={() => { setModalType("last"); setShowInsightModal(true); }}>lihat detail</button>
              </div>
            </div>

            <div className="insight-row" style={{ backgroundColor: "rgba(0,123,255,0.05)", padding: "12px 8px" }}>
              <span>Sisa Saldo {insight?.lastMonth?.month}</span>
              <strong style={{ color: "#007bff" }}>{format(insight?.lastMonth?.remainingBalance || 0)}</strong>
            </div>

            <hr className="insight-divider" />

            <div className="insight-row">
              <span>Uang Masuk Bulan Ini (+ sisa lalu)</span>
              <strong>{format(insight?.summary?.currentIncomePlusLastRemaining || 0)}</strong>
            </div>

            <div className="insight-row">
              <span>Pengeluaran Bulan Ini</span>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <strong style={{ color: "#dc3545" }}>{format(insight?.currentMonth?.expenseTotal || 0)}</strong>
                <button type="button" className="insight-link" onClick={() => { setModalType("current"); setShowInsightModal(true); }}>lihat detail</button>
              </div>
            </div>

            <div className="insight-row final-balance">
              <span>Total Saldo Saat Ini</span>
              <strong>{format(insight?.summary?.currentBalance || 0)}</strong>
            </div>
          </div>

          <h4>Daftar Tunggakan</h4>
          <div>
            {pagedInsight.length > 0 ? (
              pagedInsight.map((r, i) => (
                <div key={i} className="insight-card">
                  <b>{(pageInsight - 1) * perPageInsight + i + 1}. {r.house}</b>
                  <div>• Nunggak: {r.jumlah} periode</div>
                  <div style={{ fontSize: '13px', color: '#666' }}>• Periode: {r.unpaid.join(", ")}</div>
                </div>
              ))
            ) : (
              <div className="insight-card">Tidak ada tunggakan.</div>
            )}
          </div>

          {insightResult.length > 0 && (
            <div className="pagination">
              <button disabled={pageInsight === 1} onClick={() => setPageInsight((p) => p - 1)}>Prev</button>
              <span>Page {pageInsight}/{totalPageInsight}</span>
              <button disabled={pageInsight === totalPageInsight} onClick={() => setPageInsight((p) => p + 1)}>Next</button>
            </div>
          )}
        </div>

        {/* MODAL DETAIL */}
        {showInsightModal && (
          <div className="modal-overlay" onClick={() => setShowInsightModal(false)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div style={{ fontWeight: 700 }}>Detail Pengeluaran {modalType === "last" ? insight?.lastMonth?.month : insight?.currentMonth?.month}</div>
                <button onClick={() => setShowInsightModal(false)}>✕</button>
              </div>
              <div style={{ marginBottom: 12 }}>Total: <b>{format(modalType === "last" ? insight?.lastMonth?.expenseTotal : insight?.currentMonth?.expenseTotal)}</b></div>
              <table className="detail-table">
                <thead>
                  <tr><th>Tanggal</th><th>Keterangan</th><th>Amount</th></tr>
                </thead>
                <tbody>
                  {(modalType === "last" ? insight?.lastMonth?.expenses : insight?.currentMonth?.expenses || []).map((e, i) => (
                    <tr key={i}>
                      <td>{e.date}</td>
                      <td>{e.note}</td>
                      <td>{format(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}