"use client";

import { readJson } from "@/components/admin/adminClientApi";
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

function RoleContactCard({ rows }) {
  return (
    <Card title="Role Contact / OTP Receiver" description="Nomor WhatsApp tujuan OTP untuk tiap role.">
      <MiniTable
        columns={["Role", "Name", "WhatsApp", "Status", "Updated"]}
        rows={rows}
        emptyText="No role contacts found."
        renderRow={(row, index) => (
          <tr key={row.role} className={index % 2 ? "admin-row-alt" : ""}>
            <td className="admin-td">{row.label}</td>
            <td className="admin-td">{row.display_name || "-"}</td>
            <td className="admin-td">{maskPhone(row.phone)}</td>
            <td className="admin-td"><Badge tone={row.active ? "success" : "warning"}>{row.active ? "Active" : "Inactive"}</Badge></td>
            <td className="admin-td">{formatTime(row.updated_at)}</td>
          </tr>
        )}
      />
    </Card>
  );
}

function ActiveRoleSessionsCard({ rows, roles }) {
  return (
    <Card title="Active Role Sessions" description="Perangkat yang sedang memegang akses admin berdasarkan role.">
      <MiniTable
        columns={["Role", "Device", "Location", "Last Active", "Status"]}
        rows={rows}
        emptyText="No active role sessions."
        renderRow={(row, index) => (
          <tr key={row.id} className={index % 2 ? "admin-row-alt" : ""}>
            <td className="admin-td">{getRoleLabel(roles, row.access_role)}</td>
            <td className="admin-td">{row.device_name || "Unknown device"}</td>
            <td className="admin-td">{row.location || row.ip || "-"}</td>
            <td className="admin-td">{formatTime(row.last_active)}</td>
            <td className="admin-td"><Badge tone={row.current ? "success" : "neutral"}>{row.current ? "Current" : "Active"}</Badge></td>
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

function OtpLoginMonitorCard({ rows }) {
  return (
    <Card title="OTP Login Monitor" description="Status OTP terakhir per role. Kode OTP tidak ditampilkan.">
      <MiniTable
        columns={["Role", "Status", "Attempt", "Expires", "Used"]}
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
              <td className="admin-td">{formatTime(row.used_at)}</td>
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

function DangerZoneCard({ rows }) {
  return (
    <Card title="Danger Zone" description="Aksi sensitif ditampilkan sebagai status. Patch ini tidak menambah destructive flow baru.">
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
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function RoleManagementTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      <div style={styles.pageHeader}>
        <div>
          <h2 style={styles.pageTitle}>Role Management</h2>
          <p style={styles.pageDescription}>Kelola visibility role, receiver OTP, session aktif, audit, dan status keamanan role.</p>
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
        <RoleContactCard rows={cards.role_contacts || []} />
        <SecurityHealthCard health={cards.security_health || {}} />
      </div>

      <div style={styles.gridTwo}>
        <ActiveRoleSessionsCard rows={cards.active_sessions || []} roles={roles} />
        <OtpLoginMonitorCard rows={cards.otp_login_monitor || []} />
      </div>

      <div style={styles.gridTwo}>
        <RoleAccessSummaryCard rows={cards.role_access_summary || []} />
        <RoleActivityLogCard rows={cards.role_activity_log || []} />
      </div>

      <DangerZoneCard rows={cards.danger_zone || []} />
    </div>
  );
}

const styles = {
  pageCard: {
    padding: 18,
    border: "1px solid var(--admin-border)",
    borderRadius: 18,
    background: "var(--admin-surface-soft)",
  },
  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  pageTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 900,
    color: "var(--admin-text)",
  },
  pageDescription: {
    margin: "6px 0 0",
    color: "var(--admin-muted)",
    fontSize: 13,
    lineHeight: 1.5,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 10,
    marginBottom: 16,
  },
  summaryItem: {
    border: "1px solid var(--admin-border)",
    background: "var(--admin-row)",
    borderRadius: 14,
    padding: 13,
    display: "grid",
    gap: 4,
  },
  gridOne: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 14,
  },
  gridTwo: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 14,
    marginTop: 14,
  },
  card: {
    border: "1px solid var(--admin-border)",
    borderRadius: 16,
    background: "var(--admin-surface)",
    padding: 15,
    minWidth: 0,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  cardTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 900,
    color: "var(--admin-text)",
  },
  cardDescription: {
    margin: "5px 0 0",
    color: "var(--admin-muted)",
    fontSize: 12,
    lineHeight: 1.45,
  },
  roleGrid: {
    display: "grid",
    gap: 10,
  },
  roleTile: {
    border: "1px solid var(--admin-border)",
    borderRadius: 14,
    background: "var(--admin-row)",
    padding: 12,
  },
  roleTileTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  roleName: {
    fontSize: 14,
    fontWeight: 900,
    color: "var(--admin-text)",
  },
  roleMeta: {
    marginTop: 3,
    fontSize: 12,
    color: "var(--admin-muted)",
  },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    marginTop: 12,
  },
  smallMeta: {
    marginTop: 5,
    fontSize: 12,
    color: "var(--admin-muted)",
    lineHeight: 1.4,
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    padding: "4px 8px",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  badgeTone: {
    success: { background: "rgba(22, 163, 74, 0.13)", color: "#16a34a" },
    warning: { background: "rgba(245, 158, 11, 0.14)", color: "#d97706" },
    danger: { background: "var(--admin-danger-soft)", color: "var(--admin-danger)" },
    neutral: { background: "var(--admin-row)", color: "var(--admin-muted)", border: "1px solid var(--admin-border)" },
  },
  emptyBox: {
    padding: 12,
    borderRadius: 12,
    background: "var(--admin-row)",
    color: "var(--admin-muted)",
    fontSize: 13,
  },
  errorBox: {
    padding: 14,
    borderRadius: 14,
    background: "var(--admin-danger-soft)",
    color: "var(--admin-danger)",
    fontWeight: 800,
  },
  accessList: {
    display: "grid",
    gap: 10,
  },
  accessItem: {
    border: "1px solid var(--admin-border)",
    borderRadius: 14,
    background: "var(--admin-row)",
    padding: 12,
  },
  accessHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
  },
  modulePills: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    marginTop: 10,
  },
  modulePill: {
    border: "1px solid var(--admin-border)",
    borderRadius: 999,
    padding: "5px 8px",
    fontSize: 11,
    fontWeight: 800,
    background: "var(--admin-surface)",
    color: "var(--admin-text)",
  },
  activityList: {
    display: "grid",
    gap: 9,
  },
  activityItem: {
    border: "1px solid var(--admin-border)",
    borderRadius: 13,
    background: "var(--admin-row)",
    padding: 11,
  },
  activityTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  healthHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  healthStatus: {
    fontSize: 30,
    fontWeight: 950,
    lineHeight: 1.1,
  },
  healthMetrics: {
    display: "grid",
    gap: 6,
    color: "var(--admin-muted)",
    fontSize: 12,
    fontWeight: 800,
  },
  healthChecks: {
    display: "flex",
    gap: 7,
    flexWrap: "wrap",
    marginTop: 12,
  },
  warningList: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    background: "var(--admin-row)",
    color: "var(--admin-muted)",
    fontSize: 12,
    lineHeight: 1.6,
  },
  dangerList: {
    display: "grid",
    gap: 10,
  },
  dangerItem: {
    border: "1px solid var(--admin-border)",
    borderRadius: 14,
    background: "var(--admin-row)",
    padding: 12,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  dangerMeta: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    color: "var(--admin-muted)",
    fontSize: 12,
    fontWeight: 800,
  },
};
