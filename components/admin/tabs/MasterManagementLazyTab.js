"use client";

import AdminSubtabs from "@/components/admin/AdminSubtabs";
import MasterOverviewData from "@/components/admin/master/MasterOverviewData";
import MasterManagementTab from "@/components/admin/tabs/MasterManagementTab";
import { useState } from "react";

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
      {panel === "overview" && <MasterOverviewData />}
    </>
  );
}
