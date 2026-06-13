"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAdminAccessRoleInitials, getAdminAccessRoleLabel } from "@/lib/adminRoles";

export default function AdminProfileLink({ compact = false }) {
  const [role, setRole] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/sessions/check", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active) setRole(data?.access_role || "");
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  if (!role) return null;

  return (
    <Link
      href="/admin/profile"
      className={compact ? "admin-profile-link admin-profile-link-compact" : "admin-profile-link"}
      aria-label={`Buka profile ${getAdminAccessRoleLabel(role)}`}
    >
      <span className="admin-profile-avatar">{getAdminAccessRoleInitials(role)}</span>
      {!compact && <span className="admin-profile-label">{getAdminAccessRoleLabel(role)}</span>}
    </Link>
  );
}
