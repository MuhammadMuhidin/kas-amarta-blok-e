"use client";

import AdminSubtabs from "@/components/admin/AdminSubtabs";
import MasterManagementTab from "@/components/admin/tabs/MasterManagementTab";
import { useState } from "react";

function OverviewNotice() {
  return (
    <div id="master-overview-panel" role="tabpanel" className="admin-card">
      <h3 style={{ marginTop: 0 }}>Lifecycle Overview</h3>
      <p style={{ color: "var(--admin-muted)", lineHeight: 1.6 }}>
        Open Master Builder to review active, draft, archived, and versioned request configurations.
        The builder is unmounted while this overview is active.
      </p>
    </div>
  );
}

export default function MasterManagementLazyTab() {
  const [panel, setPanel] = useState("builder");

  return (
    <>
      <AdminSubtabs
        value={panel}
        onChange={setPanel}
        ariaLabel="Master Management navigation"
        items={[
          { value: "builder", label: "Master Builder", panelId: "master-builder-panel" },
          { value: "overview", label: "Lifecycle Overview", panelId: "master-overview-panel" },
        ]}
      />
      {panel === "builder" && (
        <div id="master-builder-panel" role="tabpanel">
          <MasterManagementTab />
        </div>
      )}
      {panel === "overview" && <OverviewNotice />}
    </>
  );
}
