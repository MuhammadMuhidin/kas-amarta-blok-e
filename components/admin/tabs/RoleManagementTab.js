"use client";

import LoadingButtonContent from "@/components/admin/LoadingButtonContent";
import modalStyles from "@/components/admin/AdminModal.module.css";
import { readJson, sendJson } from "@/components/admin/adminClientApi";
import Toast from "@/components/Toast";
import { useEffect, useMemo, useState } from "react";

const statusClassMap = {
  active: "admin-deposit-status-paid",
  inactive: "admin-deposit-status-missed",
  current: "admin-deposit-status-paid",
  used: "admin-deposit-status-paid",
  sent: "admin-deposit-status-pending",
  pending: "admin-deposit-status-pending",
  expired: "admin-deposit-status-missed",
  failed: "admin-deposit-status-missed",
  none: "admin-deposit-status-waiting",
  strong: "admin-deposit-status-paid",
  attention: "admin-deposit-status-pending",
  risk: "admin-deposit-status-missed",
};

function formatTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function maskPhone(value) {
  const phone = String(value || "").trim();
  if (!phone) return "Not configured";
  if (phone.length <= 7) return phone;
  return `${phone.slice(0, 5)}••••${phone.slice(-3)}`;
}

function formatDuration(seconds) {
  const total = Number(seconds || 0);
  if (!Number.isFinite(total) || total <= 0) return "Not configured";
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return `${hours}h`;
  return `${Math.floor(total / 60)}m`;
}

function getRoleLabel(roles = [], value) {
  return roles.find((role) => role.value === value)?.label || value || "-";
}

function getStatusClass(status) {
  const key = String(status || "").trim().toLowerCase();
  return statusClassMap[key] || "admin-deposit-status-waiting";
}

function StatusBadge({ children, status }) {
  return <span className={`admin-deposit-status ${getStatusClass(status || children)}`}>{children}</span>;
}

function ActivityBadge({ children, severity = "info" }) {
  const normalized = String(severity || "info").trim().toLowerCase();
  const className = ["info", "success", "warning", "error"].includes(normalized)
    ? `activity-badge activity-badge-${normalized}`
    : "activity-badge activity-badge-info";
  return <span className={className}>{children}</span>;
}

function SectionCard({ title, description, children, action }) {
  return (
    <section className="admin-status-card" style={styles.sectionCard}>
      <div style={styles.sectionHeader}>
        <div>
          <div className="admin-status-label" style={styles.sectionLabel}>Role Management</div>
          <h3 style={styles.sectionTitle}>{title}</h3>
          {description && <div className="admin-status-meta" style={styles.sectionDescription}>{description}</div>}
        </div>
        {action && <div style={styles.sectionAction}>{action}</div>}
      </div>
      {children}
    </section>
  );
}

function ActionButton({ children, tone = "default", disabled, onClick }) {
  const style = tone === "danger" ? styles.dangerButton : tone === "muted" ? styles.mutedButton : undefined;
  return <button type="button" className="admin-small-btn" disabled={disabled} onClick={onClick} style={style}>{children}</button>;
}

function EmptyState({ children }) {
  return <div className="admin-empty-state" style={styles.emptyState}>{children}</div>;
}

function MiniTable({ columns, rows, emptyText, renderRow }) {
  if (!rows?.length) return <EmptyState>{emptyText}</EmptyState>;
  return <div className="admin-table-wrapper"><table className="admin-table" style={styles.table}><thead><tr>{columns.map((column) => <th key={column} className="admin-th">{column}</th>)}</tr></thead><tbody>{rows.map(renderRow)}</tbody></table></div>;
}

function InfoPill({ label, value }) {
  return <div style={styles.infoPill}><span>{label}</span><strong>{value || "-"}</strong></div>;
}

function RoleOverviewCard({ rows }) {
  return <SectionCard title="Role Overview" description="Ringkasan status role pengurus dan akses menu aktif."><div className="admin-monitor-grid" style={styles.roleOverviewGrid}>{rows.map((role) => <div key={role.role} className="admin-status-card" style={styles.roleTile}><div style={styles.tileHeader}><div><div className="admin-status-label">{role.label}</div><div className="admin-status-value" style={styles.tileValue}>{role.menu_count}/{role.menu_total}</div><div className="admin-status-meta">visible menu</div></div><StatusBadge status={role.contact_active ? "active" : "inactive"}>{role.contact_active ? "Active" : "Inactive"}</StatusBadge></div><div style={styles.tileMetaGrid}><InfoPill label="Session" value={role.active_sessions} /><InfoPill label="Last login" value={formatTime(role.last_login_at)} /><InfoPill label="Last activity" value={formatTime(role.last_activity_at)} /></div></div>)}</div></SectionCard>;
}

function RoleContactCard({ rows, onEdit, onToggle }) {
  return <SectionCard title="Role Contact / OTP Receiver" description="Nomor WhatsApp tujuan OTP untuk tiap role."><MiniTable columns={["Role", "Name", "WhatsApp", "Status", "Action"]} rows={rows} emptyText="No role contacts found." renderRow={(row, index) => <tr key={row.role} className={index % 2 ? "admin-row-alt" : ""}><td className="admin-td">{row.label}</td><td className="admin-td">{row.display_name || "-"}</td><td className="admin-td">{maskPhone(row.phone)}</td><td className="admin-td"><StatusBadge status={row.active ? "active" : "inactive"}>{row.active ? "Active" : "Inactive"}</StatusBadge></td><td className="admin-td"><div style={styles.rowActions}><ActionButton onClick={() => onEdit(row)}>Edit</ActionButton>{row.role !== "admin" && <ActionButton tone={row.active ? "muted" : "default"} onClick={() => onToggle(row)}>{row.active ? "Disable" : "Enable"}</ActionButton>}</div></td></tr>} /></SectionCard>;
}

function ActiveRoleSessionsCard({ rows, roles, onRevoke, onRevokeRole }) {
  const rolesWithSessions = useMemo(() => {
    const roleSet = new Set(rows.map((row) => row.access_role).filter(Boolean));
    return roles.filter((role) => roleSet.has(role.value));
  }, [rows, roles]);

  return <SectionCard title="Active Role Sessions" description="Perangkat yang sedang memegang akses admin berdasarkan role." action={rolesWithSessions.length > 0 && <div style={styles.rowActions}>{rolesWithSessions.map((role) => <ActionButton key={role.value} tone="muted" onClick={() => onRevokeRole(role)}>Revoke {role.label}</ActionButton>)}</div>}><MiniTable columns={["Role", "Device", "Location", "Last Active", "Action"]} rows={rows} emptyText="No active role sessions." renderRow={(row, index) => <tr key={row.id} className={index % 2 ? "admin-row-alt" : ""}><td className="admin-td">{getRoleLabel(roles, row.access_role)}</td><td className="admin-td">{row.device_name || "Unknown device"}</td><td className="admin-td">{row.location || row.ip || "-"}</td><td className="admin-td">{formatTime(row.last_active)}</td><td className="admin-td">{row.current ? <StatusBadge status="current">Current</StatusBadge> : <ActionButton tone="danger" onClick={() => onRevoke(row)}>Revoke</ActionButton>}</td></tr>} /></SectionCard>;
}

function RoleAccessSummaryCard({ rows }) {
  return <SectionCard title="Role Access Summary" description="Ringkasan akses menu. Detail matrix tetap dikelola dari Settings."><div style={styles.accessList}>{rows.map((role) => <div key={role.role} style={styles.accessItem}><div style={styles.accessHeader}><div><div className="admin-status-label">{role.label}</div><div className="admin-status-value" style={styles.accessValue}>{role.allowed_count}/{role.total_count} menu</div></div><StatusBadge status={role.role === "admin" ? "strong" : "none"}>{role.role === "admin" ? "Full" : "Matrix"}</StatusBadge></div><div className="admin-deposit-chips" style={styles.modulePills}>{role.modules.filter((module) => module.visible).map((module) => <span key={module.key} className="admin-deposit-chip" style={styles.modulePill}>{module.label}</span>)}</div></div>)}</div></SectionCard>;
}

function RoleActivityLogCard({ rows }) {
  return <SectionCard title="Role Activity Log" description="Aktivitas terbaru dari audit log admin.">{rows?.length ? <div style={styles.activityList}>{rows.slice(0, 8).map((item) => <div key={item.id} className="admin-status-card" style={styles.activityItem}><div style={styles.activityTop}><div><div className="activity-primary">{item.message || item.type}</div><div className="activity-muted">{item.module || "system"} • {formatTime(item.created_at)}</div><div className="activity-muted">{item.device_name || item.actor || "admin"}{item.location ? ` • ${item.location}` : ""}</div></div><ActivityBadge severity={item.severity}>{item.severity || "info"}</ActivityBadge></div></div>)}</div> : <EmptyState>No recent role activity.</EmptyState>}</SectionCard>;
}

function OtpLoginMonitorCard({ rows }) {
  return <SectionCard title="OTP Login Monitor" description="Read-only monitor. Status expired dihitung dari expires_at di server, bukan dari tombol manual."><MiniTable columns={["Role", "Status", "Attempt", "Expires"]} rows={rows} emptyText="No OTP login records found." renderRow={(row, index) => <tr key={row.role} className={index % 2 ? "admin-row-alt" : ""}><td className="admin-td">{row.label}</td><td className="admin-td"><StatusBadge status={row.status}>{row.status}</StatusBadge></td><td className="admin-td">{row.attempt_count}/{row.max_attempts}</td><td className="admin-td">{formatTime(row.expires_at)}</td></tr>} /></SectionCard>;
}

function SecurityHealthCard({ health }) {
  const status = String(health?.overall_status || "Attention").toLowerCase();
  return <SectionCard title="Security Health" description="Kesehatan akses role, kontak OTP, session, PIN, dan passkey."><div style={styles.healthHeader}><div><div className="admin-status-value" style={styles.healthStatus}>{health?.overall_status || "Attention"}</div><div className="admin-status-meta">Overall role security status</div></div><StatusBadge status={status}>{health?.overall_status || "Attention"}</StatusBadge></div><div className="admin-monitor-grid" style={styles.healthGrid}><InfoPill label="OTP Contacts" value={`${health?.contact_ready_count || 0}/${health?.contact_total || 0}`} /><InfoPill label="Active Sessions" value={health?.active_session_count || 0} /><InfoPill label="Failed OTP" value={health?.failed_otp_count || 0} /><InfoPill label="Session Duration" value={formatDuration(health?.session_duration)} /></div><div className="admin-deposit-chips" style={styles.healthPills}><StatusBadge status={health?.pin_enabled ? "active" : "inactive"}>PIN {health?.pin_enabled ? "enabled" : "disabled"}</StatusBadge><StatusBadge status={health?.web_auth_enabled ? "active" : "inactive"}>Passkey {health?.web_auth_enabled ? "enabled" : "disabled"}</StatusBadge><StatusBadge status={health?.passkey_count > 0 ? "active" : "attention"}>{health?.passkey_count || 0} passkey</StatusBadge></div>{health?.warnings?.length ? <div className="admin-error-box" style={styles.warningBox}>{health.warnings.map((warning) => <div key={warning}>• {warning}</div>)}</div> : <EmptyState>No role security warning.</EmptyState>}</SectionCard>;
}

function ActionModal({ pendingAction, pin, setPin, running, contactForm, setContactForm, onCancel, onConfirm }) {
  if (!pendingAction) return null;
  return <div className={modalStyles.overlay} onClick={onCancel}><div className={modalStyles.box} onClick={(event) => event.stopPropagation()}><div style={modalTitleStyle}>{pendingAction.title}</div><div style={modalNoteStyle}>{pendingAction.description}</div>{pendingAction.type === "edit_contact" && <div style={formGroupStyle}><label style={inputLabelStyle}><span>WhatsApp OTP</span><input className="admin-input" value={contactForm.phone} onChange={(event) => setContactForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="628xxxxxxxxxx" /></label><label style={checkboxLabelStyle}><input type="checkbox" checked={contactForm.active} disabled={contactForm.role === "admin"} onChange={(event) => setContactForm((prev) => ({ ...prev, active: event.target.checked }))} />Active OTP receiver</label></div>}<label style={inputLabelStyle}><span>Admin PIN</span><input className="admin-input" type="password" value={pin} onChange={(event) => setPin(event.target.value)} placeholder="Masukkan PIN admin" /></label><div style={modalButtonGridStyle}><button type="button" className="admin-small-btn" disabled={running} onClick={onCancel}>Cancel</button><button type="button" className="admin-small-btn" disabled={running || !pin} onClick={onConfirm}><LoadingButtonContent loading={running} loadingText="Processing...">Confirm</LoadingButtonContent></button></div></div></div>;
}

export default function RoleManagementTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [pin, setPin] = useState("");
  const [running, setRunning] = useState(false);
  const [contactForm, setContactForm] = useState({ role: "", phone: "", active: true });

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }

  async function loadRoleManagement() {
    try {
      setLoading(true);
      setError("");
      const result = await readJson("/api/admin/role-management");
      setData(result);
    } catch (err) {
      setError(err.message || "Failed to load role management");
    } finally {
      setLoading(false);
    }
  }

  function openAction(action) {
    setPin("");
    setPendingAction(action);
  }

  function closeAction() {
    if (running) return;
    setPin("");
    setPendingAction(null);
  }

  function openEditContact(row) {
    setContactForm({ role: row.role, phone: row.phone || "", active: row.role === "admin" ? true : Boolean(row.active) });
    openAction({ type: "edit_contact", title: `Edit OTP Receiver - ${row.label}`, description: "Update nomor WhatsApp penerima OTP dan status aktif role contact." });
  }

  function openToggleRole(row) {
    openAction({ type: "toggle_role", title: `${row.active ? "Disable" : "Enable"} ${row.label} Login`, description: row.active ? "Role ini tidak akan bisa menerima OTP/login sampai diaktifkan lagi." : "Role ini akan diaktifkan kembali untuk menerima OTP/login.", payload: () => ({ action: "set_role_login", role: row.role, active: !row.active }) });
  }

  function openRevokeSession(row) {
    openAction({ type: "revoke_session", title: "Revoke Session", description: `${row.device_name || "Unknown device"} akan kehilangan akses dan wajib login ulang.`, payload: () => ({ action: "revoke_session", id: row.id }) });
  }

  function openRevokeRole(role) {
    openAction({ type: "revoke_role_sessions", title: `Revoke Sessions - ${role.label}`, description: `Semua session aktif untuk role ${role.label}, kecuali session admin saat ini, akan diputus.`, payload: () => ({ action: "revoke_role_sessions", role: role.value }) });
  }

  function getActionPayload() {
    if (pendingAction?.type === "edit_contact") return { action: "update_contact", role: contactForm.role, phone: contactForm.phone, active: contactForm.role === "admin" ? true : contactForm.active };
    return pendingAction?.payload?.() || {};
  }

  async function confirmAction() {
    if (!pendingAction || running || !pin) return;
    try {
      setRunning(true);
      await sendJson("/api/admin/role-management", "PATCH", { ...getActionPayload(), pin });
      showToast("Role management action completed", "success");
      setPendingAction(null);
      setPin("");
      await loadRoleManagement();
    } catch (err) {
      showToast(err.message || "Failed to run role management action", "error");
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    loadRoleManagement();
  }, []);

  const cards = data?.cards || {};
  const roles = data?.roles || [];
  const topStats = useMemo(() => ({ roleCount: roles.length, sessionCount: cards.active_sessions?.length || 0, contactReady: cards.security_health?.contact_ready_count || 0, contactTotal: cards.security_health?.contact_total || 0 }), [cards.active_sessions, cards.security_health, roles.length]);

  if (loading) return <div className="admin-card">Loading role management...</div>;
  if (error) return <div className="admin-error-box">{error}</div>;

  return <><Toast show={!!toast} type={toast?.type} message={toast?.message} /><div className="admin-card"><div className="activity-header" style={styles.pageHeader}><div><div className="activity-kicker">Role Control</div><h3 className="activity-title" style={styles.pageTitle}>Role Management</h3><p className="activity-subtitle">Kelola role, OTP receiver, session aktif, audit, dan kontrol keamanan role.</p></div><button type="button" className="admin-small-btn admin-refresh-btn" onClick={loadRoleManagement}>Refresh</button></div><div className="admin-summary-cards" style={styles.summaryCards}><SummaryCard label="Roles" value={topStats.roleCount} /><SummaryCard label="OTP Contacts" value={`${topStats.contactReady}/${topStats.contactTotal}`} /><SummaryCard label="Active Sessions" value={topStats.sessionCount} /><SummaryCard label="Security Health" value={cards.security_health?.overall_status || "-"} /></div><div style={styles.sectionGridOne}><RoleOverviewCard rows={cards.role_overview || []} /><RoleContactCard rows={cards.role_contacts || []} onEdit={openEditContact} onToggle={openToggleRole} /><SecurityHealthCard health={cards.security_health || {}} /></div><div style={styles.sectionGridTwo}><ActiveRoleSessionsCard rows={cards.active_sessions || []} roles={roles} onRevoke={openRevokeSession} onRevokeRole={openRevokeRole} /><OtpLoginMonitorCard rows={cards.otp_login_monitor || []} /></div><div style={styles.sectionGridTwo}><RoleAccessSummaryCard rows={cards.role_access_summary || []} /><RoleActivityLogCard rows={cards.role_activity_log || []} /></div></div><ActionModal pendingAction={pendingAction} pin={pin} setPin={setPin} running={running} contactForm={contactForm} setContactForm={setContactForm} onCancel={closeAction} onConfirm={confirmAction} /></>;
}

function SummaryCard({ label, value }) {
  return <div className="admin-summary-card" style={styles.summaryCard}><div className="admin-status-label" style={styles.summaryLabel}>{label}</div><div className="admin-status-value" style={styles.summaryValue}>{value}</div></div>;
}

const styles = {
  pageHeader: { marginBottom: 18 },
  pageTitle: { margin: 0 },
  summaryCards: { marginBottom: 18 },
  summaryCard: { cursor: "default", textAlign: "left" },
  summaryLabel: { marginBottom: 4 },
  summaryValue: { marginBottom: 0, fontSize: 22 },
  sectionGridOne: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 },
  sectionGridTwo: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14, marginTop: 14 },
  sectionCard: { marginBottom: 0 },
  sectionHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 },
  sectionLabel: { textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 11, marginBottom: 5 },
  sectionTitle: { margin: 0, fontSize: 18, color: "var(--admin-text)" },
  sectionDescription: { lineHeight: 1.45 },
  sectionAction: { display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" },
  table: { minWidth: 720 },
  roleOverviewGrid: { marginBottom: 0 },
  roleTile: { padding: 14 },
  tileHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  tileValue: { fontSize: 24, marginBottom: 0 },
  tileMetaGrid: { display: "grid", gap: 8, marginTop: 12 },
  infoPill: { display: "flex", justifyContent: "space-between", gap: 10, padding: "9px 10px", borderRadius: 12, border: "1px solid var(--admin-border)", background: "var(--admin-card)", color: "var(--admin-muted)", fontSize: 12, fontWeight: 700 },
  rowActions: { display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" },
  mutedButton: { background: "var(--admin-button)", color: "var(--admin-text)", border: "1px solid var(--admin-border)" },
  dangerButton: { background: "#dc2626", color: "#ffffff" },
  emptyState: { margin: 0 },
  accessList: { display: "grid", gap: 10 },
  accessItem: { padding: 12, borderRadius: 14, border: "1px solid var(--admin-border)", background: "var(--admin-card)" },
  accessHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  accessValue: { marginBottom: 0 },
  modulePills: { marginTop: 10 },
  modulePill: { cursor: "default" },
  activityList: { display: "grid", gap: 10 },
  activityItem: { background: "var(--admin-card)" },
  activityTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  healthHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  healthStatus: { fontSize: 28, marginBottom: 2 },
  healthGrid: { gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", marginBottom: 12 },
  healthPills: { marginBottom: 12 },
  warningBox: { marginBottom: 0, lineHeight: 1.6 },
};

const modalTitleStyle = { fontSize: 22, fontWeight: 800, lineHeight: 1.15, marginBottom: 10 };
const modalNoteStyle = { paddingBottom: 12, marginBottom: 12, borderBottom: "1px solid var(--admin-border)", color: "var(--admin-muted)", fontSize: 13, lineHeight: 1.6 };
const formGroupStyle = { display: "grid", gap: 10, marginBottom: 12 };
const inputLabelStyle = { display: "grid", gap: 6, color: "var(--admin-muted)", fontSize: 13, fontWeight: 700, marginBottom: 12 };
const checkboxLabelStyle = { display: "flex", alignItems: "center", gap: 8, color: "var(--admin-muted)", fontSize: 13, fontWeight: 700 };
const modalButtonGridStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
