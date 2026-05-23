import "./theme.css";
import "./sidebar.css";
import AdminMobileDrawer from "@/components/admin/AdminMobileDrawer";
import AdminThemeBoot from "@/components/admin/AdminThemeBoot";

export default function AdminLayout({ children }) {
  return (
    <>
      <AdminThemeBoot />
      <AdminMobileDrawer />
      {children}
    </>
  );
}
