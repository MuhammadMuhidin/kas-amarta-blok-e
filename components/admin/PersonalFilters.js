import StatsCard from "@/components/admin/StatsCard";

export default function PersonalFilters({
  memberFilter,
  toggleMemberFilter,
  stats,
  memberSearch,
  setMemberSearch,
}) {
  return (
    <>
      <div className="admin-summary-cards">
        <StatsCard
          label="Active"
          value={stats.active}
          active={memberFilter === "ACTIVE"}
          onClick={() => toggleMemberFilter("ACTIVE")}
        />

        <StatsCard
          label="Inactive"
          value={stats.inactive}
          active={memberFilter === "INACTIVE"}
          onClick={() => toggleMemberFilter("INACTIVE")}
        />

        <StatsCard
          label="Trash Active"
          value={stats.trashActive}
          active={memberFilter === "TRASH_ACTIVE"}
          onClick={() => toggleMemberFilter("TRASH_ACTIVE")}
        />

        <StatsCard
          label="Non Trash"
          value={stats.trashInactive}
          active={memberFilter === "TRASH_INACTIVE"}
          onClick={() => toggleMemberFilter("TRASH_INACTIVE")}
        />
      </div>

      <input
        className="admin-input"
        placeholder="Search house or name"
        value={memberSearch}
        onChange={(e) => setMemberSearch(e.target.value)}
      />
    </>
  );
}
