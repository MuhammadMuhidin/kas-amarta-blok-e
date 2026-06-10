"use client";

import Link from "next/link";

export default function PublicTabs({ activeTab, setActiveTab }) {
  return (
    <div className="tab">
      <Link className="tab-link" href="/">
        🏠 Beranda
      </Link>

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
    </div>
  );
}
