"use client";

import AdminSubtabs from "@/components/admin/AdminSubtabs";
import RoleSecurityOverview from "@/components/admin/RoleSecurityOverview";
import RoleManagementPanel from "@/components/admin/tabs/RoleManagementPanel";
import { useState } from "react";

export default function RoleManagementLazyTab() {
  const [panel, setPanel] = useState("control");

  return (
    <>
      <AdminSubtabs
        value={panel}
        onChange={setPanel}
        ariaLabel="Role Management navigation"
        items={[
          { value: "control", label: "Role Center", panelId: "role-control-panel" },
          { value: "security", label: "Security Overview", panelId: "role-security-panel" },
        ]}
      />

      {panel === "control" && (
        <div id="role-control-panel" role="tabpanel">
          <RoleManagementPanel />
        </div>
      )}

      {panel === "security" && <RoleSecurityOverview />}
    </>
  );
}
