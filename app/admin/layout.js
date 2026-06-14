import "./theme.css";
import "./ledger-theme.css";
import "./sidebar.css";
import "./master-version-diff.css";
import "./master-readonly-preview.css";
import "./master-management-english.css";
import AdminMobileDrawer from "@/components/admin/AdminMobileDrawer";
import AdminThemeBoot from "@/components/admin/AdminThemeBoot";
import AdminTopActions from "@/components/admin/AdminTopActions";
import ApprovalMasterLifecycleController from "@/components/admin/ApprovalMasterLifecycleController";

export default function AdminLayout({ children }) {
  return (
    <>
      <AdminThemeBoot />
      <AdminMobileDrawer />
      <AdminTopActions />
      <ApprovalMasterLifecycleController />
      {children}
    </>
  );
}
