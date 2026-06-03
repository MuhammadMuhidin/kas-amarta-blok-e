"use client";

import { useState } from "react";

export default function useAdminMemberActions({
  personal,
  setPersonal,
  loadPersonal,
  showPopup,
  submitMember,
  patchMember,
  normalize,
  currentPeriod,
}) {
  const [member, setMember] = useState({ house: "", name: "", join_date: "", trash: "" });
  const [memberFilter, setMemberFilter] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [loadingAdd, setLoadingAdd] = useState(false);

  function isNewActiveMember(person) {
    if (person.active !== "Y" || !person.join_date) return false;
    return String(person.join_date).slice(0, 7) > currentPeriod;
  }

  function toggleMemberFilter(type) {
    setMemberFilter((prev) => (prev === type ? "" : type));
  }

  function rowClassName(person, index) {
    if (person.active === "N") return "admin-row-inactive";
    if (isNewActiveMember(person)) return "admin-row-new-active";
    if (index % 2) return "admin-row-alt";
    return "";
  }

  async function addMember(e) {
    e.preventDefault();

    if (!member.house.trim() || !member.name.trim() || !member.trash.trim() || !member.join_date.trim()) {
      showPopup("Complete all member data first", "error");
      return;
    }

    setLoadingAdd(true);

    try {
      await submitMember(member);
      showPopup("Member added successfully", "success");
      setMember({ house: "", name: "", join_date: "", trash: "" });
      await loadPersonal();
    } catch (err) {
      showPopup(err.message || "Failed to add member", "error");
    } finally {
      setLoadingAdd(false);
    }
  }

  async function updateMemberInline(person, field, value) {
    const currentValue = normalize(person?.[field]);
    const nextValue = normalize(value).toUpperCase();

    if (!person?.id || !["trash", "active"].includes(field)) return;
    if (!nextValue || currentValue === nextValue) return;

    const previousPersonal = personal;
    setPersonal((prev) => prev.map((item) => (item.id === person.id ? { ...item, [field]: nextValue } : item)));

    try {
      await patchMember({ id: person.id, field, value: nextValue });
      showPopup("Member data updated successfully", "success");
      await loadPersonal();
    } catch (err) {
      setPersonal(previousPersonal);
      showPopup(err.message || "Failed to update member data", "error");
      throw err;
    }
  }

  return {
    member,
    setMember,
    memberFilter,
    memberSearch,
    setMemberSearch,
    loadingAdd,
    toggleMemberFilter,
    rowClassName,
    addMember,
    updateMemberInline,
  };
}