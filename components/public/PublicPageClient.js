"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CashflowTab from "@/components/public/tabs/CashflowTab";
import InsightTab from "@/components/public/tabs/InsightTab";
import PaymentStatusTab from "@/components/public/tabs/PaymentStatusTab";
import PublicTabs from "@/components/public/PublicTabs";
import ReceiptPreviewModal from "@/components/public/ReceiptPreviewModal";
import ResidentDetailModal from "@/components/public/ResidentDetailModal";
import useAnimatedNumber from "@/hooks/public/useAnimatedNumber";
import usePublicSummary from "@/hooks/public/usePublicSummary";
import {
  buildInsightResult,
  buildPaymentList,
  calculateBalanceDelta,
  calculateBalanceDeltaAmount,
  calculateCashflowTotals,
  calculateExpenseDelta,
  calculateExpenseDeltaAmount,
  countPaidInLastPeriod,
  filterCashflows,
} from "@/lib/public/publicCalculations";
import { formatCashflowNote } from "@/lib/public/publicFormatters";

const perPagePay = 16;
const perPageInsight = 2;
const chunk = 20;

export default function PublicPageClient() {
  const router = useRouter();
  const paySliderRef = useRef(null);
  const { data, insight, loading, error, selectedPeriod, setSelectedPeriod } = usePublicSummary();

  const [activeTab, setActiveTab] = useState("payment");
  const [searchTerm, setSearchTerm] = useState("");
  const [loadedCashflow, setLoadedCashflow] = useState(20);
  const [showInsightModal, setShowInsightModal] = useState(false);
  const [modalType, setModalType] = useState("last");
  const [paySlideIndex, setPaySlideIndex] = useState(0);
  const [insightSlideIndex, setInsightSlideIndex] = useState(0);
  const [selectedResident, setSelectedResident] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [receiptPreviewError, setReceiptPreviewError] = useState(false);

  function downloadPDF() {
    router.push("/report");
  }

  function goToLogin() {
    router.push("/login");
  }

  function openReceiptPreview(receiptUrl, note = "") {
    setReceiptPreviewError(false);
    setSelectedReceipt({ url: receiptUrl, note: formatCashflowNote(note) });
  }

  function closeReceiptPreview() {
    setSelectedReceipt(null);
    setReceiptPreviewError(false);
  }

  const paymentList = useMemo(
    () => buildPaymentList({ persons: data.persons, payments: data.payments, selectedPeriod }),
    [data.persons, data.payments, selectedPeriod],
  );

  const totalPagePay = Math.max(1, Math.ceil(paymentList.length / perPagePay));

  const filteredCashflow = useMemo(
    () => filterCashflows(data.cashflows, searchTerm),
    [data.cashflows, searchTerm],
  );

  const totals = useMemo(
    () => calculateCashflowTotals(data.cashflows),
    [data.cashflows],
  );

  const animatedIncome = useAnimatedNumber(activeTab === "cashflow" ? totals.inc : 0);
  const animatedExpense = useAnimatedNumber(activeTab === "cashflow" ? totals.exp : 0);
  const animatedNet = useAnimatedNumber(activeTab === "cashflow" ? totals.net : 0);
  const animatedLastMonthExpense = useAnimatedNumber(activeTab === "insight" ? insight?.lastMonth?.expenseTotal || 0 : 0);
  const animatedLastMonthRemaining = useAnimatedNumber(activeTab === "insight" ? insight?.lastMonth?.remaining || 0 : 0);
  const animatedCurrentIncomePlusLastRemaining = useAnimatedNumber(activeTab === "insight" ? insight?.summary?.currentIncomePlusLastRemaining || 0 : 0);
  const animatedCurrentMonthExpense = useAnimatedNumber(activeTab === "insight" ? insight?.currentMonth?.expenseTotal || 0 : 0);
  const animatedCurrentBalance = useAnimatedNumber(activeTab === "insight" ? insight?.summary?.currentBalance || 0 : 0);

  const expenseDelta = useMemo(() => calculateExpenseDelta(insight), [insight]);
  const expenseDeltaAmount = useMemo(() => calculateExpenseDeltaAmount(insight), [insight]);
  const balanceDelta = useMemo(() => calculateBalanceDelta(insight), [insight]);
  const balanceDeltaAmount = useMemo(() => calculateBalanceDeltaAmount(insight), [insight]);

  const paidInLastPeriodCount = useMemo(
    () => countPaidInLastPeriod({ payments: data.payments, periods: data.periods }),
    [data.payments, data.periods],
  );

  const insightResult = useMemo(
    () => buildInsightResult({ persons: data.persons, payments: data.payments, periods: data.periods }),
    [data.persons, data.payments, data.periods],
  );

  const totalPageInsight = Math.max(1, Math.ceil(insightResult.length / perPageInsight));

  if (error) {
    return (
      <div className="page-wrap">
        <div className="insight-card">{error}</div>
      </div>
    );
  }

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

        <header className="hero-header timeline-hero">
          <div className="hero-eyebrow">Amarta Residence • Blok E</div>
          <p className="hero-desc">
            Pusat transparansi iuran, pengeluaran,
            <br />
            dan laporan kas warga.
          </p>
        </header>

        <PublicTabs activeTab={activeTab} setActiveTab={setActiveTab} onLogin={goToLogin} />

        <PaymentStatusTab
          active={activeTab === "payment"}
          periods={data.periods}
          selectedPeriod={selectedPeriod}
          setSelectedPeriod={setSelectedPeriod}
          paymentList={paymentList}
          totalPagePay={totalPagePay}
          perPagePay={perPagePay}
          paySlideIndex={paySlideIndex}
          setPaySlideIndex={setPaySlideIndex}
          setSelectedResident={setSelectedResident}
          paySliderRef={paySliderRef}
        />

        <CashflowTab
          active={activeTab === "cashflow"}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          setLoadedCashflow={setLoadedCashflow}
          animatedIncome={animatedIncome}
          animatedExpense={animatedExpense}
          animatedNet={animatedNet}
          filteredCashflow={filteredCashflow}
          loadedCashflow={loadedCashflow}
          chunk={chunk}
          onOpenReceipt={openReceiptPreview}
        />

        <InsightTab
          active={activeTab === "insight"}
          insight={insight}
          paidInLastPeriodCount={paidInLastPeriodCount}
          insightResult={insightResult}
          totalPageInsight={totalPageInsight}
          perPageInsight={perPageInsight}
          insightSlideIndex={insightSlideIndex}
          setInsightSlideIndex={setInsightSlideIndex}
          showInsightModal={showInsightModal}
          setShowInsightModal={setShowInsightModal}
          modalType={modalType}
          setModalType={setModalType}
          expenseDelta={expenseDelta}
          expenseDeltaAmount={expenseDeltaAmount}
          balanceDelta={balanceDelta}
          balanceDeltaAmount={balanceDeltaAmount}
          animatedLastMonthExpense={animatedLastMonthExpense}
          animatedLastMonthRemaining={animatedLastMonthRemaining}
          animatedCurrentIncomePlusLastRemaining={animatedCurrentIncomePlusLastRemaining}
          animatedCurrentMonthExpense={animatedCurrentMonthExpense}
          animatedCurrentBalance={animatedCurrentBalance}
          onDownloadPDF={downloadPDF}
          onOpenReceipt={openReceiptPreview}
        />

        <ResidentDetailModal
          resident={selectedResident}
          payments={data.payments}
          onClose={() => setSelectedResident(null)}
        />

        <ReceiptPreviewModal
          receipt={selectedReceipt}
          hasError={receiptPreviewError}
          onError={() => setReceiptPreviewError(true)}
          onClose={closeReceiptPreview}
        />
      </div>
    </>
  );
}
