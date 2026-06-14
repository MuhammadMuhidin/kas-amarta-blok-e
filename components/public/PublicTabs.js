"use client";

export default function PublicTabs({ activeTab, setActiveTab }) {
  return (
    <div className="tab">
      <button
        className={activeTab === "payment" ? "active" : ""}
        onClick={() => setActiveTab("payment")}
      >
        &#128179; Status Pembayaran
      </button>

      <button
        className={activeTab === "cashflow" ? "active" : ""}
        onClick={() => setActiveTab("cashflow")}
      >
        &#128221; Arus Kas
      </button>

      <button
        className={activeTab === "arrears" ? "active" : ""}
        onClick={() => setActiveTab("arrears")}
      >
        &#9203; Tunggakan
      </button>

      <button
        className={activeTab === "insight" ? "active" : ""}
        onClick={() => setActiveTab("insight")}
      >
        &#128202; Laporan
      </button>
    </div>
  );
}
