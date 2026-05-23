import "./theme.css";
import "./sidebar.css";
import AdminThemeBoot from "@/components/admin/AdminThemeBoot";

export default function AdminLayout({ children }) {
  return (
    <>
      <AdminThemeBoot />
      {children}
    </>
  );
}
