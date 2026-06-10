"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";

import Toast from "@/components/Toast";
import ConfirmModal from "@/components/ConfirmModal";
import { ADMIN_ACCESS_ROLES } from "@/lib/adminRoles";

function getLoginErrorMessage(message, fallback = "Login failed") {
  const text = String(message || "").trim();
  const normalized = text.toLowerCase();

  if (!text) return fallback;
  if (normalized.includes("wrong password")) return "Wrong password";
  if (normalized.includes("wrong pin")) return "Wrong PIN";
  if (normalized.includes("otp harus 6 digit")) return "OTP must be 6 digits";
  if (normalized.includes("otp tidak valid")) return "Invalid OTP";
  if (normalized.includes("otp sudah expired")) return "OTP has expired";
  if (normalized.includes("otp tidak ditemukan") || normalized.includes("belum dikirim")) {
    return "OTP was not found or has not been sent";
  }
  if (normalized.includes("too many") || normalized.includes("rate limit")) {
    return "Too many attempts. Please try again later";
  }
  if (normalized.includes("passkey") || normalized.includes("webauth")) return text;

  return text;
}

export default function Login() {
  const router = useRouter();
  const [isDark, setIsDark] = useState(false);
  const [role, setRole] = useState("admin");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [pin, setPin] = useState("");
  const [needPin, setNeedPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState({ show: false, type: "info", message: "" });

  useEffect(() => {
    async function checkExistingSession() {
      try {
        const res = await fetch("/api/admin/sessions/check", { cache: "no-store" });
        if (res.ok) {
          router.replace("/admin");
          return;
        }
        if (res.status === 401) await fetch("/api/logout", { method: "POST", cache: "no-store" });
      } finally {
        setCheckingSession(false);
      }
    }
    checkExistingSession();
  }, [router]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () => setIsDark(media.matches);
    updateTheme();
    media.addEventListener("change", updateTheme);
    return () => media.removeEventListener("change", updateTheme);
  }, []);

  function notify(message, type = "info") {
    setToast({ show: true, type, message });
    setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 2600);
  }

  function resetOtpStep() {
    setOtp("");
    setOtpRequested(false);
    setNeedPin(false);
    setPin("");
  }

  function commonInputStyle() {
    return {
      ...styles.input,
      background: isDark ? "#1e293b" : "#fff",
      color: isDark ? "#fff" : "#000",
      border: isDark ? "1px solid #334155" : "1px solid #cbd5e1",
    };
  }

  async function requestOtp(e) {
    e?.preventDefault();
    if (loading || sendingOtp || needPin) return;
    if (!password.trim()) return notify("Password is required", "warning");

    setSendingOtp(true);
    try {
      const res = await fetch("/api/admin/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, password }),
      });
      const data = await res.json();
      if (!res.ok) return notify(getLoginErrorMessage(data.error, "Failed to send OTP"), "error");
      setOtpRequested(true);
      setOtp("");
      notify(data.message || "OTP sent to WhatsApp", "success");
    } catch (err) {
      notify(getLoginErrorMessage(err.message, "Failed to send OTP"), "error");
    } finally {
      setSendingOtp(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (loading) return;
    if (!password.trim()) return notify("Password is required", "warning");
    if (!otpRequested) return notify("Please request an OTP first", "warning");
    if (!otp.trim()) return notify("OTP is required", "warning");
    if (needPin && !pin.trim()) return notify("PIN is required", "warning");

    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, otp, password, pin: needPin ? pin : undefined }),
      });
      const data = await res.json();
      if (!res.ok) return notify(getLoginErrorMessage(data.error, "Login failed"), "error");
      if (data.need_pin) {
        setNeedPin(true);
        notify("Enter admin PIN", "info");
        return;
      }
      if (data.need_webauth) {
        notify("Passkey verification is required", "info");
        await loginWithWebAuth();
        return;
      }
      notify("Login successful", "success");
      router.replace("/admin");
    } catch (err) {
      notify(getLoginErrorMessage(err.message, "Login failed"), "error");
    } finally {
      setLoading(false);
    }
  }

  async function loginWithWebAuth() {
    try {
      const optionsRes = await fetch("/api/webauth/auth/options");
      const options = await optionsRes.json();
      if (!optionsRes.ok) return notify(getLoginErrorMessage(options.error, "Passkey is not available"), "error");

      const credential = await startAuthentication(options);
      const verifyRes = await fetch("/api/webauth/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) return notify(getLoginErrorMessage(verifyData.error, "Passkey verification failed"), "error");

      notify("Passkey verified successfully", "success");
      router.replace("/admin");
    } catch (err) {
      notify(getLoginErrorMessage(err.message, "Passkey verification cancelled"), "error");
    }
  }

  async function handleConfirmRegister() {
    setConfirmOpen(false);
    setLoading(true);
    try {
      notify("Preparing passkey", "info");
      const optionsRes = await fetch("/api/webauth/register/options");
      const options = await optionsRes.json();
      if (!optionsRes.ok) return notify(getLoginErrorMessage(options.error, "Failed to prepare passkey"), "error");

      const credential = await startRegistration(options);
      const verifyRes = await fetch("/api/webauth/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) return notify(getLoginErrorMessage(verifyData.error, "Passkey registration failed"), "error");
      notify("Passkey registered successfully", "success");
    } catch (err) {
      notify(getLoginErrorMessage(err.message, "Passkey registration cancelled"), "error");
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) return null;

  const step = needPin ? "pin" : otpRequested ? "otp" : "password";
  const subtitle = step === "password"
    ? "Select a role and enter your password"
    : step === "otp"
      ? "Enter the OTP sent to WhatsApp"
      : "Enter your admin PIN";

  return (
    <>
      <style jsx global>{`@keyframes securityPulse{0%,100%{opacity:.9;transform:scale(.995);filter:drop-shadow(0 0 0 rgba(250,204,21,0))}50%{opacity:1;transform:scale(1);filter:drop-shadow(0 0 6px rgba(250,204,21,.28))}}`}</style>
      <Toast {...toast} />
      <ConfirmModal
        open={confirmOpen}
        isDark={isDark}
        title="Register new passkey?"
        message="The existing passkey will be replaced."
        confirmText="Register"
        cancelText="Cancel"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirmRegister}
      />

      <div style={{ ...styles.wrapper, background: isDark ? "linear-gradient(135deg,#020617,#0f172a)" : "linear-gradient(135deg,#e0e7ff,#f8fafc)" }}>
        <form onSubmit={step === "password" ? requestOtp : submit} style={{ ...styles.card, background: isDark ? "#111827" : "#ffffff", border: isDark ? "1px solid #334155" : "1px solid rgba(226,232,240,.9)" }}>
          <div style={{ ...styles.badge, background: isDark ? "rgba(15,23,42,.92)" : "rgba(255,255,255,.92)", color: "#facc15", border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}` }}>
            Management Access
          </div>
          <h2 style={{ ...styles.title, color: isDark ? "#f8fafc" : "#0f172a" }}>Administrator Sign In</h2>
          <p style={{ ...styles.subtitle, color: isDark ? "#94a3b8" : "#64748b" }}>{subtitle}</p>

          {step === "password" && (
            <>
              <select
                value={role}
                disabled={loading || sendingOtp}
                onChange={(e) => {
                  setRole(e.target.value);
                  resetOtpStep();
                }}
                style={commonInputStyle()}
              >
                {ADMIN_ACCESS_ROLES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <input
                type="password"
                placeholder="Password"
                value={password}
                disabled={loading || sendingOtp}
                onChange={(e) => {
                  setPassword(e.target.value);
                  resetOtpStep();
                }}
                style={commonInputStyle()}
              />
              <button type="submit" disabled={loading || sendingOtp || !password.trim()} style={{ ...styles.button, opacity: loading || sendingOtp || !password.trim() ? 0.75 : 1 }}>
                {sendingOtp ? "Sending OTP..." : "Continue"}
              </button>
            </>
          )}

          {step === "otp" && (
            <>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="OTP Code"
                value={otp}
                disabled={loading}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                style={commonInputStyle()}
              />
              <button type="submit" disabled={loading || otp.length !== 6} style={{ ...styles.button, opacity: loading || otp.length !== 6 ? 0.75 : 1 }}>
                {loading ? "Verifying..." : "Verify OTP"}
              </button>
            </>
          )}

          {step === "pin" && (
            <>
              <input type="password" placeholder="Admin PIN" value={pin} disabled={loading} onChange={(e) => setPin(e.target.value)} style={commonInputStyle()} />
              <button type="submit" disabled={loading || !pin.trim()} style={{ ...styles.button, opacity: loading || !pin.trim() ? 0.75 : 1 }}>
                {loading ? "Processing..." : "Submit"}
              </button>
              <button type="button" disabled={loading} onClick={() => setConfirmOpen(true)} style={{ ...styles.secondaryButton, color: isDark ? "#fff" : "#0f172a", border: isDark ? "1px solid #334155" : "1px solid #cbd5e1", background: isDark ? "#1e293b" : "transparent", opacity: loading ? 0.75 : 1 }}>
                Register Passkey
              </button>
            </>
          )}
        </form>
      </div>
    </>
  );
}

const styles = {
  wrapper: { position: "fixed", inset: 0, width: "100vw", height: "100dvh", display: "flex", justifyContent: "center", alignItems: "center", padding: 20, boxSizing: "border-box", overflow: "hidden", fontFamily: "system-ui" },
  card: { width: "100%", maxWidth: 360, maxHeight: "calc(100dvh - 40px)", overflow: "hidden", padding: 28, boxSizing: "border-box", borderRadius: 22, boxShadow: "0 24px 70px rgba(15,23,42,.18)", display: "flex", flexDirection: "column", gap: 14 },
  badge: { alignSelf: "center", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "9px 16px", borderRadius: 999, fontSize: 12.5, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", textShadow: "0 0 8px rgba(250,204,21,.25)", animation: "securityPulse 3.6s ease-in-out infinite" },
  title: { textAlign: "center", margin: "4px 0 0", fontSize: 24 },
  subtitle: { textAlign: "center", margin: 0, fontSize: 13 },
  input: { padding: "13px 14px", borderRadius: 12, fontSize: 14, outline: "none" },
  button: { padding: 13, border: "none", borderRadius: 12, background: "linear-gradient(135deg,#4f46e5,#2563eb)", color: "#fff", fontWeight: 800, cursor: "pointer" },
  secondaryButton: { padding: 13, borderRadius: 12, fontWeight: 800, cursor: "pointer" },
};
