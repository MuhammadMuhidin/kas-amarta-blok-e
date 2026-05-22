"use client";

import AdminActivityPanel from "@/components/AdminActivityPanel";
import AdminSettings from "@/components/AdminSettings";
import CashflowTab from "@/components/admin-tabs/CashflowTab";
import DepositTab from "@/components/admin-tabs/DepositTab";
import MonitoringTab from "@/components/admin-tabs/MonitoringTab";
import PaymentTab from "@/components/admin-tabs/PaymentTab";
import PersonalTab from "@/components/admin-tabs/PersonalTab";
import SummaryBackupTab from "@/components/admin-tabs/SummaryBackupTab";
import Toast from "@/components/Toast";
import {
  buildPaymentCashflowIntegrity,
  buildSuspiciousData,
  buildTrashMismatch,
} from "@/lib/adminMonitoring";
import {
  addMonths,
  getCurrentPeriod,
  getDepositStatus as resolveDepositStatus,
  sortDeposits,
} from "@/lib/depositUtils";
import {
  calculatePersonalStats,
  filterPersonal,
  searchPersonal,
  sortPersonal,
} from "@/lib/personalUtils";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import "./page.css";
import AdminLoading from "./loading";

function normalize(value) {
  return String(value || "").trim();
}

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState("personal");