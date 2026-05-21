import ConfirmModal from "@/components/ConfirmModal";
import { useState } from "react";

const inlineSelectStyle = {
  background: "transparent",
  border: "none",
  boxShadow: "none",
  padding: 0,
  minHeight: "auto",
  height: "auto",
  width: "100%",
  color: "inherit",
  font: "inherit",
  cursor: "pointer",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  textAlign: "center",
  textAlignLast: "center",
};

export default function PersonalTable({
  rows,
  rowClassName,
  onUpdateMember,
}) {
  const [savingKey, setSavingKey] = useState("");
  const [confirmState, setConfirmState] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  async function submitUpdate(person, field, value) {
    const key = `${person.id}-${field}`;

    setSavingKey(key);
    setConfirmLoading(true);

    try {
      await onUpdateMember(person, field, value);
    } finally {
      setSavingKey("");
      setConfirmLoading(false);
      setConfirmState(null);
    }
  }

  function askUpdate(person, field, value) {
    const currentValue = String(person[field] || "").trim();
    const nextValue = String(value || "").trim();

    if (!onUpdateMember || !nextValue || currentValue === nextValue) {
      return;
    }

    setConfirmState({
      person,
      field,
      value: nextValue,
    });
  }

  function renderEditableSelect(person, field) {
    const key = `${person.id}-${field}`;
    const saving = savingKey === key;

    return (
      <select
        className="admin-inline-select"
        style={inlineSelectStyle}
        value={
          confirmState?.person?.id === person.id &&
          confirmState?.field === field
            ? confirmState.value
            : person[field] || ""
        }
        disabled={saving || confirmLoading}
        onChange={(e) => askUpdate(person, field, e.target.value)}
      >
        <option value="Y">Y</option>
        <option value="N">N</option>
      </select>
    );
  }

  return (
    <>
      <ConfirmModal
        open={!!confirmState}
        title="Konfirmasi Perubahan"
        message={
          confirmState
            ? `Ubah ${confirmState.field} menjadi ${confirmState.value} untuk ${confirmState.person.name}?`
            : ""
        }
        confirmText="Lanjutkan"
        cancelText="Batal"
        loading={confirmLoading}
        onCancel={() => {
          if (confirmLoading) return;
          setConfirmState(null);
        }}
        onConfirm={() =>
          submitUpdate(
            confirmState.person,
            confirmState.field,
            confirmState.value,
          )
        }
        isDark
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
    </>
  );
}
