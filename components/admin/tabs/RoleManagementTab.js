"use client";

import { readJson, sendJson } from "@/components/admin/adminClientApi";
import { useEffect, useMemo, useState } from "react";

const STATUS_COLORS = {
  Strong: "#16a34a",
  Attention: "#f59e0b",
  Risk: "#dc2626",
};

function formatTime(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function Card({ title, description, children, action }) {
  return (
    <section style={styles.card}>
      <div style={styles.cardHeader}>
        <div>
          <h2 style={styles.cardTitle}>{title}</h2>
          {description && <p style={styles.cardDescription}>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Badge({ children, tone = "neutral" }) {
  return <span style={{ ...styles.badge, ...(styles.badgeTone[tone] || styles.badgeTone.neutral) }}>{children}</span>;
}

function EmptyBox({ children }) {
  return <div style={styles.emptyBox}>{children}</div>;
}

function ActionButton({ children, tone = "neutral", disabled, onClick }) {
  return (
    <button
      type="button"
      className="admin-small-btn"
      disabled={disabled}
      onClick={onClick}
      style={{
        ...styles.actionButton,
        ...(tone === "danger" ? styles.actionButtonDanger : {}),
        ...(tone === "warning" ? styles.actionButtonWarning : {}),
        opacity: disabled ? 0.65 : 1,
      }}
    >
      {children}
    </button>
  );
}

function MiniTable({ columns, rows, renderRow, emptyText }) {
  if (!rows?.length) return <EmptyBox>{emptyText}</EmptyBox>;

  return (
    <div className="admin-table-wrapper">
      <table className="admin-table">
        <thead>
          <tr>{columns.map((column) => <th key={column} className="admin-th">{column}</th>)}</tr>
        </thead>
        <tbody>{rows.map(renderRow)}</tbody>
      </table>
    </div>
  );
}

function RoleOverviewCard({ rows }) {
  return (
    <Card title="Role Overview" description="Ringkasan status role pengurus dan akses menu aktif.">
      <div style={styles.roleGrid}>
        {rows.map((role) => (
          <div key={role.role} style={styles.roleTile}>
            <div style={styles.roleTileTop}>
              <div>
                <div style={styles.roleName}>{role.label}</div>
                <div style={styles.roleMeta}>{role.status}</div>
              </div>
              <Badge tone={role.contact_active ? "success" : "warning"}>{role.contact_active ? "Active" : "Contact"}</Badge>
            </div>
            <div style={styles.metricGrid}>
              <div><b>{role.menu_count}/{role.menu_total}</b><span>Menu</span></div>
              <div><b>{role.active_sessions}</b><span>Session</span></div>
            </div>
            <div style={styles.smallMeta}>Last login: {formatTime(role.last_login_at)}</div>
            <div style={styles.smallMeta}>Last activity: {formatTime(role.last_activity_at)}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RoleContactCard({ rows, onEdit, onToggle }) {
  return (
    <Card title="Role Contact / OTP Receiver" description="Nomor WhatsApp tujuan OTP untuk tiap role.">
      <MiniTable
        columns={["Role", "Name", "WhatsApp", "Status", "Action"]}
        rows={rows}
        emptyText="No role contacts found."
        renderRow={(row, index) => (
          <tr key={row.role} className={index % 2 ? "admin-row-alt" : ""}>
            <td className="admin-td">{row.label}</td>
            <td className="admin-td">{row.display_name || "-"}</td>
            <td className="admin-td">{maskPhone(row.phone)}</td>
            <td className="admin-td"><Badge tone={row.active ? "success" : "warning"}>{row.active ? "Active" : "Inactive"}</Badge></td>
            <td className="admin-td">
              <div style={styles.rowActions}>
                <ActionButton onClick={() => onEdit(row)}>Edit</ActionButton>
                {row.role !== "admin" && (
                  <ActionButton tone={row.active ? "warning" : "neutral"} onClick={() => onToggle(row)}>
                    {row.active ? "Disable" : "Enable"}
                  </ActionButton>
                )}
              </div>
            </td>
          </tr>
        )}
      />
    </Card>
  );
}

function ActiveRoleSessionsCard({ rows, roles, onRevoke, onRevokeRole }) {
  const rolesWithSessions = useMemo(() => {
    const roleSet = new Set(rows.map((row) => row.access_role).filter(Boolean));
    return roles.filter((role) => roleSet.has(role.value));
  }, [rows, roles]);

  return (
    <Card
      title="Active Role Sessions"
      description="Perangkat yang sedang memegang akses admin berdasarkan role."
      action={rolesWithSessions.length > 0 && (
        <div style={styles.headerActions}>
          {rolesWithSessions.map((role) => (
            <ActionButton key={role.value} tone="warning" onClick={() => onRevokeRole(role)}>
              Revoke {role.label}
            </ActionButton>
          ))}
        </div>
      )}
    >
      <MiniTable
        columns={["Role", "Device", "Location", "Last Active", "Action"]}
        rows={rows}
        emptyText="No active role sessions."
        renderRow={(row, index) => (
          <tr key={row.id} className={index % 2 ? "admin-row-alt" : ""}>
            <td className="admin-td">{getRoleLabel(roles, row.access_role)}</td>
            <td className="admin-td">{row.device_name || "Unknown device"}</td>
            <td className="admin-td">{row.location || row.ip || "-"}</td>
            <td className="admin-td">{formatTime(row.last_active)}</td>
            <td className="admin-td">
              {row.current ? (
                <Badge tone="success">Current</Badge>
              ) : (
                <ActionButton tone="danger" onClick={() => onRevoke(row)}>Revoke</ActionButton>
              )}
            </td>
          </tr>
        )}
      />
    </Card>
  );
}

function RoleAccessSummaryCard({ rows }) {
  return (
    <Card title="Role Access Summary" description="Ringkasan akses menu. Detail matrix tetap dikelola dari Settings.">
      <div style={styles.accessList}>
        {rows.map((role) => (
          <div key={role.role} style={styles.accessItem}>
            <div style={styles.accessHeader}>
              <div>
                <div style={styles.roleName}>{role.label}</div>
                <div style={styles.smallMeta}>{role.allowed_count}/{role.total_count} menu visible</div>
              </div>
              <Badge tone={role.role === "admin" ? "success" : "neutral"}>{role.role === "admin" ? "Full" : "Matrix"}</Badge>
            </div>
            <div style={styles.modulePills}>
              {role.modules.filter((module) => module.visible).map((module) => (
                <span key={module.key} style={styles.modulePill}>{module.label}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RoleActivityLogCard({ rows }) {
  return (
    <Card title="Role Activity Log" description="Aktivitas terbaru dari audit log admin.">
      {rows?.length ? (
        <div style={styles.activityList}>
          {rows.slice(0, 8).map((item) => (
            <div key={item.id} style={styles.activityItem}>
              <div style={styles.activityTop}>
                <strong>{item.message || item.type}</strong>
                <Badge tone={item.severity === "error" ? "danger" : item.severity === "warning" ? "warning" : "neutral"}>{item.severity || "info"}</Badge>
              </div>
              <div style={styles.smallMeta}>{item.module || "system"} • {formatTime(item.created_at)}</div>
              <div style={styles.smallMeta}>{item.device_name || item.actor || "admin"}{item.location ? ` • ${item.location}` : ""}</div>
            </div>
          ))}
        </div>
      ) : <EmptyBox>No recent role activity.</EmptyBox>}
    </Card>
  );
}

function OtpLoginMonitorCard({ rows, onExpire }) {
  return (
    <Card title="OTP Login Monitor" description="Status OTP terakhir per role. Kode OTP tidak ditampilkan.">
      <MiniTable
        columns={["Role", "Status", "Attempt", "Expires", "Action"]}
        rows={rows}
        emptyText="No OTP login records found."
        renderRow={(row, index) => {
          const status = row.status === "used" ? "success" : row.status === "sent" || row.status === "pending" ? "warning" : row.status === "failed" ? "danger" : "neutral";
          return (
            <tr key={row.role} className={index % 2 ? "admin-row-alt" : ""}>
              <td className="admin-td">{row.label}</td>
              <td className="admin-td"><Badge tone={status}>{row.status}</Badge></td>
              <td className="admin-td">{row.attempt_count}/{row.max_attempts}</td>
              <td className="admin-td">{formatTime(row.expires_at)}</td>
              <td className="admin-td">
                {row.can_expire ? <ActionButton tone="warning" onClick={() => onExpire(row)}>Expire</ActionButton> : <span style={styles.mutedText}>No action</span>}
              </td>
            </tr>
          );
        }}
      />
    </Card>
  );
}

function SecurityHealthCard({ health }) {
  const statusColor = STATUS_COLORS[health?.overall_status] || STATUS_COLORS.Attention;

  return (
    <Card title="Security Health" description="Kesehatan akses role, kontak OTP, session, PIN, dan passkey.">
      <div style={styles.healthHeader}>
        <div>
          <div style={{ ...styles.healthStatus, color: statusColor }}>{health?.overall_status || "Attention"}</div>
          <div style={styles.smallMeta}>Overall role security status</div>
        </div>
        <div style={styles.healthMetrics}>
          <span>{health?.contact_ready_count || 0}/{health?.contact_total || 0} contacts</span>
          <span>{health?.active_session_count || 0} sessions</span>
          <span>{health?.pending_otp_count || 0} pending OTP</span>
        </div>
      </div>
      <div style={styles.healthChecks}>
        <Badge tone={health?.pin_enabled ? "success" : "warning"}>PIN {health?.pin_enabled ? "enabled" : "disabled"}</Badge>
        <Badge tone={health?.web_auth_enabled ? "success" : "warning"}>Passkey {health?.web_auth_enabled ? "enabled" : "disabled"}</Badge>
        <Badge tone={health?.passkey_count > 0 ? "success" : "warning"}>{health?.passkey_count || 0} passkey</Badge>
        <Badge tone="neutral">Session {formatDuration(health?.session_duration)}</Badge>
      </div>
      {health?.warnings?.length ? (
        <div style={styles.warningList}>{health.warnings.map((warning) => <div key={warning}>• {warning}</div>)}</div>
      ) : <EmptyBox>No role security warning.</EmptyBox>}
    </Card>
  );
}

function DangerZoneCard({ rows, onDanger }) {
  return (
    <Card title="Danger Zone" description="Aksi sensitif role. Semua action wajib PIN admin dan tercatat di audit log.">
      <div style={styles.dangerList}>
        {(rows || []).map((item) => (
          <div key={item.key} style={styles.dangerItem}>
            <div>
              <div style={styles.roleName}>{item.label}</div>
              <div style={styles.smallMeta}>{item.description}</div>
            </div>
            <div style={styles.dangerMeta}>
              <Badge tone={item.count ? "warning" : "neutral"}>{item.count}</Badge>
              <span>{item.status}</span>
              <ActionButton tone="danger" disabled={!item.action || item.count === 0} onClick={() => onDanger(item)}>
                Run
              </ActionButton>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ActionModal({ pendingAction, pin, setPin, running, onCancel, onConfirm }) {
  if (!pendingAction) return null;

  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div style={styles.modalBadge}>Role Control</div>
        <h3 style={styles.modalTitle}>{pendingAction.title}</h3>
        <p style={styles.modalDescription}>{pendingAction.description}</p>

        {pendingAction.type === "edit_contact" && (
          <div style={styles.formGrid}>
            <label style={styles.formLabel}>WhatsApp OTP</label>
            <input
              className="admin-input"
              value={pendingAction.form.phone}
              onChange={(event) => pendingAction.setForm((prev) => ({ ...prev, phone: event.target.value }))}
              placeholder="628xxxxxxxxxx"
              style={styles.formInput}
            />
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={pendingAction.form.active}
                onChange={(event) => pendingAction.setForm((prev) => ({ ...prev, active: event.target.checked }))}
              />
              Active OTP receiver
            </label>
          </div>
        )}

        <label style={styles.formLabel}>Admin PIN</label>
        <input
          className="admin-input"
          type="password"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          placeholder="Masukkan PIN admin"
          style={styles.formInput}
        />

        <div style={styles.modalActions}>
          <button type="button" className="admin-small-btn" disabled={running} onClick={onCancel}>Cancel</button>
          <button type="button" className="admin-small-btn" disabled={running || !pin} onClick={onConfirm} style={styles.confirmButton}>
            {running ? "Processing..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
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
    const form = { role: row.role, phone: row.phone || "", active: Boolean(row.active) };
    setContactForm(form);
    openAction({
      type: "edit_contact",
      title: `Edit OTP Receiver - ${row.label}`,
      description: "Update nomor WhatsApp penerima OTP dan status aktif role contact.",
      form,
      setForm: setContactForm,
      payload: () => ({ action: "update_contact", ...contactForm }),
    });
  }

  function openToggleRole(row) {
    openAction({
      type: "toggle_role",
      title: `${row.active ? "Disable" : "Enable"} ${row.label} Login`,
      description: row.active
        ? "Role ini tidak akan bisa menerima OTP/login sampai diaktifkan lagi."
        : "Role ini akan diaktifkan kembali untuk menerima OTP/login.",
      payload: () => ({ action: "set_role_login", role: row.role, active: !row.active }),
    });
  }

  function openRevokeSession(row) {
    openAction({
      type: "revoke_session",
      title: "Revoke Session",
      description: `${row.device_name || "Unknown device"} akan kehilangan akses dan wajib login ulang.`,
      payload: () => ({ action: "revoke_session", id: row.id }),
    });
  }

  function openRevokeRole(role) {
    openAction({
      type: "revoke_role_sessions",
      title: `Revoke Sessions - ${role.label}`,
      description: `Semua session aktif untuk role ${role.label}, kecuali session admin saat ini, akan diputus.`,
      payload: () => ({ action: "revoke_role_sessions", role: role.value }),
    });
  }

  function openExpireOtp(row) {
    openAction({
      type: "expire_role_otp",
      title: `Expire OTP - ${row.label}`,
      description: "OTP pending/sent untuk role ini akan dibuat expired.",
      payload: () => ({ action: "expire_role_otp", role: row.role }),
    });
  }

  function openDanger(item) {
    openAction({
      type: "danger",
      title: item.label,
      description: item.description,
      payload: () => ({ action: item.action }),
    });
  }

  async function confirmAction() {
    if (!pendingAction || running || !pin) return;

    try {
      setRunning(true);
      const payload = pendingAction.payload();
      await sendJson("/api/admin/role-management", "PATCH", { ...payload, pin });
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
  const topStats = useMemo(() => ({
    roleCount: roles.length,
    sessionCount: cards.active_sessions?.length || 0,
    contactReady: cards.security_health?.contact_ready_count || 0,
    contactTotal: cards.security_health?.contact_total || 0,
  }), [cards.active_sessions, cards.security_health, roles.length]);

  if (loading) return <div style={styles.pageCard}>Loading role management...</div>;
  if (error) return <div style={styles.errorBox}>{error}</div>;

  return (
    <div style={styles.pageCard}>
      {toast && <div style={{ ...styles.toast, background: toast.type === "success" ? "#166534" : "#991b1b" }}>{toast.message}</div>}

      <div style={styles.pageHeader}>
        <div>
          <h2 style={styles.pageTitle}>Role Management</h2>
          <p style={styles.pageDescription}>Kelola role, OTP receiver, session aktif, audit, dan kontrol keamanan role.</p>
        </div>
        <button type="button" className="admin-small-btn admin-refresh-btn" onClick={loadRoleManagement}>Refresh</button>
      </div>

      <div style={styles.summaryGrid}>
        <div style={styles.summaryItem}><b>{topStats.roleCount}</b><span>Roles</span></div>
        <div style={styles.summaryItem}><b>{topStats.contactReady}/{topStats.contactTotal}</b><span>OTP Contacts</span></div>
        <div style={styles.summaryItem}><b>{topStats.sessionCount}</b><span>Active Sessions</span></div>
        <div style={styles.summaryItem}><b>{cards.security_health?.overall_status || "-"}</b><span>Security Health</span></div>
      </div>

      <div style={styles.gridOne}>
        <RoleOverviewCard rows={cards.role_overview || []} />
        <RoleContactCard rows={cards.role_contacts || []} onEdit={openEditContact} onToggle={openToggleRole} />
        <SecurityHealthCard health={cards.security_health || {}} />
      </div>

      <div style={styles.gridTwo}>
        <ActiveRoleSessionsCard rows={cards.active_sessions || []} roles={roles} onRevoke={openRevokeSession} onRevokeRole={openRevokeRole} />
        <OtpLoginMonitorCard rows={cards.otp_login_monitor || []} onExpire={openExpireOtp} />
      </div>

      <div style={styles.gridTwo}>
        <RoleAccessSummaryCard rows={cards.role_access_summary || []} />
        <RoleActivityLogCard rows={cards.role_activity_log || []} />
      </div>

      <DangerZoneCard rows={cards.danger_zone || []} onDanger={openDanger} />

      <ActionModal pendingAction={pendingAction} pin={pin} setPin={setPin} running={running} onCancel={closeAction} onConfirm={confirmAction} />
    </div>
  );
}

const styles = {
  pageCard: { padding: 18, border: "1px solid var(--admin-border)", borderRadius: 18, background: "var(--admin-surface-soft)", position: "relative" },
  pageHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap", marginBottom: 16 },
  pageTitle: { margin: 0, fontSize: 22, fontWeight: 900, color: "var(--admin-text)" },
  pageDescription: { margin: "6px 0 0", color: "var(--admin-muted)", fontSize: 13, lineHeight: 1.5 },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 },
  summaryItem: { border: "1px solid var(--admin-border)", background: "var(--admin-row)", borderRadius: 14, padding: 13, display: "grid", gap: 4 },
  gridOne: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 },
  gridTwo: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14, marginTop: 14 },
  card: { border: "1px solid var(--admin-border)", borderRadius: 16, background: "var(--admin-surface)", padding: 15, minWidth: 0 },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 12 },
  cardTitle: { margin: 0, fontSize: 17, fontWeight: 900, color: "var(--admin-text)" },
  cardDescription: { margin: "5px 0 0", color: "var(--admin-muted)", fontSize: 12, lineHeight: 1.45 },
  roleGrid: { display: "grid", gap: 10 },
  roleTile: { border: "1px solid var(--admin-border)", borderRadius: 14, background: "var(--admin-row)", padding: 12 },
  roleTileTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  roleName: { fontSize: 14, fontWeight: 900, color: "var(--admin-text)" },
  roleMeta: { marginTop: 3, fontSize: 12, color: "var(--admin-muted)" },
  metricGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 },
  smallMeta: { marginTop: 5, fontSize: 12, color: "var(--admin-muted)", lineHeight: 1.4 },
  mutedText: { fontSize: 12, color: "var(--admin-muted)", fontWeight: 700 },
  badge: { display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 999, padding: "4px 8px", fontSize: 11, fontWeight: 900, whiteSpace: "nowrap" },
  badgeTone: {
    success: { background: "rgba(22, 163, 74, 0.13)", color: "#16a34a" },
    warning: { background: "rgba(245, 158, 11, 0.14)", color: "#d97706" },
    danger: { background: "var(--admin-danger-soft)", color: "var(--admin-danger)" },
    neutral: { background: "var(--admin-row)", color: "var(--admin-muted)", border: "1px solid var(--admin-border)" },
  },
  emptyBox: { padding: 12, borderRadius: 12, background: "var(--admin-row)", color: "var(--admin-muted)", fontSize: 13 },
  errorBox: { padding: 14, borderRadius: 14, background: "var(--admin-danger-soft)", color: "var(--admin-danger)", fontWeight: 800 },
  toast: { position: "fixed", top: 18, left: "50%", transform: "translateX(-50%)", color: "#fff", borderRadius: 999, padding: "10px 14px", fontSize: 13, fontWeight: 900, zIndex: 80, boxShadow: "0 16px 40px rgba(15,23,42,.18)" },
  actionButton: { padding: "7px 9px", borderRadius: 9, fontSize: 12, fontWeight: 900, background: "var(--admin-row)", color: "var(--admin-text)", border: "1px solid var(--admin-border)", cursor: "pointer" },
  actionButtonDanger: { background: "var(--admin-danger)", color: "#fff", border: "none" },
  actionButtonWarning: { background: "rgba(245,158,11,.14)", color: "#b45309", border: "1px solid rgba(245,158,11,.32)" },
  rowActions: { display: "flex", gap: 6, flexWrap: "wrap" },
  headerActions: { display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" },
  accessList: { display: "grid", gap: 10 },
  accessItem: { border: "1px solid var(--admin-border)", borderRadius: 14, background: "var(--admin-row)", padding: 12 },
  accessHeader: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" },
  modulePills: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 },
  modulePill: { border: "1px solid var(--admin-border)", borderRadius: 999, padding: "5px 8px", fontSize: 11, fontWeight: 800, background: "var(--admin-surface)", color: "var(--admin-text)" },
  activityList: { display: "grid", gap: 9 },
  activityItem: { border: "1px solid var(--admin-border)", borderRadius: 13, background: "var(--admin-row)", padding: 11 },
  activityTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  healthHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" },
  healthStatus: { fontSize: 30, fontWeight: 950, lineHeight: 1.1 },
  healthMetrics: { display: "grid", gap: 6, color: "var(--admin-muted)", fontSize: 12, fontWeight: 800 },
  healthChecks: { display: "flex", gap: 7, flexWrap: "wrap", marginTop: 12 },
  warningList: { marginTop: 12, padding: 12, borderRadius: 12, background: "var(--admin-row)", color: "var(--admin-muted)", fontSize: 12, lineHeight: 1.6 },
  dangerList: { display: "grid", gap: 10 },
  dangerItem: { border: "1px solid var(--admin-border)", borderRadius: 14, background: "var(--admin-row)", padding: 12, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" },
  dangerMeta: { display: "flex", gap: 8, alignItems: "center", color: "var(--admin-muted)", fontSize: 12, fontWeight: 800, flexWrap: "wrap" },
  overlay: { position: "fixed", inset: 0, zIndex: 90, background: "rgba(15,23,42,.45)", display: "grid", placeItems: "center", padding: 18 },
  modal: { width: "min(440px, 100%)", borderRadius: 18, border: "1px solid var(--admin-border)", background: "var(--admin-surface)", padding: 20, boxShadow: "0 28px 80px rgba(15,23,42,.28)" },
  modalBadge: { display: "inline-flex", marginBottom: 12, padding: "6px 10px", borderRadius: 999, background: "var(--admin-primary-soft)", color: "var(--admin-primary)", fontSize: 11, fontWeight: 900, letterSpacing: ".08em", textTransform: "uppercase" },
  modalTitle: { margin: "0 0 8px", color: "var(--admin-text)", fontSize: 20, fontWeight: 950 },
  modalDescription: { margin: "0 0 14px", color: "var(--admin-muted)", fontSize: 13, lineHeight: 1.5 },
  formGrid: { display: "grid", gap: 8, marginBottom: 12 },
  formLabel: { display: "block", margin: "10px 0 6px", color: "var(--admin-text)", fontSize: 12, fontWeight: 900 },
  formInput: { width: "100%", borderRadius: 12, padding: "11px 12px" },
  checkboxLabel: { display: "flex", alignItems: "center", gap: 8, color: "var(--admin-muted)", fontSize: 13, fontWeight: 800 },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 },
  confirmButton: { background: "var(--admin-primary)", color: "#fff", border: "none" },
};
