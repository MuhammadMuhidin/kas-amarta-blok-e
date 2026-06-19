"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAdminAccessRoleInitials, getAdminAccessRoleLabel } from "@/lib/adminRoles";

export default function AdminProfileLink({ compact = false }) {
  const [role, setRole] = useState(null);

  useEffect(() => {
    let active = true;
    let controller = null;

    async function loadRole() {
      controller?.abort();
      const requestController = new AbortController();
      controller = requestController;
      if (active) setRole(null);

      try {
        const res = await fetch(`/api/admin/sessions/check?_=${Date.now()}`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: requestController.signal,
        });
        const data = res.ok ? await res.json() : null;
        if (active && controller === requestController) setRole(data?.access_role || null);
      } catch (error) {
        if (error.name !== "AbortError" && active && controller === requestController) setRole(null);
      }
    }

    const pageShow = () => loadRole();
    const visibility = () => document.visibilityState === "visible" && loadRole();
    loadRole();
    window.addEventListener("pageshow", pageShow);
    document.addEventListener("visibilitychange", visibility);

    return () => {
      active = false;
      controller?.abort();
      window.removeEventListener("pageshow", pageShow);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  const label = role ? getAdminAccessRoleLabel(role) : "Administrator";
  const initials = role ? getAdminAccessRoleInitials(role) : "AD";

  return (
    <Link
      href="/admin/profile"
      className={compact ? "admin-profile-link admin-profile-link-compact" : "admin-profile-link"}
      aria-label={`Buka profile ${label}`}
    >
      <span className="admin-profile-avatar">{initials}</span>
      {!compact && <span className="admin-profile-label">{label}</span>}
    </Link>
  );
}
