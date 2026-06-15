"use client";

import AdminDataSkeleton from "@/components/admin/AdminDataSkeleton";
import LoadingButtonContent from "@/components/admin/LoadingButtonContent";
import TelegramRoleContactsCard from "@/components/admin/TelegramRoleContactsCard";
import modalStyles from "@/components/admin/AdminModal.module.css";
import { readJson, sendJson } from "@/components/admin/adminClientApi";
import Toast from "@/components/Toast";
import { useEffect, useMemo, useState } from "react";

const API = "/api/admin/role-management";
const badgeClass = (active) => `admin-deposit-status ${active ? "admin-deposit-status-paid" : "admin-deposit-status-missed"}`;
const formatTime = (value) => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
const maskPhone = (value) => { const phone = String(value || "").trim(); return !phone ? "Not configured" : phone.length <= 7 ? phone : `${phone.slice(0, 5)}••••${phone.slice(-3)}`; };

function Card({ title, description, children }) {
  return <section className="admin-status-card" style={{ marginBottom: 0 }}><div style={{ marginBottom: 14 }}><div className="admin-status-label">Role Management</div><h3 style={{ margin: "5px 0 0", fontSize: 18 }}>{title}</h3>{description && <div className="admin-status-meta" style={{ marginTop: 5 }}>{description}</div>}</div>{children}</section>;
}

function Table({ columns, rows, render }) {
  if (!rows?.length) return <div className="admin-empty-state">No data found.</div>;
  return <div className="admin-table-wrapper"><table className="admin-table"><thead><tr>{columns.map((column) => <th className="admin-th" key={column}>{column}</th>)}</tr></thead><tbody>{rows.map(render)}</tbody></table></div>;
}

export default function RoleManagementTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [overviewOpen, setOverviewOpen] = useState(false);

  const notify = (message, type = "success") => { setToast({ message, type }); setTimeout(() => setToast(null), 2500); };
  const load = async () => { try { setLoading(true); setData(await readJson(API)); } catch (error) { notify(error.message || "Failed to load role management", "error"); } finally { setLoading(false); } };

  useEffect(() => { load(); }, []);

  const cards = data?.cards || {};
  const roles = data?.roles || [];
  const roleLabel = (role) => roles.find((item) => item.value === role)?.label || role || "-";
  const stats = useMemo(() => ({
    roles: roles.length,
    contacts: `${cards.security_health?.contact_ready_count || 0}/${cards.security_health?.contact_total || 0}`,
    sessions: cards.active_sessions?.length || 0,
    health: cards.security_health?.overall_status || "-",
  }), [roles.length, cards]);

  function openEdit(row) { setPhone(row.phone || ""); setPin(""); setModal({ type: "contact", row }); }
  function openToggle(row) { setPin(""); setModal({ type: "toggle", row }); }
  function closeModal() { if (!running) { setModal(null); setPhone(""); setPin(""); } }

  async function patch(payload, message) {
    try { setRunning(true); await sendJson(API, "PATCH", payload); notify(message); await load(); }
    catch (error) { notify(error.message || "Role management action failed", "error"); }
    finally { setRunning(false); }
  }

  async function confirmModal() {
    if (!modal || !pin || running) return;
    const payload = modal.type === "contact"
      ? { action: "update_contact", role: modal.row.role, phone, pin }
      : { action: "set_role_login", role: modal.row.role, active: !modal.row.active, pin };
    await patch(payload, "Role management updated");
    setModal(null); setPin("");
  }

  const revokeSession = (row) => row.access_role !== "admin" && patch({ action: "revoke_session", id: row.id }, "Session revoked");

  if (loading && !data) return <div className="admin-card"><AdminDataSkeleton cards={4} rows={6} /></div>;

  return <>
    <Toast show={!!toast} type={toast?.type} message={toast?.message} />
    <div className="admin-card">
      <div className="activity-header" style={{ marginBottom: 18 }}><div><div className="activity-kicker">Role Control</div><h3 className="activity-title">Role Management</h3><p className="activity-subtitle">Manage role access, WhatsApp OTP receivers, Telegram identities, sessions, and security status.</p></div><button type="button" className="admin-small-btn" onClick={() => setOverviewOpen(true)}>View Role Overview</button></div>
      <div className="admin-summary-cards" style={{ marginBottom: 18 }}><Summary label="Roles" value={stats.roles} /><Summary label="OTP Contacts" value={stats.contacts} /><Summary label="Active Sessions" value={stats.sessions} /><Summary label="Security Health" value={stats.health} /></div>

      <div style={gridTwo}>
        <Card title="Role Contact / OTP Receiver" description="WhatsApp destination used for role-based OTP delivery."><Table columns={["Role", "Name", "WhatsApp", "Status", "Action"]} rows={cards.role_contacts || []} render={(row, index) => <tr key={row.role} className={index % 2 ? "admin-row-alt" : ""}><td className="admin-td">{row.label}</td><td className="admin-td">{row.display_name || "-"}</td><td className="admin-td">{maskPhone(row.phone)}</td><td className="admin-td"><span className={badgeClass(row.active)}>{row.active ? "Active" : "Inactive"}</span></td><td className="admin-td"><div style={actions}><button className="admin-small-btn" onClick={() => openEdit(row)}>Edit</button>{row.role !== "admin" && <button className="admin-small-btn" onClick={() => openToggle(row)}>{row.active ? "Disable" : "Enable"}</button>}</div></td></tr>} /></Card>
        <Card title="Security Health" description="Role access, OTP contacts, sessions, PIN, and passkey readiness."><div className="admin-monitor-grid"><Info label="OTP Contacts" value={stats.contacts} /><Info label="Active Sessions" value={stats.sessions} /><Info label="Failed OTP" value={cards.security_health?.failed_otp_count || 0} /><Info label="Passkeys" value={cards.security_health?.passkey_count || 0} /></div>{cards.security_health?.warnings?.length ? <div className="admin-error-box" style={{ marginTop: 12 }}>{cards.security_health.warnings.map((warning) => <div key={warning}>• {warning}</div>)}</div> : <div className="admin-empty-state" style={{ marginTop: 12 }}>No role security warnings.</div>}</Card>
      </div>

      <TelegramRoleContactsCard />

      <div style={{ ...gridTwo, marginTop: 14 }}>
        <Card title="Active Role Sessions" description="Devices currently holding role-based admin access."><Table columns={["Role", "Device", "Location", "Last Active", "Action"]} rows={cards.active_sessions || []} render={(row, index) => <tr key={row.id} className={index % 2 ? "admin-row-alt" : ""}><td className="admin-td">{roleLabel(row.access_role)}</td><td className="admin-td">{row.device_name || "Unknown device"}</td><td className="admin-td">{row.location || row.ip || "-"}</td><td className="admin-td">{formatTime(row.last_active)}</td><td className="admin-td">{row.current || row.access_role === "admin" ? <span className={badgeClass(true)}>Current</span> : <button className="admin-small-btn" disabled={running} onClick={() => revokeSession(row)}>Revoke</button>}</td></tr>} /></Card>
        <Card title="OTP Login Monitor" description="Read-only OTP status monitor."><Table columns={["Role", "Status", "Attempt", "Expires"]} rows={cards.otp_login_monitor || []} render={(row, index) => <tr key={row.role} className={index % 2 ? "admin-row-alt" : ""}><td className="admin-td">{row.label}</td><td className="admin-td">{row.status}</td><td className="admin-td">{row.attempt_count}/{row.max_attempts}</td><td className="admin-td">{formatTime(row.expires_at)}</td></tr>} /></Card>
      </div>
    </div>

    {overviewOpen && <div className="modal-overlay" onClick={() => setOverviewOpen(false)}><div className="modal-box" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div className="modal-title">Role Overview</div></div><div style={{ display: "grid", gap: 10, maxHeight: "68vh", overflow: "auto" }}>{(cards.role_overview || []).map((row) => <div className="admin-status-card" key={row.role}><strong>{row.label}</strong><div className="admin-status-meta">Menus: {row.menu_count}/{row.menu_total} · Sessions: {row.active_sessions || 0}</div><div className="admin-status-meta">Last login: {formatTime(row.last_login_at)}</div></div>)}</div><button className="admin-small-btn" style={{ marginTop: 12 }} onClick={() => setOverviewOpen(false)}>Close</button></div></div>}

    {modal && <div className={modalStyles.overlay} onClick={closeModal}><div className={modalStyles.box} onClick={(event) => event.stopPropagation()}><div style={modalTitle}>{modal.type === "contact" ? `Edit OTP Receiver — ${modal.row.label}` : `${modal.row.active ? "Disable" : "Enable"} ${modal.row.label}`}</div>{modal.type === "contact" && <label style={label}><span>WhatsApp OTP</span><input className="admin-input" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="628xxxxxxxxxx" /></label>}<label style={label}><span>Admin PIN</span><input className="admin-input" type="password" value={pin} onChange={(event) => setPin(event.target.value)} placeholder="Enter admin PIN" /></label><div style={modalActions}><button className="admin-small-btn" disabled={running} onClick={closeModal}>Cancel</button><button className="admin-small-btn" disabled={running || !pin} onClick={confirmModal}><LoadingButtonContent loading={running} loadingText="Processing...">Confirm</LoadingButtonContent></button></div></div></div>}
  </>;
}

function Summary({ label, value }) { return <div className="admin-summary-card"><div className="admin-status-label">{label}</div><div className="admin-status-value">{value}</div></div>; }
function Info({ label, value }) { return <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: 10, border: "1px solid var(--admin-border)", borderRadius: 12 }}><span>{label}</span><strong>{value}</strong></div>; }

const gridTwo = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 };
const actions = { display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" };
const modalTitle = { fontSize: 22, fontWeight: 800, marginBottom: 14 };
const label = { display: "grid", gap: 6, marginBottom: 12, color: "var(--admin-muted)", fontSize: 13, fontWeight: 700 };
const modalActions = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
