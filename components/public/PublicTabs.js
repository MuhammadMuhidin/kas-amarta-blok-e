"use client";

export default function PublicTabs({ activeTab, setActiveTab }) {
  return (
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
    </div>
  );
}
