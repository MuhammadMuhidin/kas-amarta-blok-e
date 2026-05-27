"use client";

import { useState } from "react";

export default function useAdminTabs(refreshTabData) {
  const [tab, setTab] = useState("overview");
  const [tabRefreshKey, setTabRefreshKey] = useState(0);

  function handleTabClick(nextTab) {
    if (tab === nextTab) {
      setTabRefreshKey((prev) => prev + 1);
      refreshTabData(nextTab);
      return;
    }

    setTab(nextTab);
  }

  function tabClassName(name) {
    return tab === name ? "admin-tab admin-tab-active" : "admin-tab";
  }

  return {
    tab,
    tabRefreshKey,
    handleTabClick,
    tabClassName,
  };
}
