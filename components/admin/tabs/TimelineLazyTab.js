"use client";

import AdminSubtabs from "@/components/admin/AdminSubtabs";
import AdminDataSkeleton from "@/components/admin/AdminDataSkeleton";
import TimelineTab from "@/components/admin/tabs/TimelineTab";
import { readJson } from "@/components/admin/adminClientApi";
import { useEffect, useMemo, useRef, useState } from "react";

function PublishedOverviewPanel() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const requestRef = useRef(null);

  useEffect(() => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");

    readJson("/api/admin/timeline/posts", { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted || requestRef.current !== controller) return;
        setPosts(Array.isArray(data?.posts) ? data.posts : []);
      })
      .catch((loadError) => {
        if (loadError?.name === "AbortError" || controller.signal.aborted) return;
        if (requestRef.current !== controller) return;
        setPosts([]);
        setError(loadError.message || "Failed to load timeline overview");
      })
      .finally(() => {
        if (!controller.signal.aborted && requestRef.current === controller) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [version]);

  const summary = useMemo(() => {
    const published = posts.filter((post) => post.published);
    const drafts = posts.filter((post) => !post.published);
    const reactions = posts.reduce(
      (sum, post) => sum + Number(post.reaction_total ?? post.like_count ?? 0),
      0,
    );
    return { published, drafts, reactions };
  }, [posts]);

  return (
    <div id="timeline-published-panel" role="tabpanel" className="admin-card">
      <div style={styles.header}>
        <div>
          <h3 style={{ margin: 0 }}>Published Timeline Overview</h3>
          <p style={styles.muted}>Read-only overview loaded only while this subtab is active.</p>
        </div>
        <button
          type="button"
          className="admin-small-btn admin-refresh-btn"
          disabled={loading}
          onClick={() => setVersion((value) => value + 1)}
        >
          Refresh
        </button>
      </div>

      {error && <div className="admin-error-box">{error}</div>}
      {loading ? (
        <AdminDataSkeleton cards={3} rows={4} />
      ) : (
        <>
          <div className="admin-summary-cards" style={{ marginBottom: 16 }}>
            <div className="admin-summary-card"><strong>{summary.published.length}</strong><span>Published</span></div>
            <div className="admin-summary-card"><strong>{summary.drafts.length}</strong><span>Draft</span></div>
            <div className="admin-summary-card"><strong>{summary.reactions.toLocaleString("id-ID")}</strong><span>Reactions</span></div>
          </div>
          <div style={styles.list}>
            {summary.published.slice(0, 20).map((post) => (
              <article key={post.id} style={styles.item}>
                <div>
                  <strong>{post.title || "Untitled"}</strong>
                  <div style={styles.muted}>
                    {post.category || "Uncategorized"} · {post.images?.length || 0} photo
                  </div>
                </div>
                <span style={styles.badge}>Published</span>
              </article>
            ))}
            {!summary.published.length && (
              <div className="admin-empty-state">No published timeline post.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function TimelineLazyTab({ showPopup }) {
  const [activePanel, setActivePanel] = useState("management");

  return (
    <>
      <AdminSubtabs
        value={activePanel}
        onChange={setActivePanel}
        ariaLabel="Timeline section navigation"
        items={[
          { value: "management", label: "Post Management", panelId: "timeline-management-panel" },
          { value: "published", label: "Published Overview", panelId: "timeline-published-panel" },
        ]}
      />
      {activePanel === "management" && (
        <div id="timeline-management-panel" role="tabpanel">
          <TimelineTab showPopup={showPopup} />
        </div>
      )}
      {activePanel === "published" && <PublishedOverviewPanel />}
    </>
  );
}

const styles = {
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 14,
  },
  muted: {
    margin: "4px 0 0",
    color: "var(--admin-muted)",
    fontSize: 12,
    lineHeight: 1.5,
  },
  list: { display: "grid", gap: 9 },
  item: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 12,
    border: "1px solid var(--admin-border)",
    borderRadius: 12,
    background: "var(--admin-row)",
  },
  badge: {
    padding: "5px 9px",
    borderRadius: 999,
    background: "#dcfce7",
    color: "#166534",
    fontSize: 11,
    fontWeight: 900,
  },
};
