"use client";

import { useEffect, useState } from "react";

export default function useAdminTabs(refreshTabData, allowedTabs = ["overview"]) {
  const [tab, setTab] = useState(allowedTabs[0] || "overview");
  const [tabRefreshKey, setTabRefreshKey] = useState(0);

  function isAllowed(nextTab) {
    return allowedTabs.includes(nextTab);
  }

  function handleTabClick(nextTab) {
    if (!isAllowed(nextTab)) return;

    if (tab === nextTab) {
      setTabRefreshKey((prev) => prev + 1);
      refreshTabData(nextTab, { force: true });
      return;
    }

    setTab(nextTab);
  }

  function tabClassName(name) {
    return tab === name ? "admin-tab admin-tab-active" : "admin-tab";
  }

  useEffect(() => {
    if (allowedTabs.includes(tab)) return;
    setTab(allowedTabs[0] || "overview");
  }, [allowedTabs, tab]);

  return {
    tab,
    tabRefreshKey,
    handleTabClick,
    tabClassName,
  };
}
