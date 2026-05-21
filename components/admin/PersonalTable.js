import { useState } from "react";

const inlineSelectStyle = {
  background: "transparent",
  border: "none",
  boxShadow: "none",
  padding: "0 10px 0 0",
  minHeight: "auto",
  height: "auto",
  width: "42px",
  minWidth: "42px",
  color: "inherit",
  font: "inherit",
  cursor: "pointer",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  textAlign: "center",
};

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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <select
          className="admin-inline-select"
          style={inlineSelectStyle}
          value={person[field] || ""}
          disabled={saving}
          onChange={(e) => updateInline(person, field, e.target.value)}
        >
          <option value="Y">Y</option>
          <option value="N">N</option>
        </select>

        <span
          style={{
            fontSize: 11,
            opacity: 0.7,
            lineHeight: 1,
          }}
        >
          ˅
        </span>
      </div>
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
