"use client";

import AdminSessionCard from "@/components/AdminSessionCard";
import MatrixAccessCard from "@/components/admin/MatrixAccessCard";
import AdminDataSkeleton from "@/components/admin/AdminDataSkeleton";
import modalStyles from "@/components/admin/AdminModal.module.css";
import LoadingButtonContent from "@/components/admin/LoadingButtonContent";
import { useEffect, useState } from "react";

const themes = [
  ["default", "Default", ["#f1f5f9", "#60a5fa", "#ffffff"]],
  ["ledger", "Ledger", ["#fdf6e3", "#2f6f4e", "#fffaf0"]],
  ["midnight", "Midnight", ["#020617", "#3b82f6", "#111827"]],
  ["emerald", "Emerald", ["#ecfdf5", "#10b981", "#d1fae5"]],
  ["amoled", "AMOLED", ["#000000", "#ffffff", "#111111"]],
  ["hacker", "Hacker", ["#020b02", "#22c55e", "#14532d"]],
].map(([id, label, colors]) => ({ id, label, colors }));
const durationOptions = [["1 Hour", "3600"], ["6 Hours", "21600"], ["12 Hours", "43200"], ["1 Day", "86400"], ["3 Days", "259200"], ["7 Days", "604800"], ["30 Days", "2592000"]].map(([label, value]) => ({ label, value }));
const cookie = (name) => document.cookie.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1] || "";
const notify = (setPopup, text, type = "success") => { setPopup({ text, type }); setTimeout(() => setPopup(null), 2500); };

function savedTheme() {
  if (typeof window === "undefined") return "default";
  const value = localStorage.getItem("admin-theme") || "default";
  if (value !== "ios") return value;
  localStorage.setItem("admin-theme", "ledger");
  return "ledger";
}

export default function AdminSettings() {
  const [config, setConfig] = useState(null);
  const [appConfig, setAppConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingMatrix, setSavingMatrix] = useState(false);
  const [popup, setPopup] = useState(null);
  const [theme, setTheme] = useState("default");
  const [isMobile, setIsMobile] = useState(false);
  const [pinModal, setPinModal] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const [resetKey, setResetKey] = useState(0);

  async function loadConfig() { setLoading(true); try { const res = await fetch("/api/admin/settings/auth"); const data = await res.json(); if (!res.ok) throw new Error(data.error); setConfig(data.config); } finally { setLoading(false); } }
  async function loadAppConfig() { setLoadingConfig(true); try { const res = await fetch("/api/admin/settings/app", { cache: "no-store" }); const data = await res.json(); if (!res.ok) throw new Error(data.error); setAppConfig(data.config); } catch (error) { notify(setPopup, error.message || "Failed to load cash configuration", "error"); } finally { setLoadingConfig(false); } }
  function requestPin(action) { setPinValue(""); setPendingAction(() => action); setPinModal(true); }
  async function updateSetting(key, value) { requestPin(async (pin) => { setSaving(true); try { const res = await fetch("/api/admin/settings/auth", { method: "PATCH", headers: { "Content-Type": "application/json", "x-csrf-token": cookie("csrf_token") }, body: JSON.stringify({ key, value, pin }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error); await loadConfig(); notify(setPopup, "Auth settings updated successfully"); } catch (error) { setResetKey((v) => v + 1); notify(setPopup, error.message || "Failed to update auth setting", "error"); } finally { setSaving(false); } }); }
  async function updateCash(key, value) { requestPin(async (pin) => { setSavingConfig(true); try { const res = await fetch("/api/admin/settings/app", { method: "PATCH", headers: { "Content-Type": "application/json", "x-csrf-token": cookie("csrf_token") }, body: JSON.stringify({ key, value, pin }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error); await loadAppConfig(); notify(setPopup, "Configuration updated successfully"); } catch (error) { setResetKey((v) => v + 1); notify(setPopup, error.message || "Failed to update configuration", "error"); } finally { setSavingConfig(false); } }); }
  function applyTheme(id) { setTheme(id); localStorage.setItem("admin-theme", id); document.documentElement.dataset.adminTheme = id; notify(setPopup, `Theme changed to ${themes.find((x) => x.id === id)?.label || "Default"}`); }

  useEffect(() => { loadConfig(); loadAppConfig(); setTheme(savedTheme()); }, []);
  useEffect(() => { const resize = () => setIsMobile(window.innerWidth <= 640); resize(); window.addEventListener("resize", resize); return () => window.removeEventListener("resize", resize); }, []);
  if (loading && !config) return <div style={styles.card}><AdminDataSkeleton cards={4} rows={7} /></div>;

  const busy = saving || savingConfig || savingMatrix;
  async function confirmPin() { if (!pendingAction || busy) return; await pendingAction(pinValue); setPinModal(false); setPendingAction(null); }

  return <div style={styles.card}>
    {popup && <div style={{ ...styles.popup, background: popup.type === "success" ? "#166534" : "#991b1b" }}>{popup.text}</div>}
    <h2 style={styles.title}>Cash Configuration</h2>
    {loadingConfig && !appConfig ? <AdminDataSkeleton showSummary={false} rows={3} /> : <div style={styles.section}>
      <ConfigItem label="Monthly Cash Fee" description="Default monthly cash fee used for payments and arrears reports." type="number" value={appConfig?.monthly_fee} resetKey={resetKey} disabled={savingConfig} saving={savingConfig} isMobile={isMobile} onSave={(v) => updateCash("monthly_fee", v)} />
      <ConfigItem label="Trash Fee" description="Default trash fee paid together with resident cash payments." type="number" value={appConfig?.trash_fee} resetKey={resetKey} disabled={savingConfig} saving={savingConfig} isMobile={isMobile} onSave={(v) => updateCash("trash_fee", v)} />
      <ConfigItem label="Monitoring Start" description="Initial period for system monitoring validation. Data before this period is ignored." type="month" value={appConfig?.start_monitoring_date} resetKey={resetKey} disabled={savingConfig} saving={savingConfig} isMobile={isMobile} onSave={(v) => updateCash("start_monitoring_date", v)} />
    </div>}

    <h2 style={styles.title}>Appearance Theme</h2>
    <div style={styles.themeSection}><div style={styles.themeIntro}>Customize admin dashboard colors and visual style.</div><div style={styles.themeGrid}>{themes.map((item) => <button key={item.id} type="button" onClick={() => applyTheme(item.id)} style={{ ...styles.themeCard, ...(theme === item.id ? styles.themeCardActive : {}) }}><div style={styles.paletteRow}>{item.colors.map((color) => <span key={color} style={{ ...styles.paletteDot, background: color }} />)}</div><div style={styles.themeLabel}>{item.label}</div></button>)}</div></div>

    <h2 style={styles.title}>Settings Auth</h2>
    <SettingRow title="WebAuth Passkey" description="Require passkey/fingerprint verification after the password." checked={config.webAuthEnabled} disabled={saving} onChange={(v) => updateSetting("WEB_AUTH_ENABLED", v)} />
    <SettingRow title="PIN Login" description="Require a PIN after the password." checked={config.pinEnabled} disabled={saving} onChange={(v) => updateSetting("PIN_ENABLED", v)} />
    <SettingRow title="WhatsApp Services" description="Enable all existing WhatsApp delivery mechanisms." checked={config.whatsappServicesEnabled !== false} disabled={saving} onChange={(v) => updateSetting("WA_SERVICES_ENABLED", v)} />
    <SettingRow title="Telegram Notification Alerts" description="Send operational alerts for resident requests, approval decisions, and payment proof uploads." checked={config.telegramNotificationsEnabled === true} disabled={saving} onChange={(v) => updateSetting("TELEGRAM_NOTIFICATIONS_ENABLED", v)} />
    <SettingRow title="Telegram Approval Actions" description="Allow authorized Telegram users to approve or reject requests and payment proofs." checked={config.telegramActionsEnabled === true} disabled={saving || !config.telegramNotificationsEnabled} onChange={(v) => updateSetting("TELEGRAM_ACTIONS_ENABLED", v)} />
    <SelectRow title="Session Duration" description="Admin login session duration before automatic logout." value={String(config.sessionDuration || 86400)} options={durationOptions} disabled={saving} isMobile={isMobile} onChange={(v) => updateSetting("SESSION_DURATION", v)} />

    <MatrixAccessCard requestPin={requestPin} disabled={busy} onSavingChange={setSavingMatrix} showPopup={(text, type) => notify(setPopup, text, type)} />
    <AdminSessionCard />
    {pinModal && <div className={modalStyles.overlay}><div className={modalStyles.box} style={{ maxWidth: 360, padding: 22 }}><div style={styles.pinTitle}>Re-auth PIN</div><div style={styles.pinDesc}>Confirm administrator PIN to apply changes.</div><input type="password" placeholder="Enter PIN" value={pinValue} onChange={(e) => setPinValue(e.target.value)} style={styles.pinInput} disabled={busy} autoFocus /><div style={styles.pinActions}><button type="button" style={styles.pinCancel} disabled={busy} onClick={() => { setPinModal(false); setPendingAction(null); }}>Cancel</button><button type="button" style={{ ...styles.pinConfirm, opacity: busy ? .7 : 1 }} disabled={busy} onClick={confirmPin}><LoadingButtonContent loading={busy} loadingText="Applying...">Apply Change</LoadingButtonContent></button></div></div></div>}
  </div>;
}

function SettingRow({ title, description, checked, disabled, onChange }) { return <div style={styles.row}><div><h3 style={styles.rowTitle}>{title}</h3><p style={styles.desc}>{description}</p></div><label style={styles.switch}><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} style={{ display: "none" }} /><span style={{ ...styles.slider, background: checked ? "var(--admin-primary)" : "#cbd5e1", opacity: disabled ? .65 : 1, cursor: disabled ? "not-allowed" : "pointer" }}><span style={{ ...styles.switchText, ...(checked ? styles.switchTextOn : styles.switchTextOff), color: checked ? "var(--admin-on-primary)" : "#475569" }}>{checked ? "ON" : "OFF"}</span><span style={{ ...styles.knob, transform: checked ? "translateX(34px)" : "translateX(0)" }} /></span></label></div>; }
function SelectRow({ title, description, value, options, disabled, isMobile, onChange }) { return <div style={{ ...styles.row, ...(isMobile ? styles.rowMobile : {}) }}><div><h3 style={styles.rowTitle}>{title}</h3><p style={styles.desc}>{description}</p></div><select className="admin-input" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={{ ...styles.selectInput, ...(isMobile ? styles.inputMobile : {}) }}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>; }
function ConfigItem({ label, description, type, value, resetKey, onSave, disabled, saving, isMobile }) { const [local, setLocal] = useState(value); useEffect(() => setLocal(value), [value, resetKey]); const unchanged = String(local) === String(value); return <div style={{ ...styles.row, ...(isMobile ? styles.rowMobile : {}) }}><div><h3 style={styles.rowTitle}>{label}</h3><p style={styles.desc}>{description}</p></div><div style={{ ...styles.configAction, ...(isMobile ? styles.configActionMobile : {}) }}><input type={type} value={local || ""} disabled={disabled} onChange={(e) => setLocal(e.target.value)} style={{ ...styles.input, ...(isMobile ? styles.inputMobile : {}) }} /><button type="button" disabled={disabled || unchanged} onClick={() => onSave(local)} style={{ ...styles.saveButton, ...(isMobile ? styles.saveButtonMobile : {}), opacity: disabled || unchanged ? .55 : 1 }}><LoadingButtonContent loading={saving && !unchanged} loadingText="Saving...">Save</LoadingButtonContent></button></div></div>; }

const styles = {
  card: { position: "relative", background: "var(--admin-card)", color: "var(--admin-text)", borderRadius: 18, padding: 20, boxShadow: "0 10px 30px rgba(0,0,0,.18)", border: "1px solid var(--admin-border)" }, popup: { position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 9999, color: "#fff", padding: "12px 16px", borderRadius: 12, fontSize: 14, fontWeight: 600 }, title: { margin: "0 0 18px", fontSize: 20 }, section: { marginBottom: 24 },
  themeSection: { marginBottom: 24, borderTop: "1px solid var(--admin-border)", paddingTop: 16 }, themeIntro: { marginBottom: 14, color: "var(--admin-muted)", fontSize: 13 }, themeGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }, themeCard: { border: "1px solid var(--admin-border)", borderRadius: 14, padding: 12, background: "var(--admin-row)", color: "var(--admin-text)", cursor: "pointer", textAlign: "left" }, themeCardActive: { borderColor: "var(--admin-primary)", boxShadow: "0 0 0 2px var(--admin-primary)" }, paletteRow: { display: "flex", gap: 8, marginBottom: 12 }, paletteDot: { width: 18, height: 18, borderRadius: 999, border: "1px solid rgba(255,255,255,.2)" }, themeLabel: { fontSize: 14, fontWeight: 800 },
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "16px 0", borderTop: "1px solid var(--admin-border)" }, rowMobile: { flexDirection: "column", alignItems: "stretch" }, rowTitle: { margin: 0, fontSize: 15 }, desc: { margin: "6px 0 0", fontSize: 13, color: "var(--admin-muted)", lineHeight: 1.5 }, switch: { position: "relative", width: 72, height: 38, flexShrink: 0 }, slider: { position: "absolute", inset: 0, borderRadius: 999, transition: ".2s" }, knob: { position: "absolute", top: 4, left: 4, width: 30, height: 30, borderRadius: "50%", background: "#fff", transition: ".2s" }, switchText: { position: "absolute", top: "50%", transform: "translateY(-50%)", fontSize: 10, fontWeight: 800 }, switchTextOn: { left: 10 }, switchTextOff: { right: 8 },
  input: { width: 170, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--admin-border)", background: "var(--admin-row)", color: "var(--admin-text)" }, selectInput: { width: 190 }, inputMobile: { width: "100%" }, configAction: { display: "flex", alignItems: "center", gap: 10 }, configActionMobile: { width: "100%", flexDirection: "column" }, saveButton: { border: "none", borderRadius: 10, padding: "10px 14px", background: "var(--admin-primary)", color: "var(--admin-on-primary)", fontWeight: 800 }, saveButtonMobile: { width: "100%" },
  pinTitle: { fontSize: 20, fontWeight: 800, marginBottom: 8 }, pinDesc: { fontSize: 13, color: "var(--admin-muted)", marginBottom: 14 }, pinInput: { width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--admin-border)", background: "var(--admin-row)", color: "var(--admin-text)", marginBottom: 14 }, pinActions: { display: "flex", justifyContent: "flex-end", gap: 10 }, pinCancel: { padding: "10px 14px", borderRadius: 10, border: "1px solid var(--admin-border)", background: "var(--admin-row)", color: "var(--admin-text)", fontWeight: 800 }, pinConfirm: { padding: "10px 14px", borderRadius: 10, border: "none", background: "var(--admin-primary)", color: "var(--admin-on-primary)", fontWeight: 800 },
};
