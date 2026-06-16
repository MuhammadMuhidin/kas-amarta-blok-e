"use client";

import RoleManagementLazyTab from "@/components/admin/RoleManagementLazyTab";

/**
 * Role Management entry point.
 *
 * The original Role Management implementation was preserved without functional
 * changes in ./RoleManagementPanel.js. This entry now delegates to a lazy
 * wrapper so only the active subtab is mounted:
 *
 * - Role Control mounts RoleManagementPanel.
 * - Security Overview mounts RoleSecurityOverview.
 *
 * Keeping this public entry path unchanged means AdminPageClient does not need
 * a large parent-level rewrite. Existing imports continue to resolve to
 * RoleManagementTab, while the heavy management table, session list, OTP
 * monitor, modals, PIN confirmation, and contact actions remain implemented in
 * RoleManagementPanel.
 *
 * The two panels are intentionally mutually exclusive. Switching subtabs
 * unmounts the inactive panel, aborting the Security Overview request through
 * its effect cleanup and preventing duplicate rendering or stale UI state.
 */
export default function RoleManagementTab() {
  return <RoleManagementLazyTab />;
}
