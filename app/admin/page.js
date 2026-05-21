"use client"

import AdminSettings from "@/components/AdminSettings"
import PaymentTab from "@/components/admin-tabs/PaymentTab"
import PersonalTab from "@/components/admin-tabs/PersonalTab"
import CashflowTab from "@/components/admin-tabs/CashflowTab"
import DepositTab from "@/components/admin-tabs/DepositTab"
import ActivityTab from "@/components/admin-tabs/ActivityTab"
import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import "./page.css"

function getCookie(name) {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1]
}

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
}

export default function AdminPage() {
  const router = useRouter()

  const [tab, setTab] = useState("personal")
  const [personal, setPersonal] = useState([])
  const [member, setMember] = useState({
    house: "",
    name: "",
    join_date: "",
    trash: "",
  })

  const [selected, setSelected] = useState([])

  const [payment, setPayment] = useState({
    period: "",
    amount: 25000,
  })

  const [cashflow, setCashflow] = useState({
    type: "",
    amount: "",
    note: "",
  })

  const [payments, setPayments] = useState([])
  const [cashflows, setCashflows] = useState([])
  const [trash, setTrash] = useState([])
  const [deposits, setDeposits] = useState([])
  const [activities, setActivities] = useState([])

  const [loadingAdd, setLoadingAdd] = useState(false)
  const [loadingPayment, setLoadingPayment] = useState(false)
  const [loadingCashflow, setLoadingCashflow] = useState(false)
  const [savingDeposit, setSavingDeposit] = useState(false)
  const [payingDepositId, setPayingDepositId] = useState("")

  const [popup, setPopup] = useState(null)

  const [memberFilter, setMemberFilter] = useState({
    active: false,
    inactive: false,
    trashYes: false,
    trashNo: false,
  })

  const [memberSearch, setMemberSearch] = useState("")

  const [appConfig, setAppConfig] = useState(null)
  const [configError, setConfigError] = useState("")

  const [depositForm, setDepositForm] = useState({
    person_id: "",
    end_period: "",
  })

  function showPopup(text, type = "success") {
    setPopup({ text, type })

    setTimeout(() => {
      setPopup(null)
    }, 2500)
  }

  async function loadPersonal() {
    const res = await fetch("/api/sheets/personal", {
      cache: "no-store",
    })

    const data = await res.json()

    setPersonal(data)
  }

  async function loadPayment() {
    const res = await fetch("/api/sheets/payment", {
      cache: "no-store",
    })

    const data = await res.json()

    setPayments(data)
  }

  async function loadCashflow() {
    const res = await fetch("/api/sheets/cashflow", {
      cache: "no-store",
    })

    const data = await res.json()

    setCashflows(data)
  }

  async function loadTrash() {
    const res = await fetch("/api/sheets/trash", {
      cache: "no-store",
    })

    const data = await res.json()

    setTrash(data)
  }

  async function loadDeposits() {
    const res = await fetch("/api/sheets/deposit", {
      cache: "no-store",
    })

    const data = await res.json()

    setDeposits(data)
  }

  async function loadActivities() {
    const res = await fetch("/api/admin/activity", {
      cache: "no-store",
    })

    const data = await res.json()

    setActivities(data.activities || [])
  }

  async function loadAppConfig() {
    try {
      const res = await fetch("/api/admin/settings/app", {
        cache: "no-store",
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to load configuration")
      }

      setAppConfig(data.config)
      setPayment((prev) => ({
        ...prev,
        amount: Number(data.config?.monthly_fee || 0),
      }))
      setConfigError("")
    } catch (err) {
      setConfigError(err.message || "Failed to load configuration")
    }
  }

  useEffect(() => {
    loadPersonal()
    loadPayment()
    loadCashflow()
    loadTrash()
    loadDeposits()
    loadActivities()
    loadAppConfig()
  }, [])

  async function addMember(e) {
    e.preventDefault()

    setLoadingAdd(true)

    try {
      const csrfToken = getCookie("csrf_token")

      const res = await fetch("/api/sheets/personal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify(member),
      })

      if (!res.ok) {
        throw new Error("Failed to add member")
      }

      showPopup("Member added successfully")

      setMember({
        house: "",
        name: "",
        join_date: "",
        trash: "",
      })

      await loadPersonal()
      await loadActivities()
    } catch (err) {
      showPopup(err.message || "Failed to add member", "error")
    } finally {
      setLoadingAdd(false)
    }
  }

  async function recordPayment(e) {
    e.preventDefault()

    if (!appConfig) {
      showPopup("Konfigurasi kas belum tersedia. Pembayaran tidak bisa dicatat.", "error")
      return
    }

    if (!payment.period) {
      showPopup("Masukkan periode pembayaran terlebih dahulu", "error")
      return
    }

    if (selected.length === 0) {
      showPopup("Pilih minimal 1 rumah yang belum dibayar", "error")
      return
    }

    setLoadingPayment(true)

    try {
      let success = 0

      for (const id of selected) {
        const p = personal.find((x) => x.id === id)

        if (!p) continue

        const csrfToken = getCookie("csrf_token")

        const res = await fetch("/api/sheets/payment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
          },
          body: JSON.stringify({
            house: p.house,
            period: payment.period,
            amount: payment.amount,
          }),
        })

        if (res.ok) {
          success += 1

          const paymentData = await res.json()

          if ((p.trash || "").toUpperCase() === "Y") {
            await fetch("/api/sheets/trash", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-csrf-token": csrfToken,
              },
              body: JSON.stringify({
                payment_id: paymentData.payment_id,
                person_id: p.id,
                house: p.house,
                name: p.name,
                period: payment.period,
                amount: appConfig.trash_fee,
                source: "payment",
              }),
            })
          }
        }
      }

      showPopup(`Payment recorded for ${success} house successfully`, "success")

      setSelected([])

      setPayment({
        period: "",
        amount: appConfig.monthly_fee,
      })

      await loadPayment()
      await loadTrash()
      await loadActivities()
    } finally {
      setLoadingPayment(false)
    }
  }
