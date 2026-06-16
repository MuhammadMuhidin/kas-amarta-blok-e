"use client";

import LoadingButtonContent from "@/components/admin/LoadingButtonContent";
import { INTEGRATION_CONFIG_GROUPS } from "@/lib/integrationConfigDefinitions";
import { useEffect, useMemo, useState } from "react";

const cookie = (name) => document.cookie
  .split("; ")
  .find((row) => row.startsWith(`${name}=`))
  ?.split("=")[1] || "";

const SOURCE_META = {
  supabase: { label: "Supabase", background: "#dcfce7", color: "#166534" },
  legacy_supabase: { label: "Existing Supabase setting", background: "#dbeafe", color: "#1d4ed8" },
  env: { label: "ENV fallback", background: "#fef3c7", color: "#92400e" },
  default: { label: "Default", background: "#e2e8f0", color: "#475569" },
  missing: { label: "Missing", background: "#fee2e2", color: "#991b1b" },
};

function displayLocalValue(field) {
  if (field.type === "boolean") return Boolean(field.value);
  return String(field.value ?? "");
}

function FieldInput({ field, value, disabled, onChange }) {
  if (field.type === "boolean") {
    return (
      <select
        className="admin-input"
        value={value ? "true" : "false"}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value === "true")}
        style={ui.input}
      >
        <option value="true">ON</option>
        <option value="false">OFF</option>
      </select>
    );
  }

  if (field.type === "select") {
    const options = field.options.includes(value)
      ? field.options
      : [value, ...field.options].filter(Boolean);

    return (
      <select
        className="admin-input"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        style={ui.input}
      >
        <option value="" disabled>Select a platform</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    );
  }

  if (field.type === "email-list") {
    return (
      <textarea
        value={value}
        disabled={disabled}
        rows={3}
        placeholder="admin@example.com, bendahara@example.com"
        onChange={(event) => onChange(event.target.value)}
        style={{ ...ui.input, minHeight: 82, resize: "vertical" }}
      />
    );
  }

  return (
    <input
      type={field.type === "email" ? "email" : field.type === "url" ? "url" : "text"}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      style={ui.input}
      autoComplete="off"
      spellCheck={false}
    />
  );
}

export default function IntegrationConfigurationCard({
  requestPin,
  showPopup,
  onBusyChange,
  isMobile,
}) {
  const [fields, setFields] = useState([]);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/settings/integrations", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load Integration Configuration");
      setFields(data.fields || []);
      setValues(Object.fromEntries((data.fields || []).map((field) => [
        field.key,
        displayLocalValue(field),
      ])));
    } catch (error) {
      showPopup(error.message || "Failed to load Integration Configuration", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => Object.fromEntries(
    INTEGRATION_CONFIG_GROUPS.map((group) => [
      group,
      fields.filter((field) => field.group === group),
    ]),
  ), [fields]);

  function mutate(key, action) {
    requestPin(async (pin) => {
      setSavingKey(key);
      onBusyChange(true);
      try {
        const field = fields.find((item) => item.key === key);
        const response = await fetch("/api/admin/settings/integrations", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": cookie("csrf_token"),
          },
          body: JSON.stringify({
            action,
            key,
            value: action === "save" ? values[key] : undefined,
            pin,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to update Integration Configuration");
        await load();
        showPopup(
          action === "reset"
            ? `${field?.label || key} reset to fallback`
            : `${field?.label || key} saved to Supabase`,
        );
      } catch (error) {
        showPopup(error.message || "Failed to update Integration Configuration", "error");
      } finally {
        setSavingKey("");
        onBusyChange(false);
      }
    });
  }

  return (
    <section style={ui.section}>
      <div style={{ ...ui.header, ...(isMobile ? ui.headerMobile : {}) }}>
        <div>
          <h2 style={ui.title}>Integration Configuration</h2>
          <p style={ui.intro}>
            Supabase overrides the platform ENV. Resetting an override returns the field to its ENV,
            existing setting, or application default.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading || Boolean(savingKey)}
          style={{
            ...ui.refresh,
            ...(isMobile ? ui.refreshMobile : {}),
            opacity: loading || savingKey ? 0.6 : 1,
          }}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {loading && !fields.length ? (
        <div style={ui.loading}>Loading Integration Configuration...</div>
      ) : (
        INTEGRATION_CONFIG_GROUPS.map((group) => {
          const groupFields = grouped[group] || [];
          if (!groupFields.length) return null;
          return (
            <div key={group} style={ui.group}>
              <div style={{ ...ui.groupHeader, ...(isMobile ? ui.groupHeaderMobile : {}) }}>
                <h3 style={ui.groupTitle}>{group}</h3>
                <span style={ui.groupHint}>Verify changes from Monitoring after saving.</span>
              </div>

              {groupFields.map((field) => {
                const source = SOURCE_META[field.source] || SOURCE_META.missing;
                const localValue = values[field.key] ?? (field.type === "boolean" ? false : "");
                const same = field.type === "boolean"
                  ? Boolean(localValue) === Boolean(field.value)
                  : String(localValue) === String(field.value ?? "");
                const busy = Boolean(savingKey);
                const saveDisabled = busy || (field.source === "supabase" && same);
                const resetDisabled = busy || field.source !== "supabase";

                return (
                  <div
                    key={field.key}
                    style={{ ...ui.field, ...(isMobile ? ui.fieldMobile : {}) }}
                  >
                    <div style={ui.fieldInfo}>
                      <div style={ui.labelLine}>
                        <strong style={ui.label}>{field.label}</strong>
                        <span style={{ ...ui.source, background: source.background, color: source.color }}>
                          {source.label}
                        </span>
                      </div>
                      <code style={ui.key}>{field.key}</code>
                      <p style={ui.description}>{field.description}</p>
                      {field.key === "WA_SESSION_ID" && (
                        <p style={ui.warning}>Changing this value may require WhatsApp pairing again.</p>
                      )}
                    </div>

                    <div style={{ ...ui.actions, ...(isMobile ? ui.actionsMobile : {}) }}>
                      <FieldInput
                        field={field}
                        value={localValue}
                        disabled={busy}
                        onChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))}
                      />
                      <div style={{ ...ui.buttons, ...(isMobile ? ui.buttonsMobile : {}) }}>
                        <button
                          type="button"
                          disabled={saveDisabled}
                          onClick={() => mutate(field.key, "save")}
                          style={{ ...ui.save, opacity: saveDisabled ? 0.55 : 1 }}
                        >
                          <LoadingButtonContent
                            loading={savingKey === field.key}
                            loadingText="Saving..."
                          >
                            Save to Supabase
                          </LoadingButtonContent>
                        </button>
                        <button
                          type="button"
                          disabled={resetDisabled}
                          onClick={() => mutate(field.key, "reset")}
                          style={{ ...ui.reset, opacity: resetDisabled ? 0.5 : 1 }}
                        >
                          Reset to fallback
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })
      )}
    </section>
  );
}

const ui = {
  section: {
    marginBottom: 28,
    paddingTop: 4,
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 14,
  },
  headerMobile: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  title: { margin: 0, fontSize: 20 },
  intro: {
    margin: "7px 0 0",
    maxWidth: 760,
    color: "var(--admin-muted)",
    fontSize: 13,
    lineHeight: 1.55,
  },
  refresh: {
    flexShrink: 0,
    padding: "9px 13px",
    borderRadius: 10,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-row)",
    color: "var(--admin-text)",
    fontWeight: 800,
    cursor: "pointer",
  },
  refreshMobile: { width: "100%" },
  loading: {
    padding: 18,
    border: "1px solid var(--admin-border)",
    borderRadius: 14,
    background: "var(--admin-row)",
    color: "var(--admin-muted)",
  },
  group: {
    marginTop: 14,
    overflow: "hidden",
    border: "1px solid var(--admin-border)",
    borderRadius: 16,
    background: "var(--admin-row)",
  },
  groupHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    padding: "13px 15px",
    borderBottom: "1px solid var(--admin-border)",
    background: "var(--admin-card)",
  },
  groupHeaderMobile: {
    alignItems: "flex-start",
    flexDirection: "column",
  },
  groupTitle: { margin: 0, fontSize: 15 },
  groupHint: { color: "var(--admin-muted)", fontSize: 11 },
  field: {
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) minmax(290px,430px)",
    gap: 18,
    alignItems: "center",
    padding: 15,
    borderTop: "1px solid var(--admin-border)",
  },
  fieldMobile: {
    gridTemplateColumns: "minmax(0,1fr)",
    gap: 12,
  },
  fieldInfo: { minWidth: 0 },
  labelLine: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  label: { fontSize: 14 },
  source: {
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 800,
  },
  key: {
    display: "inline-block",
    marginTop: 7,
    color: "var(--admin-muted)",
    fontSize: 11,
    overflowWrap: "anywhere",
  },
  description: {
    margin: "6px 0 0",
    color: "var(--admin-muted)",
    fontSize: 12,
    lineHeight: 1.5,
  },
  warning: {
    margin: "7px 0 0",
    color: "#b45309",
    fontSize: 12,
    fontWeight: 700,
  },
  actions: { minWidth: 0 },
  actionsMobile: { width: "100%" },
  input: {
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    border: "1px solid var(--admin-border)",
    borderRadius: 10,
    background: "var(--admin-card)",
    color: "var(--admin-text)",
  },
  buttons: {
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
    gap: 8,
    marginTop: 9,
  },
  buttonsMobile: {
    gridTemplateColumns: "minmax(0,1fr)",
  },
  save: {
    minWidth: 0,
    padding: "10px 12px",
    border: "none",
    borderRadius: 10,
    background: "var(--admin-primary)",
    color: "var(--admin-on-primary)",
    fontWeight: 800,
    cursor: "pointer",
  },
  reset: {
    minWidth: 0,
    padding: "10px 12px",
    border: "1px solid var(--admin-border)",
    borderRadius: 10,
    background: "var(--admin-card)",
    color: "var(--admin-text)",
    fontWeight: 800,
    cursor: "pointer",
  },
};
