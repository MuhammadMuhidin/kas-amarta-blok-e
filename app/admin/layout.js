import "./theme.css";
import "./ledger-theme.css";
import "./sidebar.css";
import "./master-version-diff.css";
import "./master-readonly-preview.css";
import "./master-management-english.css";
import AdminDocumentReset from "@/components/admin/AdminDocumentReset";
import AdminMobileDrawer from "@/components/admin/AdminMobileDrawer";
import AdminThemeBoot from "@/components/admin/AdminThemeBoot";
import AdminTopActions from "@/components/admin/AdminTopActions";
import ApprovalMasterLifecycleControllerV2 from "@/components/admin/ApprovalMasterLifecycleControllerV2";
import { getCurrentAdminSession } from "@/lib/adminSession";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminLayout({ children }) {
  const session = await getCurrentAdminSession({
    cookies: cookies(),
    headers: headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return (
    <>
      <AdminDocumentReset />
      <AdminThemeBoot />
      <AdminMobileDrawer />
      <AdminTopActions />
      <ApprovalMasterLifecycleControllerV2 />
      {children}
    </>
  );
}
