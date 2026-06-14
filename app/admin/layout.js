import "./theme.css";
import "./ledger-theme.css";
import "./sidebar.css";
import AdminMobileDrawer from "@/components/admin/AdminMobileDrawer";
import AdminThemeBoot from "@/components/admin/AdminThemeBoot";
import AdminTopActions from "@/components/admin/AdminTopActions";
import MasterVersionHistoryDiff from "@/components/admin/MasterVersionHistoryDiff";

export default function AdminLayout({ children }) {
  return (
    <>
      <AdminThemeBoot />
      <AdminMobileDrawer />
      <AdminTopActions />
      <MasterVersionHistoryDiff />
      {children}
    </>
  );
}
