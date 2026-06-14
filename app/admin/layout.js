import "./theme.css";
import "./ledger-theme.css";
import "./sidebar.css";
import "./master-version-diff.css";
import "./master-management-actions.css";
import AdminMobileDrawer from "@/components/admin/AdminMobileDrawer";
import AdminThemeBoot from "@/components/admin/AdminThemeBoot";
import AdminTopActions from "@/components/admin/AdminTopActions";
import MasterManagementActionFix from "@/components/admin/MasterManagementActionFix";
import MasterVersionHistoryDiff from "@/components/admin/MasterVersionHistoryDiff";

export default function AdminLayout({ children }) {
  return (
    <>
      <AdminThemeBoot />
      <AdminMobileDrawer />
      <AdminTopActions />
      <MasterManagementActionFix />
      <MasterVersionHistoryDiff />
      {children}
    </>
  );
}
