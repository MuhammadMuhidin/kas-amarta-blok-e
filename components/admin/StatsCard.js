export default function StatsCard({
  label,
  value,
  active = false,
  onClick,
}) {
  return (
    <div
      onClick={onClick}
      className={
        active
          ? "admin-summary-card admin-summary-card-active"
          : "admin-summary-card"
      }
    >
      <div>{label}</div>
      <b>{value}</b>
    </div>
  );
}
