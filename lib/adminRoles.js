export const ADMIN_ACCESS_ROLES = [
  { value: "admin", label: "Administrator" },
  { value: "ketua", label: "Ketua" },
  { value: "sekretaris", label: "Sekretaris" },
  { value: "bendahara", label: "Bendahara" },
  { value: "sapras", label: "Sarana & Prasarana" }
];

export const DEFAULT_ADMIN_ACCESS_ROLE = "admin";

const ROLE_VALUES = new Set(ADMIN_ACCESS_ROLES.map((role) => role.value));

export function normalizeAdminAccessRole(value) {
  const role = String(value || "").trim().toLowerCase();
  return ROLE_VALUES.has(role) ? role : "";
}

export function resolveAdminAccessRole(value) {
  return normalizeAdminAccessRole(value) || DEFAULT_ADMIN_ACCESS_ROLE;
}

export function assertAdminAccessRole(value) {
  const role = normalizeAdminAccessRole(value);
  if (!role) throw new Error("Invalid admin access role");
  return role;
}

export function getAdminAccessRoleLabel(value) {
  const role = normalizeAdminAccessRole(value) || DEFAULT_ADMIN_ACCESS_ROLE;
  return ADMIN_ACCESS_ROLES.find((item) => item.value === role)?.label || "Administrator";
}
