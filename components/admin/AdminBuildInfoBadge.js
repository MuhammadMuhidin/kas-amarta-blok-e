"use client";

import { useEffect, useState } from "react";
import styles from "./AdminBuildInfoBadge.module.css";

function formatBuildTime(value) {
  if (!value || value === "unknown") return "unknown";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminBuildInfoBadge() {
  const [buildInfo, setBuildInfo] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadBuildInfo() {
      try {
        const res = await fetch("/api/build-info", {
          cache: "no-store",
        });

        const data = await res.json();

        if (active) {
          setBuildInfo(data?.build || null);
        }
      } catch {
        if (active) {
          setBuildInfo(null);
        }
      }
    }

    loadBuildInfo();

    return () => {
      active = false;
    };
  }, []);

  if (!buildInfo) return null;

  return (
    <div className={styles.badge} title={buildInfo.commitMessage || "Build info"}>
      <span>Build {buildInfo.commitShort || "unknown"}</span>
      <small>{formatBuildTime(buildInfo.buildTime)}</small>
    </div>
  );
}
