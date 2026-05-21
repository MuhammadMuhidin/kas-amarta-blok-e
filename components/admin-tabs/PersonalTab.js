import LoadingButtonContent from "@/components/admin/LoadingButtonContent";
import PersonalFilters from "@/components/admin/PersonalFilters";
import PersonalTable from "@/components/admin/PersonalTable";

export default function PersonalTab({
  member,
  setMember,
  addMember,
  loadingAdd,
  memberFilter,
  toggleMemberFilter,
  stats,
  memberSearch,
  setMemberSearch,
  searchedPersonal,
  rowClassName,
}) {
  const personalFormIncomplete =
    !String(member.house || "").trim() ||
    !String(member.name || "").trim() ||
    !String(member.trash || "").trim() ||
    !String(member.join_date || "").trim();

  return (
    <div className="admin-card">
      <h3>Add Personal</h3>
      <form onSubmit={addMember} className="admin-form">
        <input
          className="admin-input"
          placeholder="House"
          value={member.house}
          required
          onChange={(e) => setMember({ ...member, house: e.target.value })}
        />
        <input
          className="admin-input"
          placeholder="Name"
          value={member.name}
          required
          onChange={(e) => setMember({ ...member, name: e.target.value })}
        />
        <select
          className="admin-input"
          value={member.trash}
          required
          onChange={(e) => setMember({ ...member, trash: e.target.value })}
        >
          <option value="">Join trash collection?</option>
          <option value="Y">Yes</option>
          <option value="N">No</option>
        </select>
        <input
          className="admin-input"
          type="date"
          value={member.join_date}
          required
          onChange={(e) => setMember({ ...member, join_date: e.target.value })}
        />
        <button className="admin-btn" disabled={loadingAdd || personalFormIncomplete}>
          <LoadingButtonContent loading={loadingAdd} loadingText="Adding...">
            Add Member
          </LoadingButtonContent>
        </button>
      </form>

      <h4>Member List</h4>
      <PersonalFilters
        memberFilter={memberFilter}
        toggleMemberFilter={toggleMemberFilter}
        stats={stats}
        memberSearch={memberSearch}
        setMemberSearch={setMemberSearch}
      />
      <PersonalTable rows={searchedPersonal} rowClassName={rowClassName} />
    </div>
  );
}
