import { useState } from "react";

export default function PersonalTable({
  rows,
  rowClassName,
  onUpdateMember,
}) {
  const [savingKey, setSavingKey] = useState("");

  async function updateInline(person, field, value) {
    const currentValue = String(person[field] || "").trim();
    const nextValue = String(value || "").trim();

    if (!onUpdateMember || !nextValue || currentValue === nextValue) return;

    const key = `${person.id}-${field}`;
    setSavingKey(key);

    try {
      await onUpdateMember(person, field, nextValue);
    } finally {
      setSavingKey("");
    }
  }

  function renderEditableSelect(person, field) {
    const key = `${person.id}-${field}`;
    const saving = savingKey === key;

    return (
      <select
        className="admin-input admin-inline-select"
        value={person[field] || ""}
        disabled={saving}
        onChange={(e) => updateInline(person, field, e.target.value)}
      >
        <option value="Y">Y</option>
        <option value="N">N</option>
      </select>
    );
  }

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
              <td className="admin-td">{renderEditableSelect(person, "trash")}</td>
              <td className="admin-td">{renderEditableSelect(person, "active")}</td>
              <td className="admin-td">{person.join_date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
