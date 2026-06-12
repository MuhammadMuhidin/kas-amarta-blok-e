import "./theme.css";
import "./ledger-theme.css";
import "./sidebar.css";
import AdminMobileDrawer from "@/components/admin/AdminMobileDrawer";
import AdminThemeBoot from "@/components/admin/AdminThemeBoot";
import AdminBuildInfoBadge from "@/components/admin/AdminBuildInfoBadge";

export default function AdminLayout({ children }) {
  return (
    <>
      <AdminThemeBoot />
      <AdminMobileDrawer />
      <AdminBuildInfoBadge />
      <style
        dangerouslySetInnerHTML={{
          __html: `.admin-wrapper > .admin-header:first-child{display:none;}`,
        }}
      />
      {children}
    </>
  );
}
