"use client";

import { useTransition } from "react";

export default function AdminSubtabs({
  items,
  value,
  onChange,
  ariaLabel = "Admin section navigation",
}) {
  const [pending, startTransition] = useTransition();

  function select(nextValue) {
    if (nextValue === value || pending) return;
    startTransition(() => onChange(nextValue));
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="admin-subtabs"
      style={{
        ...styles.wrap,
        gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))`,
      }}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={item.panelId || undefined}
            disabled={pending || item.disabled}
            onClick={() => select(item.value)}
            className={active ? "admin-subtab admin-subtab-active" : "admin-subtab"}
            style={{
              ...styles.button,
              ...(active ? styles.active : {}),
              opacity: item.disabled ? 0.5 : 1,
            }}
          >
            <span style={styles.label}>{item.label}</span>
            {Number(item.badge || 0) > 0 && (
              <span
                className="admin-subtab-counter"
                style={{
                  ...styles.badge,
                  ...(active ? styles.badgeActive : {}),
                }}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

const styles = {
  wrap: {
    display: "grid",
    gap: 8,
    marginBottom: 18,
    padding: 5,
    border: "1px solid var(--admin-border)",
    borderRadius: 14,
    background: "var(--admin-row)",
  },
  button: {
    minWidth: 0,
    minHeight: 54,
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    padding: "8px 7px",
    border: 0,
    borderRadius: 10,
    background: "transparent",
    color: "var(--admin-muted)",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  label: {
    minWidth: 0,
    maxWidth: "100%",
    lineHeight: 1.2,
    textAlign: "center",
    whiteSpace: "nowrap",
  },
  active: {
    background: "var(--admin-primary)",
    color: "var(--admin-on-primary)",
    boxShadow: "0 6px 18px rgba(0,0,0,.12)",
  },
  badge: {
    width: 22,
    minWidth: 22,
    height: 22,
    display: "inline-grid",
    placeItems: "center",
    padding: 0,
    border: "1px solid currentColor",
    borderRadius: "50%",
    background: "var(--admin-card)",
    color: "var(--admin-text)",
    fontSize: 10,
    fontWeight: 900,
    lineHeight: 1,
    flexShrink: 0,
  },
  badgeActive: {
    background: "rgba(255,255,255,.16)",
    color: "inherit",
    borderColor: "rgba(255,255,255,.8)",
  },
};
