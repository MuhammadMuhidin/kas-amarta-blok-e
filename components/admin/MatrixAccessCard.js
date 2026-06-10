"use client";

import LoadingButtonContent from "@/components/admin/LoadingButtonContent";
import { useEffect, useState } from "react";

function getCookie(name) {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}

export default function MatrixAccessCard({ requestPin, disabled, showPopup }) {
  const [selectedRole, setSelectedRole] = useState("ketua");
  const [roles, setRoles] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");

  async function loadMatrix(role = selectedRole) {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/settings/access-matrix?role=${encodeURIComponent(role)}`, {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to load access matrix");

      setSelectedRole(data.role);
      setRoles(data.roles || []);
      setModules(data.modules || []);
    } catch (err) {
      showPopup(err.message || "Failed to load access matrix", "error");
    } finally {
      setLoading(false);
    }
  }

  function toggleModule(module) {
    if (module.locked || disabled || savingKey) return;

    requestPin(async (pin) => {
      try {
        setSavingKey(module.key);
        const csrf = getCookie("csrf_token");
        const res = await fetch("/api/admin/settings/access-matrix", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-csrf-token": csrf || "" },
          body: JSON.stringify({
            role: selectedRole,
            module_key: module.key,
            is_visible: !module.visible,
            pin,
          }),
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Failed to update access matrix");

        setSelectedRole(data.role);
        setModules(data.modules || []);
        showPopup("Matrix access updated successfully", "success");
      } catch (err) {
        showPopup(err.message || "Failed to update access matrix", "error");
      } finally {
        setSavingKey("");
      }
    });
  }

  useEffect(() => {
    loadMatrix(selectedRole);
  }, []);

  return (
    <div style={styles.cardSection}>
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.title}>Matrix Access</h2>
          <p style={styles.description}>Choose a role, then enable only the modules that role may access.</p>
        </div>
        <select
          className="admin-input"
          value={selectedRole}
          disabled={loading || disabled || savingKey}
          onChange={(e) => loadMatrix(e.target.value)}
          style={styles.roleSelect}
        >
          {roles.map((role) => (
            <option key={role.value} value={role.value}>{role.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={styles.loadingBox}>Loading matrix access...</div>
      ) : (
        <div style={styles.moduleGrid}>
          {modules.map((module) => {
            const saving = savingKey === module.key;
            return (
              <button
                key={module.key}
                type="button"
                disabled={module.locked || disabled || Boolean(savingKey)}
                onClick={() => toggleModule(module)}
                style={{
                  ...styles.moduleItem,
                  ...(module.visible ? styles.moduleItemOn : styles.moduleItemOff),
                  ...(module.locked ? styles.moduleItemLocked : {}),
                }}
              >
                <div>
                  <div style={styles.moduleName}>{module.label}</div>
                  <div style={styles.moduleMeta}>{module.locked ? "Locked" : module.visible ? "Visible" : "Hidden"}</div>
                </div>
                <span style={{
                  ...styles.pill,
                  ...(module.visible ? styles.pillOn : styles.pillOff),
                }}>
                  <LoadingButtonContent loading={saving} loadingText="...">
                    {module.visible ? "ON" : "OFF"}
                  </LoadingButtonContent>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  cardSection: {
    marginTop: 22,
    padding: 18,
    border: "1px solid var(--admin-border)",
    borderRadius: 18,
    background: "var(--admin-surface-soft)",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 14,
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: "var(--admin-text)",
  },
  description: {
    margin: "6px 0 0",
    color: "var(--admin-muted)",
    fontSize: 13,
    lineHeight: 1.45,
  },
  roleSelect: {
    minWidth: 180,
    padding: "10px 12px",
    borderRadius: 12,
  },
  loadingBox: {
    padding: 14,
    borderRadius: 12,
    background: "var(--admin-surface)",
    color: "var(--admin-muted)",
  },
  moduleGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 10,
  },
  moduleItem: {
    border: "1px solid var(--admin-border)",
    borderRadius: 14,
    padding: "12px 13px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    cursor: "pointer",
    textAlign: "left",
  },
  moduleItemOn: {
    background: "rgba(34,197,94,.10)",
  },
  moduleItemOff: {
    background: "var(--admin-surface)",
  },
  moduleItemLocked: {
    opacity: 0.72,
    cursor: "not-allowed",
  },
  moduleName: {
    fontWeight: 850,
    color: "var(--admin-text)",
  },
  moduleMeta: {
    marginTop: 3,
    fontSize: 12,
    color: "var(--admin-muted)",
  },
  pill: {
    minWidth: 46,
    textAlign: "center",
    borderRadius: 999,
    padding: "6px 9px",
    fontSize: 12,
    fontWeight: 900,
  },
  pillOn: {
    background: "#16a34a",
    color: "#fff",
  },
  pillOff: {
    background: "#e2e8f0",
    color: "#334155",
  },
};
