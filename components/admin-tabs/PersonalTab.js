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
  return (
    <div className="admin-card">
      <h3>Add Personal</h3>
      <form onSubmit={addMember} className="admin-form">
        <input
          className="admin-input"
          placeholder="House"
          value={member.house}
          onChange={(e) => setMember({ ...member, house: e.target.value })}
        />
        <input
          className="admin-input"
          placeholder="Name"
          value={member.name}
          onChange={(e) => setMember({ ...member, name: e.target.value })}
        />
        <select
          className="admin-input"
          value={member.trash}
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
          onChange={(e) => setMember({ ...member, join_date: e.target.value })}
        />
        <button className="admin-btn" disabled={loadingAdd}>
          {loadingAdd ? "Adding..." : "Add Member"}
        </button>
      </form>

      <h4>Member List</h4>
      <div className="admin-summary-cards">
        <div
          onClick={() => toggleMemberFilter("ACTIVE")}
          className={memberFilter === "ACTIVE" ? "admin-summary-card admin-summary-card-active" : "admin-summary-card"}
        >
          <div>Active</div>
          <b>{stats.active}</b>
        </div>
        <div
          onClick={() => toggleMemberFilter("INACTIVE")}
          className={memberFilter === "INACTIVE" ? "admin-summary-card admin-summary-card-active" : "admin-summary-card"}
        >
          <div>Inactive</div>
          <b>{stats.inactive}</b>
        </div>
        <div
          onClick={() => toggleMemberFilter("TRASH_ACTIVE")}
          className={memberFilter === "TRASH_ACTIVE" ? "admin-summary-card admin-summary-card-active" : "admin-summary-card"}
        >
          <div>Trash Active</div>
          <b>{stats.trashActive}</b>
        </div>
        <div
          onClick={() => toggleMemberFilter("TRASH_INACTIVE")}
          className={memberFilter === "TRASH_INACTIVE" ? "admin-summary-card admin-summary-card-active" : "admin-summary-card"}
        >
          <div>Trash Inactive</div>
          <b>{stats.trashInactive}</b>
        </div>
      </div>

      <input
        type="text"
        placeholder="Search name or house..."
        value={memberSearch}
        onChange={(e) => setMemberSearch(e.target.value)}
        className="admin-search-input"
      />

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th className="admin-th">ID</th>
              <th className="admin-th">House</th>
              <th className="admin-th">Name</th>
              <th className="admin-th">Trash</th>
              <th className="admin-th">Active</th>
              <th className="admin-th">Join Date</th>
            </tr>
          </thead>
          <tbody>
            {searchedPersonal.map((p, i) => (
              <tr key={p.id} className={rowClassName(p, i)}>
                <td className="admin-td">{p.id}</td>
                <td className="admin-td">{p.house}</td>
                <td className="admin-td">{p.name}</td>
                <td className="admin-td">{p.trash}</td>
                <td className="admin-td">{p.active}</td>
                <td className="admin-td">{p.join_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
