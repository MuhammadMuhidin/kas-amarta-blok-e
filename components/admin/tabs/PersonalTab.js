"use client";

import LoadingButtonContent from "@/components/admin/LoadingButtonContent";
import PersonalFilters from "@/components/admin/PersonalFilters";
import PersonalTable from "@/components/admin/PersonalTable";
import useInfiniteRows from "@/components/admin/useInfiniteRows";
import { useState } from "react";

const pageSize = 10;

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
  rowClassName,
  onUpdateMember,
}) {
  const [showAddMember, setShowAddMember] = useState(false);

  const {
    items: personalRows,
    total,
    loading,
    loadingMore,
    error,
    hasMore,
    loaderRef,
    refresh,
  } = useInfiniteRows({
    pageSize,
    buildUrl: ({ page, limit }) => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));

      if (memberFilter) params.set("filter", memberFilter);
      if (memberSearch.trim()) params.set("search", memberSearch.trim());

      return `/api/sheets/personal?${params.toString()}`;
    },
    deps: [memberFilter, memberSearch],
    getItems: (data) => data.personal || [],
    getPagination: (data) => data.pagination || {},
  });

  async function handleAddMember(e) {
    await addMember(e);
    await refresh();
    setShowAddMember(false);
  }

  async function handleUpdateMember(person, field, value) {
    await onUpdateMember(person, field, value);
    await refresh();
  }

  return (
    <div className="admin-card">
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>Member List</h3>

        <button
          type="button"
          className="admin-small-btn"
          onClick={() => setShowAddMember((prev) => !prev)}
        >
          {showAddMember ? "▴" : "▾"} Add
        </button>
      </div>

      {showAddMember && (
        <form onSubmit={handleAddMember} className="admin-form">
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
            <LoadingButtonContent loading={loadingAdd} loadingText="Adding...">
              Add Member
            </LoadingButtonContent>
          </button>
        </form>
      )}

      <PersonalFilters
        memberFilter={memberFilter}
        toggleMemberFilter={toggleMemberFilter}
        stats={stats}
        memberSearch={memberSearch}
        setMemberSearch={setMemberSearch}
      />

      {error && <div className="admin-error-box">{error}</div>}

      <div style={styles.metaBar}>
        <span>{personalRows.length} / {total} loaded</span>
      </div>

      {loading ? (
        <p>Loading member...</p>
      ) : personalRows.length === 0 ? (
        <div className="admin-empty-state">Member tidak ditemukan.</div>
      ) : (
        <>
          <PersonalTable
            rows={personalRows}
            rowClassName={rowClassName}
            onUpdateMember={handleUpdateMember}
          />

          <div ref={loaderRef} style={styles.loaderSentinel}>
            {loadingMore
              ? "Loading more..."
              : hasMore
                ? "Scroll to load more"
                : "All members loaded"}
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },

  sectionTitle: {
    margin: 0,
  },

  metaBar: {
    margin: "12px 0 10px",
    color: "var(--admin-muted)",
    fontSize: 12,
    fontWeight: 700,
  },

  loaderSentinel: {
    padding: "14px 0 4px",
    color: "var(--admin-muted)",
    fontSize: 12,
    fontWeight: 700,
    textAlign: "center",
  },
};
