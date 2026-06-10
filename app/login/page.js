"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";

import Toast from "@/components/Toast";
import ConfirmModal from "@/components/ConfirmModal";
import { ADMIN_ACCESS_ROLES } from "@/lib/adminRoles";

const SECURITY_STEPS = [
  { key: "password", number: "1", label: "Identity" },
  { key: "otp", number: "2", label: "OTP" },
  { key: "pin", number: "3", label: "Final Key" },
];

const FEATURE_CHIPS = [
  { icon: "🛡️", title: "Secure Session", description: "Encrypted & protected" },
  { icon: "🔐", title: "OTP Protected", description: "WhatsApp verification" },
  { icon: "👆", title: "Passkey Ready", description: "FIDO2 WebAuthn" },
];

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

function getStepIndex(step) {
  return SECURITY_STEPS.findIndex((item) => item.key === step);
}

function getTheme(isDark) {
  if (isDark) {
    return {
      shell: "radial-gradient(circle at 12% 12%, rgba(37,99,235,.42), transparent 30%), radial-gradient(circle at 92% 84%, rgba(250,204,21,.24), transparent 26%), linear-gradient(135deg,#020617 0%,#07111f 48%,#020617 100%)",
      text: "#f8fafc",
      muted: "#a7b4c8",
      card: "linear-gradient(145deg,rgba(15,23,42,.86),rgba(2,6,23,.78))",
      cardBorder: "1px solid rgba(148,163,184,.28)",
      cardShadow: "0 34px 100px rgba(0,0,0,.48), inset 0 1px 0 rgba(255,255,255,.08)",
      panel: "rgba(15,23,42,.56)",
      panelBorder: "1px solid rgba(148,163,184,.22)",
      input: "rgba(15,23,42,.86)",
      inputBorder: "1px solid rgba(148,163,184,.30)",
      inputShadow: "inset 0 1px 0 rgba(255,255,255,.05)",
      badge: "rgba(15,23,42,.72)",
      badgeBorder: "1px solid rgba(250,204,21,.34)",
      circleBg: "#0f172a",
      stepTrack: "rgba(148,163,184,.25)",
      secondary: "rgba(15,23,42,.72)",
      secondaryBorder: "1px solid rgba(148,163,184,.28)",
      footer: "rgba(15,23,42,.50)",
    };
  }

  return {
    shell: "radial-gradient(circle at 10% 14%, rgba(37,99,235,.14), transparent 30%), radial-gradient(circle at 92% 86%, rgba(250,204,21,.22), transparent 26%), linear-gradient(135deg,#f8fafc 0%,#eef5ff 52%,#fffaf0 100%)",
    text: "#0f2857",
    muted: "#52627a",
    card: "linear-gradient(145deg,rgba(255,255,255,.92),rgba(248,250,252,.82))",
    cardBorder: "1px solid rgba(148,163,184,.30)",
    cardShadow: "0 34px 90px rgba(15,23,42,.16), inset 0 1px 0 rgba(255,255,255,.88)",
    panel: "rgba(255,255,255,.70)",
    panelBorder: "1px solid rgba(148,163,184,.24)",
    input: "rgba(255,255,255,.92)",
    inputBorder: "1px solid rgba(148,163,184,.35)",
    inputShadow: "0 10px 30px rgba(15,23,42,.05)",
    badge: "rgba(255,255,255,.72)",
    badgeBorder: "1px solid rgba(202,138,4,.26)",
    circleBg: "#ffffff",
    stepTrack: "rgba(148,163,184,.32)",
    secondary: "rgba(255,255,255,.76)",
    secondaryBorder: "1px solid rgba(148,163,184,.34)",
    footer: "rgba(255,255,255,.62)",
  };
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

  const step = needPin ? "pin" : otpRequested ? "otp" : "password";
  const stepIndex = getStepIndex(step);
  const theme = getTheme(isDark);
  const subtitle = step === "password"
    ? "Select your role and verify your access credentials."
    : step === "otp"
      ? "Enter the 6-digit OTP sent to the registered WhatsApp number."
      : "Complete verification with your administrator PIN.";
  const sectionTitle = step === "password"
    ? "1. Verify Your Identity"
    : step === "otp"
      ? "2. Confirm WhatsApp OTP"
      : "3. Unlock Dashboard";

  function commonInputStyle() {
    return {
      ...styles.input,
      background: theme.input,
      color: theme.text,
      border: theme.inputBorder,
      boxShadow: theme.inputShadow,
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

  return (
    <>
      <style jsx global>{`
        @keyframes securityPulse{0%,100%{opacity:.92;transform:scale(.996);filter:drop-shadow(0 0 0 rgba(250,204,21,0))}50%{opacity:1;transform:scale(1);filter:drop-shadow(0 0 10px rgba(250,204,21,.30))}}
        @keyframes glowFloat{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(0,-10px,0) scale(1.03)}}
        @keyframes stepFlow{0%{background-position:0% 50%}100%{background-position:200% 50%}}
        @keyframes stepPulse{0%,100%{box-shadow:0 0 0 0 rgba(37,99,235,.35),0 0 22px rgba(37,99,235,.38)}50%{box-shadow:0 0 0 8px rgba(37,99,235,0),0 0 26px rgba(37,99,235,.42)}}
        html,body{overflow:hidden!important;height:100%;overscroll-behavior:none}
        .login-shell::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(96,165,250,.10) 1px,transparent 1px),linear-gradient(90deg,rgba(96,165,250,.10) 1px,transparent 1px);background-size:56px 56px;mask-image:radial-gradient(circle at 50% 50%,#000 0%,transparent 72%);pointer-events:none}
        .login-shell::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 20% 30%,rgba(255,255,255,.14),transparent 20%),radial-gradient(circle at 80% 70%,rgba(250,204,21,.10),transparent 22%);pointer-events:none}
        .login-glow{position:absolute;width:360px;height:360px;border-radius:999px;filter:blur(26px);opacity:.50;animation:glowFloat 7s ease-in-out infinite;pointer-events:none}
        .login-glow-blue{left:-120px;top:-120px;background:rgba(37,99,235,.42)}
        .login-glow-gold{right:-120px;bottom:-120px;background:rgba(250,204,21,.34);animation-delay:-2s}
        @media (max-width: 980px){.login-visual{display:none!important}.login-layout{justify-content:center!important}.login-card{width:min(100%,430px)!important;max-width:430px!important}}
        @media (max-width: 520px){.login-shell{padding:14px!important}.login-card{padding:20px!important;border-radius:24px!important}.login-step-label{font-size:11px!important}.login-title{font-size:27px!important}.login-lock-icon{width:44px!important;height:44px!important;font-size:22px!important}}
        @media (max-height: 740px){.login-card{padding-top:20px!important;padding-bottom:20px!important;gap:10px!important}.login-visual{padding:20px!important}.login-lock-icon{display:none!important}.login-visual-safe{min-height:148px!important;margin-top:18px!important}.login-hero-title{margin-top:20px!important;font-size:34px!important}.login-brand-mark{width:62px!important;height:62px!important;font-size:30px!important}.login-brand-name{margin-top:14px!important;font-size:30px!important}.login-feature-grid{margin-top:22px!important}.login-footer-note{margin-top:8px!important}}
        @media (max-height: 640px){.login-protection-text{display:none!important}.login-card{gap:8px!important}.login-title{font-size:24px!important}.login-stepper{margin-top:10px!important}.login-divider{margin-bottom:8px!important}.login-input{padding-top:12px!important;padding-bottom:12px!important}.login-primary-button{min-height:48px!important;padding-top:12px!important;padding-bottom:12px!important}.login-secondary-button{min-height:46px!important;padding-top:11px!important;padding-bottom:11px!important}}
      `}</style>
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

      <div className="login-shell" style={{ ...styles.wrapper, background: theme.shell, color: theme.text }}>
        <span className="login-glow login-glow-blue" />
        <span className="login-glow login-glow-gold" />

        <div className="login-layout" style={styles.layout}>
          <section className="login-visual" style={{ ...styles.visualPanel, background: theme.panel, border: theme.panelBorder }}>
            <div className="login-brand-mark" style={styles.brandMark}>A</div>
            <div className="login-brand-name" style={{ ...styles.brandName, color: theme.text }}>AMARTA</div>
            <div style={styles.brandSub}>CASH CONTROL</div>
            <h1 className="login-hero-title" style={{ ...styles.heroTitle, color: theme.text }}>Secure Access</h1>
            <p style={{ ...styles.heroText, color: theme.muted }}>Multi-layer verification for authorized management access.</p>

            <div className="login-feature-grid" style={styles.featureGrid}>
              {FEATURE_CHIPS.map((item) => (
                <div key={item.title} style={{ ...styles.featureItem, borderColor: isDark ? "rgba(148,163,184,.25)" : "rgba(148,163,184,.32)" }}>
                  <div style={styles.featureIcon}>{item.icon}</div>
                  <div style={{ ...styles.featureTitle, color: theme.text }}>{item.title}</div>
                  <div style={{ ...styles.featureDesc, color: theme.muted }}>{item.description}</div>
                </div>
              ))}
            </div>

            <div className="login-visual-safe" style={styles.safeVisual}>
              <div style={{ ...styles.safeBox, background: isDark ? "linear-gradient(145deg,#0f172a,#020617)" : "linear-gradient(145deg,#ffffff,#e2e8f0)", border: isDark ? "1px solid rgba(148,163,184,.28)" : "1px solid rgba(148,163,184,.34)" }}>
                <div style={styles.safeDoor}>◆</div>
              </div>
              <div style={styles.safeShield}>🔒</div>
              <div style={styles.safeBars}>
                {[34, 52, 70, 92].map((height, index) => (
                  <span key={height} style={{ ...styles.safeBar, height, opacity: 0.35 + index * 0.14 }} />
                ))}
              </div>
            </div>

            <div style={{ ...styles.auditBox, background: theme.footer, border: theme.badgeBorder }}>
              <span style={styles.auditIcon}>🛡️</span>
              <div>
                <div style={{ ...styles.auditTitle, color: theme.text }}>All access attempts are monitored and recorded</div>
                <div style={{ ...styles.auditText, color: theme.muted }}>Your security is our priority</div>
              </div>
            </div>
          </section>

          <form className="login-card" onSubmit={step === "password" ? requestOtp : submit} style={{ ...styles.card, background: theme.card, border: theme.cardBorder, boxShadow: theme.cardShadow }}>
            <div className="login-lock-icon" style={styles.lockIcon}>🛡️</div>
            <div style={{ ...styles.badge, background: theme.badge, border: theme.badgeBorder }}>
              Secure Management Portal
            </div>
            <h2 className="login-title" style={{ ...styles.title, color: theme.text }}>Amarta Secure Access</h2>
            <p style={{ ...styles.subtitle, color: theme.muted }}>{subtitle}</p>

            <div className="login-stepper" style={styles.stepper}>
              {SECURITY_STEPS.map((item, index) => {
                const active = index === stepIndex;
                const completed = index < stepIndex;
                const lineActive = index <= stepIndex && index < SECURITY_STEPS.length - 1;
                return (
                  <div key={item.key} style={styles.stepItem}>
                    <div style={{
                      ...styles.stepCircle,
                      background: active || completed ? "linear-gradient(135deg,#2563eb,#0ea5e9)" : theme.circleBg,
                      color: active || completed ? "#fff" : theme.muted,
                      border: active || completed ? "1px solid rgba(96,165,250,.78)" : `1px solid ${isDark ? "rgba(148,163,184,.34)" : "rgba(148,163,184,.42)"}`,
                      boxShadow: active ? "0 0 22px rgba(37,99,235,.38)" : "none",
                      animation: active ? "stepPulse 1.8s ease-in-out infinite" : "none",
                    }}>
                      {item.number}
                    </div>
                    <div className="login-step-label" style={{ ...styles.stepLabel, color: active ? "#2563eb" : theme.muted }}>{item.label}</div>
                    {index < SECURITY_STEPS.length - 1 && (
                      <span style={{
                        ...styles.stepLine,
                        background: lineActive ? "linear-gradient(90deg,#2563eb,#0ea5e9,#60a5fa,#2563eb)" : theme.stepTrack,
                        backgroundSize: lineActive ? "200% 100%" : "100% 100%",
                        animation: lineActive ? "stepFlow 1.9s linear infinite" : "none",
                      }} />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="login-divider" style={{ ...styles.divider, background: theme.stepTrack }} />

            <div style={styles.formSection}>
              <div>
                <h3 style={{ ...styles.sectionTitle, color: theme.text }}>{sectionTitle}</h3>
                <p style={{ ...styles.sectionDesc, color: theme.muted }}>{step === "password" ? "Select your role and enter your password" : step === "otp" ? "Use the OTP from WhatsApp to continue" : "Use your final key to unlock the dashboard"}</p>
              </div>

              {step === "password" && (
                <>
                  <select
                    className="login-input"
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
                    className="login-input"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    disabled={loading || sendingOtp}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      resetOtpStep();
                    }}
                    style={commonInputStyle()}
                  />
                  <button className="login-primary-button" type="submit" disabled={loading || sendingOtp || !password.trim()} style={{ ...styles.button, opacity: loading || sendingOtp || !password.trim() ? 0.72 : 1 }}>
                    <span>🔒</span>
                    <span>{sendingOtp ? "Sending OTP..." : "Continue"}</span>
                    <span style={styles.buttonArrow}>›</span>
                  </button>
                </>
              )}

              {step === "otp" && (
                <>
                  <input
                    className="login-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="OTP Code"
                    value={otp}
                    disabled={loading}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    style={{ ...commonInputStyle(), letterSpacing: ".32em", textAlign: "center", fontWeight: 900 }}
                  />
                  <button className="login-primary-button" type="submit" disabled={loading || otp.length !== 6} style={{ ...styles.button, opacity: loading || otp.length !== 6 ? 0.72 : 1 }}>
                    <span>🛡️</span>
                    <span>{loading ? "Verifying..." : "Verify OTP"}</span>
                    <span style={styles.buttonArrow}>›</span>
                  </button>
                </>
              )}

              {step === "pin" && (
                <>
                  <input className="login-input" type="password" placeholder="Admin PIN" value={pin} disabled={loading} onChange={(e) => setPin(e.target.value)} style={commonInputStyle()} />
                  <button className="login-primary-button" type="submit" disabled={loading || !pin.trim()} style={{ ...styles.button, opacity: loading || !pin.trim() ? 0.72 : 1 }}>
                    <span>🔓</span>
                    <span>{loading ? "Processing..." : "Unlock Dashboard"}</span>
                    <span style={styles.buttonArrow}>›</span>
                  </button>
                  <button className="login-secondary-button" type="button" disabled={loading} onClick={() => setConfirmOpen(true)} style={{ ...styles.secondaryButton, color: theme.text, border: theme.secondaryBorder, background: theme.secondary, opacity: loading ? 0.75 : 1 }}>
                    Register Passkey
                  </button>
                </>
              )}
            </div>

            <div className="login-footer-note" style={{ ...styles.footerNote, color: theme.muted }}>
              <span style={styles.footerLine} />
              <span style={styles.footerShield}>🛡️</span>
              <span style={styles.footerLine} />
            </div>
            <div className="login-protection-text" style={{ ...styles.protectionText, color: theme.muted }}>Protected by password, OTP, PIN, and passkey verification.</div>
          </form>
        </div>
      </div>
    </>
  );
}

const styles = {
  wrapper: { position: "fixed", inset: 0, width: "100vw", height: "100dvh", padding: "clamp(12px,2vw,24px)", boxSizing: "border-box", overflow: "hidden", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" },
  layout: { position: "relative", zIndex: 2, height: "100%", width: "100%", maxWidth: 1240, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: "clamp(22px,3.4vw,42px)" },
  visualPanel: { width: "min(47vw,500px)", height: "min(650px,calc(100dvh - 48px))", minHeight: 0, borderRadius: 34, padding: "clamp(18px,2vw,26px)", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", overflow: "hidden", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", boxShadow: "0 28px 90px rgba(15,23,42,.12)" },
  brandMark: { width: 68, height: 68, borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center", color: "#d9a520", border: "2px solid rgba(217,165,32,.72)", fontFamily: "Georgia, serif", fontSize: 34, fontWeight: 900, boxShadow: "0 18px 40px rgba(217,165,32,.16)" },
  brandName: { marginTop: 16, fontFamily: "Georgia, serif", fontSize: 34, letterSpacing: ".28em", color: "#d9a520", textIndent: ".28em" },
  brandSub: { marginTop: 2, fontSize: 13, letterSpacing: ".34em", color: "#d9a520", fontWeight: 800 },
  heroTitle: { margin: "26px 0 0", fontSize: 36, lineHeight: 1, textTransform: "uppercase", letterSpacing: ".035em", fontWeight: 950 },
  heroText: { maxWidth: 380, margin: "12px 0 0", fontSize: 16, lineHeight: 1.35 },
  featureGrid: { width: "100%", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 28 },
  featureItem: { borderLeft: "1px solid", padding: "0 8px", minHeight: 74 },
  featureIcon: { fontSize: 30, lineHeight: 1.2, marginBottom: 7, filter: "drop-shadow(0 10px 20px rgba(37,99,235,.22))" },
  featureTitle: { fontSize: 11, fontWeight: 950, textTransform: "uppercase", letterSpacing: ".045em" },
  featureDesc: { marginTop: 4, fontSize: 11, lineHeight: 1.35 },
  safeVisual: { position: "relative", width: "100%", minHeight: 176, marginTop: 24, display: "flex", justifyContent: "center", alignItems: "center" },
  safeBox: { position: "relative", width: 118, height: 118, borderRadius: 18, boxShadow: "0 22px 60px rgba(15,23,42,.18)", transform: "perspective(500px) rotateY(-12deg) rotateX(4deg)" },
  safeDoor: { position: "absolute", inset: 20, borderRadius: 12, border: "1px solid rgba(217,165,32,.72)", display: "flex", alignItems: "center", justifyContent: "center", color: "#d9a520", fontSize: 34 },
  safeShield: { width: 64, height: 64, borderRadius: 20, marginLeft: -12, display: "flex", alignItems: "center", justifyContent: "center", color: "#d9a520", background: "rgba(217,165,32,.10)", border: "1px solid rgba(217,165,32,.35)", fontSize: 30, boxShadow: "0 20px 60px rgba(217,165,32,.14)" },
  safeBars: { display: "flex", alignItems: "flex-end", gap: 7, marginLeft: 30, height: 98 },
  safeBar: { width: 18, borderRadius: "7px 7px 3px 3px", background: "linear-gradient(180deg,#2563eb,#60a5fa)", boxShadow: "0 12px 28px rgba(37,99,235,.24)" },
  auditBox: { width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 18, boxSizing: "border-box", textAlign: "left" },
  auditIcon: { width: 32, height: 32, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(250,204,21,.12)" },
  auditTitle: { fontSize: 13, fontWeight: 850 },
  auditText: { marginTop: 2, fontSize: 11 },
  card: { width: "min(100%,520px)", height: "min(650px,calc(100dvh - 48px))", minHeight: 0, overflow: "hidden", padding: "clamp(20px,2.4vw,34px) clamp(22px,3vw,42px)", boxSizing: "border-box", borderRadius: 34, display: "flex", flexDirection: "column", justifyContent: "center", gap: 12, backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)" },
  lockIcon: { alignSelf: "center", width: 50, height: 50, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(250,204,21,.10)", color: "#d9a520", border: "1px solid rgba(217,165,32,.32)", fontSize: 24, boxShadow: "0 14px 40px rgba(217,165,32,.12)" },
  badge: { alignSelf: "center", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "7px 13px", borderRadius: 999, fontSize: 11.5, fontWeight: 900, letterSpacing: ".10em", textTransform: "uppercase", color: "#d9a520", textShadow: "0 0 8px rgba(250,204,21,.18)", animation: "securityPulse 3.6s ease-in-out infinite" },
  title: { textAlign: "center", margin: "4px 0 0", fontSize: 31, letterSpacing: "-.03em", fontWeight: 950 },
  subtitle: { textAlign: "center", margin: "0 auto", maxWidth: 390, fontSize: 14, lineHeight: 1.35 },
  stepper: { position: "relative", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginTop: 14, marginBottom: 0 },
  stepItem: { position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 7 },
  stepCircle: { position: "relative", zIndex: 2, width: 38, height: 38, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 950, fontSize: 14 },
  stepLabel: { fontSize: 12.5, fontWeight: 750 },
  stepLine: { position: "absolute", zIndex: 1, top: 19, left: "calc(50% + 24px)", width: "calc(100% - 48px)", height: 2, borderRadius: 999 },
  divider: { height: 1, width: "100%", margin: "2px 0 12px" },
  formSection: { display: "flex", flexDirection: "column", gap: 12 },
  sectionTitle: { margin: 0, fontSize: 19, fontWeight: 950 },
  sectionDesc: { margin: "5px 0 2px", fontSize: 12.5, lineHeight: 1.35 },
  input: { width: "100%", padding: "14px 16px", borderRadius: 16, fontSize: 14.5, outline: "none", boxSizing: "border-box", transition: "border .2s ease, box-shadow .2s ease, transform .2s ease" },
  button: { width: "100%", padding: "14px 16px", border: "none", borderRadius: 16, background: "linear-gradient(135deg,#2563eb,#0057ff)", color: "#fff", fontWeight: 900, cursor: "pointer", minHeight: 52, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, boxShadow: "0 18px 42px rgba(37,99,235,.30)", fontSize: 15, letterSpacing: ".01em" },
  buttonArrow: { marginLeft: 14, fontSize: 24, lineHeight: 1 },
  secondaryButton: { width: "100%", padding: "13px 16px", borderRadius: 16, fontWeight: 850, cursor: "pointer", minHeight: 48, fontSize: 14 },
  footerNote: { marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 },
  footerLine: { height: 1, flex: 1, maxWidth: 140, background: "currentColor", opacity: .24 },
  footerShield: { opacity: .54 },
  protectionText: { textAlign: "center", fontSize: 12.5, lineHeight: 1.35 },
};
