"use client";

import { usePathname } from "next/navigation";
import AdminTopActions from "@/components/admin/AdminTopActions";

export default function AdminConditionalTopActions() {
  const pathname = usePathname();

  // Hide on main admin dashboard — sidebar handles actions there
  if (pathname === "/admin") return null;

  return <AdminTopActions />;
}
