export default function PersonalTable({
  rows,
  rowClassName,
}) {
  return (
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
          {rows.map((person, index) => (
            <tr key={person.id} className={rowClassName(person, index)}>
              <td className="admin-td">{person.id}</td>
              <td className="admin-td">{person.house}</td>
              <td className="admin-td">{person.name}</td>
              <td className="admin-td">{person.trash}</td>
              <td className="admin-td">{person.active}</td>
              <td className="admin-td">{person.join_date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
