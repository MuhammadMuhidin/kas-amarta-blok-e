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
    <div role="tablist" aria-label={ariaLabel} style={styles.wrap}>
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
            style={{
              ...styles.button,
              ...(active ? styles.active : {}),
              opacity: item.disabled ? 0.5 : 1,
            }}
          >
            <span>{item.label}</span>
            {Number(item.badge || 0) > 0 && (
              <span style={{ ...styles.badge, ...(active ? styles.badgeActive : {}) }}>
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
    gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))",
    gap: 8,
    marginBottom: 18,
    padding: 5,
    border: "1px solid var(--admin-border)",
    borderRadius: 14,
    background: "var(--admin-row)",
  },
  button: {
    minWidth: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    padding: "10px 12px",
    border: 0,
    borderRadius: 10,
    background: "transparent",
    color: "var(--admin-muted)",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  active: {
    background: "var(--admin-primary)",
    color: "var(--admin-on-primary)",
    boxShadow: "0 6px 18px rgba(0,0,0,.12)",
  },
  badge: {
    minWidth: 20,
    height: 20,
    display: "inline-grid",
    placeItems: "center",
    padding: "0 6px",
    borderRadius: 999,
    background: "var(--admin-card)",
    color: "var(--admin-text)",
    fontSize: 10,
    fontWeight: 900,
  },
  badgeActive: {
    background: "rgba(255,255,255,.2)",
    color: "inherit",
  },
};
