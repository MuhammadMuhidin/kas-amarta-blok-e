"use client";

import { useTransition } from "react";

export default function AdminSubtabs({
  items,
  value,
  onChange,
  ariaLabel = "Admin section navigation",
}) {
  const [pending, startTransition] = useTransition();
  const scrollable = items.length >= 4;

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
        ...(scrollable
          ? styles.scrollableWrap
          : {
              gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
            }),
      }}
    >
      {items.map((item) => {
        const active = item.value === value;
        const displayLabel = item.label === "Actions & Alerts"
          ? "Action Alert"
          : item.label;

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
              ...(scrollable ? styles.scrollableButton : {}),
              ...(active ? styles.active : {}),
              opacity: item.disabled ? 0.5 : 1,
            }}
          >
            <span style={styles.label}>{displayLabel}</span>
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
    width: "100%",
    boxSizing: "border-box",
    display: "grid",
    gap: 8,
    marginBottom: 18,
    padding: 5,
    border: "1px solid var(--admin-border)",
    borderRadius: 14,
    background: "var(--admin-row)",
  },
  scrollableWrap: {
    gridAutoFlow: "column",
    gridAutoColumns: "max-content",
    gridTemplateColumns: "none",
    overflowX: "auto",
    overflowY: "hidden",
    overscrollBehaviorX: "contain",
    WebkitOverflowScrolling: "touch",
    scrollSnapType: "x proximity",
    touchAction: "pan-x",
    scrollbarWidth: "thin",
  },
  button: {
    minWidth: 0,
    minHeight: 54,
    display: "inline-flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    padding: "9px 10px",
    border: 0,
    borderRadius: 10,
    background: "transparent",
    color: "var(--admin-muted)",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  scrollableButton: {
    minWidth: 128,
    scrollSnapAlign: "start",
  },
  label: {
    display: "block",
    minWidth: 0,
    maxWidth: "100%",
    lineHeight: 1.2,
    textAlign: "center",
    whiteSpace: "nowrap",
    wordBreak: "normal",
    overflowWrap: "normal",
    hyphens: "none",
  },
  active: {
    background: "var(--admin-primary)",
    color: "#ffffff",
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
