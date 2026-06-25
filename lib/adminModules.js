export const ADMIN_MODULES = [
  { key: "overview", label: "Overview", icon: "📌" },
  { key: "personal", label: "Member", icon: "👤" },
  { key: "payment", label: "Payment", icon: "💳" },
  { key: "deposit", label: "Booking Payment", icon: "💰" },
  { key: "cashflow", label: "Cashflow", icon: "📝" },
  { key: "timeline", label: "Timeline", icon: "📸" },
  { key: "summary", label: "Summary Backup", icon: "🛡️" },
  { key: "monitoring", label: "Monitoring", icon: "🖥️" },
  { key: "activity", label: "Activity", icon: "📋" },
  { key: "master_management", label: "Master Management", icon: "🗂️" },
  { key: "approval_center", label: "Approval Center", icon: "✅" },
  { key: "complaint_suggestions", label: "Complaint and Suggestions", icon: "📢" },
  { key: "role_management", label: "Role Management", icon: "🧩" },
  { key: "settings", label: "Settings", icon: "⚙️" },
];

const MODULE_KEYS = new Set(ADMIN_MODULES.map((module) => module.key));

export function normalizeAdminModuleKey(value) {
  const key = String(value || "").trim().toLowerCase();
  return MODULE_KEYS.has(key) ? key : "";
}

export function filterKnownAdminModules(keys = []) {
  const allowed = new Set((keys || []).map(normalizeAdminModuleKey).filter(Boolean));
  return ADMIN_MODULES.filter((module) => allowed.has(module.key));
}

export function getDefaultAdminModule(keys = []) {
  const modules = filterKnownAdminModules(keys);
  return modules[0]?.key || "overview";
}
