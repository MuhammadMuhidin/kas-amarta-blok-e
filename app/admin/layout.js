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

export default function AdminLayout({ children }) {
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
