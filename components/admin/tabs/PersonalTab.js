"use client";

import AdminSubtabs from "@/components/admin/AdminSubtabs";
import LoadingButtonContent from "@/components/admin/LoadingButtonContent";
import PersonalFilters from "@/components/admin/PersonalFilters";
import PersonalTable from "@/components/admin/PersonalTable";
import useInfiniteRows from "@/components/admin/useInfiniteRows";
import { useState } from "react";

const pageSize = 10;

function AddMemberPanel({ member, setMember, addMember, loadingAdd, onAdded }) {
  async function handleAddMember(event) {
    await addMember(event);
    onAdded();
  }

  return (
    <div id="personal-add-panel" role="tabpanel" className="admin-card">
      <div style={styles.sectionHeader}>
        <div>
          <h3 style={styles.sectionTitle}>Add Member</h3>
          <p style={styles.description}>
            Register a resident, trash participation, and join date.
          </p>
        </div>
      </div>

      <form onSubmit={handleAddMember} className="admin-form">
        <input
          className="admin-input"
          placeholder="House"
          value={member.house}
          onChange={(event) => setMember({ ...member, house: event.target.value })}
        />
        <input
          className="admin-input"
          placeholder="Name"
          value={member.name}
          onChange={(event) => setMember({ ...member, name: event.target.value })}
        />
        <select
          className="admin-input"
          value={member.trash}
          onChange={(event) => setMember({ ...member, trash: event.target.value })}
        >
          <option value="">Join trash collection?</option>
          <option value="Y">Yes</option>
          <option value="N">No</option>
        </select>
        <input
          className="admin-input"
          type="date"
          value={member.join_date}
          onChange={(event) => setMember({ ...member, join_date: event.target.value })}
        />
        <button className="admin-btn" disabled={loadingAdd}>
          <LoadingButtonContent loading={loadingAdd} loadingText="Adding...">
            Add Member
          </LoadingButtonContent>
        </button>
      </form>
    </div>
  );
}

function MemberListPanel({
  memberFilter,
  toggleMemberFilter,
  stats,
  memberSearch,
  setMemberSearch,
  rowClassName,
  onUpdateMember,
  refreshVersion,
}) {
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
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (memberFilter) params.set("filter", memberFilter);
      if (memberSearch.trim()) params.set("search", memberSearch.trim());
      return `/api/sheets/personal?${params.toString()}`;
    },
    deps: [memberFilter, memberSearch, refreshVersion],
    getItems: (data) => data.personal || [],
    getPagination: (data) => data.pagination || {},
  });

  async function handleUpdateMember(person, field, value) {
    await onUpdateMember(person, field, value);
    await refresh();
  }

  return (
    <div id="personal-list-panel" role="tabpanel" className="admin-card">
      <div style={styles.sectionHeader}>
        <div>
          <h3 style={styles.sectionTitle}>Member List</h3>
          <p style={styles.description}>
            Search, filter, and edit resident records.
          </p>
        </div>
        <button
          type="button"
          className="admin-small-btn admin-refresh-btn"
          disabled={loading || loadingMore}
          onClick={refresh}
        >
          Refresh
        </button>
      </div>

      <PersonalFilters
        memberFilter={memberFilter}
        toggleMemberFilter={toggleMemberFilter}
        stats={stats}
        memberSearch={memberSearch}
        setMemberSearch={setMemberSearch}
      />

      {error && <div className="admin-error-box">{error}</div>}
      <div style={styles.metaBar}>{personalRows.length} / {total} loaded</div>

      {loading ? (
        <p>Loading member...</p>
      ) : personalRows.length === 0 ? (
        <div className="admin-empty-state">Member not found.</div>
      ) : (
        <>
          <PersonalTable
            rows={personalRows}
            rowClassName={rowClassName}
            onUpdateMember={handleUpdateMember}
          />
          <div
            ref={loaderRef}
            className={loadingMore
              ? "admin-loader-sentinel admin-loader-sentinel-loading"
              : "admin-loader-sentinel"}
            style={styles.loaderSentinel}
          >
            {loadingMore
              ? "Loading more"
              : hasMore
                ? "Scroll to load more"
                : "All members loaded"}
          </div>
        </>
      )}
    </div>
  );
}

export default function PersonalTab(props) {
  const [activePanel, setActivePanel] = useState("list");
  const [refreshVersion, setRefreshVersion] = useState(0);

  function handleAdded() {
    setRefreshVersion((value) => value + 1);
    setActivePanel("list");
  }

  return (
    <>
      <AdminSubtabs
        value={activePanel}
        onChange={setActivePanel}
        ariaLabel="Personal navigation"
        items={[
          {
            value: "list",
            label: "Member List",
            panelId: "personal-list-panel",
            badge: props.stats?.active || 0,
          },
          { value: "add", label: "Add Member", panelId: "personal-add-panel" },
        ]}
      />

      {activePanel === "list" && (
        <MemberListPanel
          {...props}
          refreshVersion={refreshVersion}
        />
      )}
      {activePanel === "add" && (
        <AddMemberPanel
          member={props.member}
          setMember={props.setMember}
          addMember={props.addMember}
          loadingAdd={props.loadingAdd}
          onAdded={handleAdded}
        />
      )}
    </>
  );
}

const styles = {
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  sectionTitle: { margin: 0 },
  description: {
    margin: "5px 0 0",
    color: "var(--admin-muted)",
    fontSize: 12,
    lineHeight: 1.45,
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
