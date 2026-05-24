"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import "@/app/page.css";

function useAnimatedNumber(value, duration = 900) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let frame;

    const start = 0;
    const end = Number(value) || 0;
    const startTime = performance.now();

    function animate(now) {
      const progress = Math.min((now - startTime) / duration, 1);

      const eased = 1 - Math.pow(1 - progress, 3);

      const current = Math.floor(start + (end - start) * eased);

      setDisplayValue(current);

      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    }

    frame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return displayValue;
}

export default function CashflowPage() {
  /* ==== STATE ==== */
  const [data, setData] = useState({
    payments: [],
    cashflows: [],
    persons: [],
    periods: [],
  });
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [activeTab, setActiveTab] = useState("payment");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [pagePay, setPagePay] = useState(1);
  const [pageInsight, setPageInsight] = useState(1);
  const [loadedCashflow, setLoadedCashflow] = useState(20);
  const [showInsightModal, setShowInsightModal] = useState(false);
  const [modalType, setModalType] = useState("last");
  const [paySlideIndex, setPaySlideIndex] = useState(0);
  const [insightSlideIndex, setInsightSlideIndex] = useState(0);
  const [selectedResident, setSelectedResident] = useState(null);

  const paySliderRef = useRef(null);

  const FETCH_URL = "/api/sheets/summary";
  const perPagePay = 16;
  const perPageInsight = 2;
  const chunk = 20;

  const router = useRouter();

  const downloadPDF = () => {
    router.push("/report");
  };

  const goToLogin = () => {
    router.push("/login");
  };

  /* ==== INIT & FETCH ==== */
  useEffect(() => {
    async function load() {
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

    load();
  }, []);

  /* ==== HELPERS ==== */
  const format = (n) => "Rp" + Number(n).toLocaleString("id-ID");
  const insight = data.insight || {};
  const formatDate = (date) => {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatPeriod = (period) => {
    if (!period || period === "-") return "-";

    const normalized = String(period).slice(0, 7);

    if (!/^\d{4}-\d{2}$/.test(normalized)) {
      return period;
    }

    return new Date(`${normalized}-01`).toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric",
    });
  };

  const getLastPaymentPeriod = (resident) => {
    if (!resident) return "-";

    const paid = data.payments
      .filter(
        (pay) =>
          pay.person_id === resident.id &&
          pay.person_house === resident.house,
      )
      .sort((a, b) =>
        String(b.period).localeCompare(String(a.period)),
      );

    return paid[0]?.period || "Belum ada pembayaran";
  };

  const getSelectedPeriodStatus = (resident) => {
    if (!resident) return "-";

    if (resident.notApplicable) {
      return "Belum menjadi anggota";
    }

    return resident.paid ? "Sudah bayar" : "Belum bayar";
  };

const getRegisteredServices = (resident) => {
  if (!resident) return "-";

  const services = ["Kas"];

  if ((resident.trash || "").toUpperCase() === "Y") {
    services.push("Sampah");
  }

  return services.join(" dan ");
};

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
            (pay) => pay.person_id === p.id && pay.period.slice(0, 7) === per,
          );
        }

        return {
          id: p.id,
          house: p.house,
          join_date: p.join_date,
          trash: p.trash,
          paid,
          notApplicable,
        };
      })
      .sort((a, b) =>
        a.house.localeCompare(b.house, undefined, {
          numeric: true,
        }),
      );
  }, [selectedPeriod, data]);

  const totalPagePay = Math.max(1, Math.ceil(paymentList.length / perPagePay));

  /* ==== LOGIC: CASHFLOW ==== */
  const filteredCashflow = useMemo(() => {
    return data.cashflows.filter((c) =>
      (c.note || "").toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [searchTerm, data.cashflows]);

  const totals = useMemo(() => {
    let inc = 0;
    let exp = 0;

    data.cashflows.forEach((c) => {
      if (c.type === "income") inc += c.amount;
      else exp += c.amount;
    });

    return {
      inc,
      exp,
      net: inc - exp,
    };
  }, [data.cashflows]);

  const animatedIncome = useAnimatedNumber(
    activeTab === "cashflow" ? totals.inc : 0,
  );

  const animatedExpense = useAnimatedNumber(
    activeTab === "cashflow" ? totals.exp : 0,
  );

  const animatedNet = useAnimatedNumber(
    activeTab === "cashflow" ? totals.net : 0,
  );

  const animatedLastMonthExpense = useAnimatedNumber(
    activeTab === "insight"
      ? insight?.lastMonth?.expenseTotal || 0
      : 0,
  );

  const animatedLastMonthRemaining = useAnimatedNumber(
    activeTab === "insight"
      ? insight?.lastMonth?.remaining || 0
      : 0,
  );

  const animatedCurrentIncomePlusLastRemaining =
    useAnimatedNumber(
      activeTab === "insight"
        ? insight?.summary
            ?.currentIncomePlusLastRemaining || 0
        : 0,
    );

  const animatedCurrentMonthExpense =
    useAnimatedNumber(
      activeTab === "insight"
        ? insight?.currentMonth?.expenseTotal || 0
        : 0,
    );

  const animatedCurrentBalance =
    useAnimatedNumber(
      activeTab === "insight"
        ? insight?.summary?.currentBalance || 0
        : 0,
    );

const expenseDelta = useMemo(() => {
  const current =
    insight?.currentMonth?.expenseTotal || 0;

  const last =
    insight?.lastMonth?.expenseTotal || 0;

  if (!last) return 0;

  return ((current - last) / last) * 100;
}, [insight]);

const balanceDelta = useMemo(() => {
  const current =
    insight?.summary?.currentBalance || 0;

  const last =
    insight?.lastMonth?.remaining || 0;

  if (!last) return 0;

  return ((current - last) / last) * 100;
}, [insight]);

  const animatedModalExpense =
    useAnimatedNumber(
      showInsightModal
        ? modalType === "last"
          ? insight?.lastMonth?.expenseTotal || 0
          : insight?.currentMonth?.expenseTotal || 0
        : 0,
    );

  /* ==== LOGIC: INSIGHT ==== */
  const activeMembersCount = useMemo(() => {
    if (!data.periods.length) return 0;

    const lastPeriod = [...data.periods].sort().pop();

    return data.persons.filter((am) => {
      if (!am.join_date) return true;
      return am.join_date.slice(0, 7) <= lastPeriod;
    }).length;
  }, [data]);

  const paidInLastPeriodCount = useMemo(() => {
    if (!data.periods.length) return 0;

    const last = [...data.periods].sort((a, b) => a.localeCompare(b)).pop();

    return new Set(
      data.payments
        .filter((p) => (p.period || "").slice(0, 7) === last)
        .map((p) => `${p.person_id}-${p.person_house}`),
    ).size;
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
          .filter(
            (pay) => pay.person_id === p.id && pay.person_house === p.house,
          )
          .map((pay) => pay.period.slice(0, 7));

        const unpaid = validPeriods.filter((pr) => !paid.includes(pr));

        return {
          house: p.house,
          name: p.name,
          unpaid,
          jumlah: unpaid.length,
        };
      })
      .filter((r) => r.jumlah >= 1)
      .sort((a, b) =>
        a.house.localeCompare(b.house, undefined, {
          numeric: true,
        }),
      );
  }, [data]);

  const totalPageInsight = Math.max(
    1,
    Math.ceil(insightResult.length / perPageInsight),
  );

  return (
    <>
      <div className="page-wrap">
        {loading && (
          <div className="action-loader show">
            <div className="loader-card">
              <div className="loader-row">
                <div className="loader-icon">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>

                <div className="loader-text">Sedang memuat data...</div>
              </div>
            </div>
          </div>
        )}

        {downloadingPdf && (
          <div className="action-loader show">
            <div className="loader-card">
              <div className="loader-row">
                <div className="loader-icon">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>

                <div className="loader-text">Sedang memproses laporan..</div>
              </div>
            </div>
          </div>
        )}
        <header className="hero-header">
          <div className="hero-eyebrow">Amarta Residence • Blok E</div>
          <p className="hero-desc">
            Pusat transparansi pembayaran
            <br />
            dan pengelolaan kas warga
          </p>
        </header>

        <div className="tab">
          <button
            className={activeTab === "payment" ? "active" : ""}
            onClick={() => setActiveTab("payment")}
          >
            💳 Status Pembayaran
          </button>

          <button
            className={activeTab === "cashflow" ? "active" : ""}
            onClick={() => setActiveTab("cashflow")}
          >
            📝 Arus Kas
          </button>

          <button
            className={activeTab === "insight" ? "active" : ""}
            onClick={() => setActiveTab("insight")}
          >
            📊 Laporan
          </button>

          <button onClick={() => router.push("/login")}>🔒 Login</button>
        </div>

        {/* PAYMENT TAB */}
        <div className={activeTab !== "payment" ? "hidden" : ""}>
          <label>Pilih Periode:</label>

          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
          >
            {data.periods.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <div
            ref={paySliderRef}
            className="pay-slider"
            onScroll={(e) => {
              const width = e.currentTarget.clientWidth;

              const index = Math.round(e.currentTarget.scrollLeft / width);

              setPaySlideIndex(index);
            }}
          >
            {Array.from({ length: totalPagePay }).map((_, pageIndex) => {
              const items = paymentList.slice(
                pageIndex * perPagePay,
                (pageIndex + 1) * perPagePay,
              );

              return (
                <div className="pay-slide-page" key={pageIndex}>
                  <div className="pay-grid">
                    {items.map((p, idx) => (
                      <div
                        key={idx}
                        className="pay-item"
                        onClick={() => setSelectedResident(p)}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <span>{p.house}</span>

                          <span
                            style={{
                              fontWeight: 700,
                              color: p.notApplicable
                                ? "#6c757d"
                                : p.paid
                                  ? "#28a745"
                                  : "#dc3545",
                            }}
                          >
                            {p.notApplicable
                              ? "Belum Bergabung"
                              : p.paid
                                ? "Sudah Bayar"
                                : "Belum Bayar"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {totalPagePay > 1 && (
            <div className="pay-dots">
              {Array.from({
                length: totalPagePay,
              }).map((_, i) => (
                <span key={i} className={paySlideIndex === i ? "active" : ""} />
              ))}
            </div>
          )}
        </div>

        {/* CASHFLOW TAB */}
        <div className={activeTab !== "cashflow" ? "hidden" : ""}>
          <div className="searchbox-wrap">
            <input
              className="searchbox-input"
              placeholder="cari catatan..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setLoadedCashflow(20);
              }}
            />

            {searchTerm && (
              <button
                type="button"
                className="searchbox-clear"
                onClick={() => {
                  setSearchTerm("");
                  setLoadedCashflow(20);
                }}
                aria-label="Batalkan pencarian"
              >
                ×
              </button>
            )}
          </div>

          <div className="summary">
            <div className="summary-item">
              <span className="summary-label">Total Pemasukan</span>
              <span style={{ color: "#28a745" }} className="summary-value">
                {format(animatedIncome)}
              </span>
            </div>

            <div className="summary-item">
              <span className="summary-label">Total Pengeluaran</span>
              <span style={{ color: "#dc3545" }} className="summary-value">
                {format(animatedExpense)}
              </span>
            </div>

            <div className="summary-item">
              <span className="summary-label">Sisa Saldo</span>
              <span style={{ color: "#007bff" }} className="summary-value">
                {format(animatedNet)}
              </span>
            </div>
          </div>

          <div
            className="table-container cashflow-body"
            onScroll={(e) => {
              const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

              if (scrollTop + clientHeight >= scrollHeight - 1) {
                setLoadedCashflow((prev) => prev + chunk);
              }
            }}
          >
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Tipe</th>
                  <th>Nominal</th>
                  <th>Catatan</th>
                </tr>
              </thead>

              <tbody>
                {filteredCashflow.slice(0, loadedCashflow).map((c, i) => (
                  <tr key={i}>
                    <td>{c.date || "-"}</td>

                    <td>
                      <span className={`badge ${c.type}`}>
                        {{
                          income: "Pemasukan",
                          expense: "Pengeluaran",
                        }[c.type] || c.type}
                      </span>
                    </td>

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
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <h2 style={{ margin: 0 }}>Rekap keuangan kas</h2>

            <button
              onClick={downloadPDF}
              style={{
                padding: "8px 14px",
                background: "var(--btn-primary)",
                color: "var(--btn-text)",
                border: "1px solid var(--btn-download-border)",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "var(--font-small)",
                fontWeight: "600",
              }}
            >
              Download Laporan PDF
            </button>
          </div>

          <div className="insight-summary">
            <div className="insight-row">
              <span className="insight-label">
                Pengeluaran bulan {insight?.lastMonth?.month}
              </span>

              <div className="insight-action">
                <strong style={{ color: "#dc3545" }}>
                  {format(animatedLastMonthExpense)}
                </strong>

                <button
                  className="insight-link"
                  onClick={() => {
                    setModalType("last");
                    setShowInsightModal(true);
                  }}
                >
                  lihat detail
                </button>
              </div>
            </div>

            <div className="insight-row-final highlight-blue">
              <span>Sisa saldo kumulatif per {insight?.lastMonth?.month}</span>
              <strong>{format(animatedLastMonthRemaining)}</strong>
            </div>

            <hr className="insight-divider" />

            <div className="insight-row">
              <span>
                Kas bulan {insight?.currentMonth?.month} dari{" "}
                {paidInLastPeriodCount} rumah + sisa bulan lalu
              </span>
              <strong>
                {format(animatedCurrentIncomePlusLastRemaining)}
              </strong>
            </div>

            <div className="insight-row">
              <span>Pengeluaran bulan ini</span>

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                }}
              >
                
<div className="insight-value-stack">
  <strong style={{ color: "#dc3545" }}>
    {format(animatedCurrentMonthExpense)}
  </strong>

  <span
    className={`insight-delta ${
      expenseDelta > 0
        ? "bad"
        : expenseDelta < 0
          ? "good"
          : "neutral"
    }`}
  >
    {expenseDelta > 0 ? "↑naik " : expenseDelta < 0 ? "↓turun" : "•tetap"}{" "}
    {Math.abs(expenseDelta).toFixed(0)}%
  </span>
</div>

                <button
                  className="insight-link"
                  onClick={() => {
                    setModalType("current");
                    setShowInsightModal(true);
                  }}
                >
                  lihat detail
                </button>
              </div>
            </div>

<div className="insight-row final-balance">
  <span>Total saldo saat ini</span>

  <div className="insight-value-stack">
    <strong>{format(animatedCurrentBalance)}</strong>

    <span
      className={`insight-delta ${
        balanceDelta > 0
          ? "good"
          : balanceDelta < 0
            ? "bad"
            : "neutral"
      }`}
    >
      {balanceDelta > 0 ? "↑naik" : balanceDelta < 0 ? "↓turun" : "•tetap"}{" "}
      {Math.abs(balanceDelta).toFixed(0)}% dari bulan lalu
    </span>
  </div>
</div>
          </div>

          <h2>Laporan Tunggakan Saat ini</h2>

          {insightResult.length > 0 ? (
            <>
              <div
                className="insight-slider"
                onScroll={(e) => {
                  const width = e.currentTarget.clientWidth;

                  const index = Math.round(e.currentTarget.scrollLeft / width);

                  setInsightSlideIndex(index);
                }}
              >
                {Array.from({ length: totalPageInsight }).map(
                  (_, pageIndex) => {
                    const items = insightResult.slice(
                      pageIndex * perPageInsight,
                      (pageIndex + 1) * perPageInsight,
                    );

                    return (
                      <div className="insight-slide-page" key={pageIndex}>
                        {items.map((r, i) => (
                          <div key={i} className="insight-card">
                            <b>
                              {pageIndex * perPageInsight + i + 1}. {r.house}
                            </b>

                            <div>• Nunggak: {r.jumlah} periode</div>

                            <div>• Periode: {r.unpaid.join(", ")}</div>
                          </div>
                        ))}
                      </div>
                    );
                  },
                )}
              </div>

              {totalPageInsight > 1 && (
                <div className="insight-dots">
                  {Array.from({
                    length: totalPageInsight,
                  }).map((_, i) => (
                    <span
                      key={i}
                      className={insightSlideIndex === i ? "active" : ""}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="insight-card">Tidak ada tunggakan.</div>
          )}
        </div>

        {/* MODAL RESIDENT */}
        {selectedResident && (
          <div
            className="modal-overlay"
            onClick={() => setSelectedResident(null)}
          >
            <div
              className="resident-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="resident-house">
                {selectedResident.house}
              </div>

              <div className="resident-section">
                <div className="resident-label">
                  Layanan terdaftar
                </div>

                <div className="resident-value">
                  {getRegisteredServices(selectedResident)}
                </div>
              </div>

              <div className="resident-section">
                <div className="resident-label">
                  Bergabung sejak
                </div>

                <div className="resident-value">
                  {formatDate(selectedResident.join_date)}
                </div>
              </div>

              <div className="resident-section">
                <div className="resident-label">
                  Status periode dipilih
                </div>

                <div className="resident-value">
                  {getSelectedPeriodStatus(selectedResident)}
                </div>
              </div>

              <div className="resident-section">
                <div className="resident-label">
                  Pembayaran terakhir
                </div>

                <div className="resident-value">
                  {formatPeriod(
                    getLastPaymentPeriod(selectedResident),
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DETAIL */}
        {showInsightModal && (
          <div
            className="modal-overlay"
            onClick={() => setShowInsightModal(false)}
          >
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title">
                  Detail Pengeluaran Bulan{" "}
                  {modalType === "last"
                    ? insight?.lastMonth?.month
                    : insight?.currentMonth?.month}
                </div>
              </div>

              <div className="modal-section">
                <div
                  style={{
                    marginBottom: 12,
                    fontWeight: 700,
                  }}
                >
                  Total Pengeluaran:{" "}
                  {format(
                    modalType === "last"
                      ? insight?.lastMonth?.expenseTotal || 0
                      : insight?.currentMonth?.expenseTotal || 0,
                  )}
                </div>

                <table className="detail-table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Keterangan</th>
                      <th>Nominal</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(modalType === "last"
                      ? insight?.lastMonth?.expenses || []
                      : insight?.currentMonth?.expenses || []
                    ).map((e, i) => (
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
          </div>
        )}
      </div>
    </>
  );
}
