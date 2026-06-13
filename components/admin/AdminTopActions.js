import AdminBuildInfoBadge from "@/components/admin/AdminBuildInfoBadge";
import AdminProfileLink from "@/components/admin/AdminProfileLink";

export default function AdminTopActions() {
  return (
    <div className="admin-desktop-actions">
      <AdminBuildInfoBadge />
      <AdminProfileLink />
    </div>
  );
}
