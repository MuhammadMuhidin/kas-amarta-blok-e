"use client";

import AdminSubtabs from "@/components/admin/AdminSubtabs";
import Toast from "@/components/Toast";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";
import AdminDataSkeleton from "@/components/admin/AdminDataSkeleton";
import { readJson, sendJson } from "@/components/admin/adminClientApi";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API = "/api/admin/approval-requests";
const PAGE_SIZE = 10;
const FETCH_LIMIT = PAGE_SIZE * 2;
const DONE = ["completed", "rejected", "cancelled"];

function roleKey(value) {
  return String(value || "").trim().toLowerCase();
}

function date(value) {
  const parsed = new Date(value);
  return value && !Number.isNaN(parsed.getTime())
    ? parsed.toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";
}

function rupiah(value) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
}

function fileSize(value) {
  const bytes = Number(value || 0);
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function done(value) {
  return DONE.includes(roleKey(value));
}

function actionable(row, role = "admin") {
  const current = roleKey(row?.current_approver_role);
  const access = roleKey(role) || "admin";
  return Boolean(row && !done(row.status) && current && (access === "admin" || current === access));
}

function meta(status) {
  const value = roleKey(status);
  if (value === "completed") return ["Full Approved", "ac-ok"];
  if (value === "rejected") return ["Rejected", "ac-bad"];
  if (value === "cancelled") return ["Cancelled", "ac-bad"];
  if (value === "waiting_payment_validation" || value === "waiting_approval") {
    return ["In Progress", "ac-progress"];
  }
  return [value || "-", "ac-muted-status"];
}

function actionLabel(action) {
  const value = roleKey(action?.action);
  if (value === "reject") return "Rejected";
  if (value === "validate_payment") return "Validated";
  if (["approve", "final_approval", "validate_document", "confirm_execution"].includes(value)) {
    return "Approved";
  }
  if (value === "submit") return "Submitted";
  return value || "Action";
}

function waitingLabel(row) {
  return roleKey(row?.status) === "waiting_payment_validation"
    ? "Waiting for Validation"
    : "Waiting Approval";
}

function waitingClass(row) {
  return roleKey(row?.status) === "waiting_payment_validation"
    ? "ac-step-wait"
    : "ac-step-approval-wait";
}

function mergeRows(oldRows = [], newRows = []) {
  const map = new Map();
  [...oldRows, ...newRows].forEach((row) => {
    if (row?.id) map.set(row.id, row);
  });
  return [...map.values()];
}

function Status({ status }) {
  const [label, className] = meta(status);
  return <span className={`ac-status ${className}`}>{label}</span>;
}

function Field({ label, value, muted }) {
  return (
    <div className="ac-field">
      <span className="ac-label">{label}</span>
      <span className="ac-value">{value || "-"}</span>
      {muted ? <span className="ac-muted">{muted}</span> : null}
    </div>
  );
}

function Steps({ row }) {
  const actions = (row.approval_actions || []).filter(
    (action) => !["submit", "reject"].includes(roleKey(action.action)),
  );
  const approved = [...new Map(
    actions.map((action) => [`${action.step}-${action.role}`, action]),
  ).values()];

  return (
    <div className="ac-steps">
      {approved.map((action) => (
        <div key={action.id || `${action.step}-${action.role}`} className="ac-step ac-step-ok">
          <small>{action.role}</small>
          <span>Approved</span>
        </div>
      ))}
      {row.current_approver_role && !done(row.status) ? (
        <div className={`ac-step ${waitingClass(row)}`}>
          <small>{row.current_approver_role}</small>
          <span>{waitingLabel(row)}</span>
        </div>
      ) : null}
    </div>
  );
}

function Notes({ row }) {
  const notes = (row.approval_actions || []).filter(
    (action) => String(action.note || "").trim(),
  );
  if (!notes.length) return null;

  return (
    <div className="ac-notes">
      <span className="ac-label">Approval Notes</span>
      {notes.map((action) => (
        <div key={action.id || `${action.role}-${action.created_at}`} className="ac-note-row">
          <small>
            {action.role || "-"} · {actionLabel(action)} · {date(action.created_at)}
          </small>
          <div className="ac-note-text">{action.note}</div>
        </div>
      ))}
    </div>
  );
}

function submissionLabel(row, key) {
  return (row.fields_schema_snapshot || []).find((field) => field.key === key)?.label
    || key.replace(/_/g, " ");
}

function AttachmentValue({ value }) {
  const isImage = String(value.type || "").startsWith("image/");
  return (
    <div className="ac-attachment">
      {isImage && value.signed_url ? (
        <img
          src={value.signed_url}
          alt={value.original_name || value.name || "Lampiran"}
          loading="lazy"
        />
      ) : (
        <span className="ac-file-icon">{isImage ? "🖼️" : "📎"}</span>
      )}
      <div>
        <strong>{value.original_name || value.name || "Lampiran"}</strong>
        <small>{[value.type, fileSize(value.size)].filter(Boolean).join(" · ")}</small>
        {value.preview_error ? <em>Preview tidak tersedia</em> : null}
      </div>
      {value.signed_url ? (
        <a href={value.signed_url} target="_blank" rel="noreferrer">Buka</a>
      ) : null}
    </div>
  );
}

function displayValue(value) {
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (Array.isArray(value)) return value.join(", ");
  if (value == null || value === "") return "-";
  return String(value);
}

function SubmissionFields({ row }) {
  const entries = Object.entries(row.form_data || {});
  if (!entries.length) return null;

  return (
    <details className="ac-submission">
      <summary>Detail Form · Master v{row.master_revision || 1}</summary>
      <div className="ac-submission-grid">
        {entries.map(([key, value]) => (
          <div className="ac-submission-field" key={key}>
            <span className="ac-label">{submissionLabel(row, key)}</span>
            {value && typeof value === "object" && value.kind === "attachment" ? (
              <AttachmentValue value={value} />
            ) : (
              <div className="ac-submission-value">{displayValue(value)}</div>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}

function Cards({ rows, inboxIds, runningId, onAction }) {
  if (!rows.length) {
    return (
      <div className="admin-empty-state" style={{ padding: "14px 12px" }}>
        No approval requests found.
      </div>
    );
  }

  return (
    <div className="ac-list">
      {rows.map((row) => {
        const action = row.status === "waiting_payment_validation"
          ? "validate_payment"
          : "approve";
        const label = row.status === "waiting_payment_validation" ? "Validate" : "Approve";
        const canAct = inboxIds.has(row.id);

        return (
          <article className="ac-card" key={row.id}>
            <div className="ac-head">
              <div>
                <div className="ac-no">{row.request_no}</div>
                <div className="ac-type">{row.master_name || "-"}</div>
              </div>
              <Status status={row.status} />
            </div>
            <Steps row={row} />
            <Notes row={row} />
            <div className="ac-grid">
              <Field label="Requester" value={row.requester_name} muted={row.requester_house} />
              <Field label="Current Approver" value={row.current_approver_role || "-"} />
              <Field label="Amount" value={row.amount ? rupiah(row.amount) : "-"} />
              <Field label="Submitted At" value={date(row.created_at)} />
            </div>
            <SubmissionFields row={row} />
            {canAct ? (
              <div className="ac-actions">
                <button
                  className="admin-small-btn"
                  disabled={Boolean(runningId)}
                  onClick={() => onAction(row, action)}
                >
                  {runningId === `${row.id}-${action}` ? "Processing..." : label}
                </button>
                <button
                  className="admin-small-btn ac-reject"
                  disabled={Boolean(runningId)}
                  onClick={() => onAction(row, "reject")}
                >
                  {runningId === `${row.id}-reject` ? "Processing..." : "Reject"}
                </button>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function ApprovalRequestsPanel({ filter, onSummary, showToast }) {
  const [data, setData] = useState({
    summary: {},
    inbox: [],
    requests: [],
    pagination: {
      offset: 0,
      limit: FETCH_LIMIT,
      next_offset: 0,
      total: 0,
      has_more: false,
    },
  });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [runningId, setRunningId] = useState("");
  const [pending, setPending] = useState(null);
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const loader = useRef(null);

  const accessRole = roleKey(data.access_role) || "admin";
  const all = useMemo(() => {
    const map = new Map();
    [...(data.inbox || []), ...(data.requests || [])].forEach((row) => {
      if (row?.id) map.set(row.id, row);
    });
    return [...map.values()];
  }, [data]);
  const safeInbox = useMemo(
    () => all.filter((row) => actionable(row, accessRole)),
    [all, accessRole],
  );
  const inboxIds = useMemo(
    () => new Set(safeInbox.map((row) => row.id)),
    [safeInbox],
  );
  const shown = all.slice(0, limit);
  const localMore = limit < all.length;
  const serverMore = Boolean(data.pagination?.has_more);
  const more = localMore || serverMore;
  const initialLoading = loading && !all.length;

  const pageUrl = useCallback((offset = 0) => {
    const params = new URLSearchParams({
      offset: String(offset),
      limit: String(FETCH_LIMIT),
      filter,
      search: debouncedSearch,
    });
    return `${API}?${params.toString()}`;
  }, [filter, debouncedSearch]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const payload = await readJson(pageUrl(0));
      setData(payload);
      setLimit(PAGE_SIZE);
      onSummary(payload.summary || {});
    } catch (error) {
      showToast(error.message || "Failed to load Approval Center", "error");
    } finally {
      setLoading(false);
    }
  }, [pageUrl, onSummary, showToast]);

  async function loadMore() {
    if (loadingMore || !serverMore) return;
    try {
      setLoadingMore(true);
      const payload = await readJson(pageUrl(data.pagination?.next_offset || all.length));
      setData((previous) => ({
        ...payload,
        requests: mergeRows(previous.requests, payload.requests),
        inbox: mergeRows(previous.inbox, payload.inbox),
        summary: payload.summary || previous.summary,
        pagination: payload.pagination || previous.pagination,
      }));
      onSummary(payload.summary || data.summary || {});
    } catch (error) {
      showToast(error.message || "Failed to load more approval requests", "error");
    } finally {
      setLoadingMore(false);
    }
  }

  function open(row, action) {
    setPending({ row, action });
    setNote("");
  }

  function close() {
    if (runningId) return;
    setPending(null);
    setNote("");
  }

  async function confirm() {
    if (!pending) return;
    const { row, action } = pending;
    const cleanedNote = note.trim();
    if (action === "reject" && !cleanedNote) {
      showToast("Rejection note is required", "error");
      return;
    }

    try {
      setRunningId(`${row.id}-${action}`);
      await sendJson(API, "PATCH", { id: row.id, action, note: cleanedNote });
      showToast(action === "reject" ? "Request rejected" : "Request processed");
      setPending(null);
      setNote("");
      await load();
    } catch (error) {
      showToast(error.message || "Failed to process approval request", "error");
      if (error.status === 409) await load();
    } finally {
      setRunningId("");
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [debouncedSearch]);

  useEffect(() => {
    const node = loader.current;
    if (!node || !more || initialLoading) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      if (localMore) setLimit((value) => Math.min(value + PAGE_SIZE, all.length));
      else loadMore();
    }, { rootMargin: "120px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [more, localMore, all.length, serverMore, loadingMore, data.pagination?.next_offset, initialLoading]);

  const reject = pending?.action === "reject";
  const row = pending?.row;

  return (
    <div role="tabpanel" id={`approval-${filter}-panel`}>
      <AdminConfirmModal
        open={Boolean(pending)}
        title={reject ? "Reject Request" : "Confirm Approval"}
        description={row ? `${row.request_no} - ${row.master_name || "Approval Request"}` : ""}
        confirmText={reject ? "Reject" : "Process"}
        cancelText="Cancel"
        loading={Boolean(runningId)}
        loadingText="Processing..."
        onCancel={close}
        onConfirm={confirm}
      >
        <div>
          <div><strong>Status</strong><p>{row ? meta(row.status)[0] : "-"}</p></div>
          <div>
            <strong>Requester</strong>
            <p>{row?.requester_name || "-"} · {row?.requester_house || "-"}</p>
          </div>
          <div>
            <strong>{reject ? "Rejection Note" : "Approval Note"}</strong>
            <textarea
              className="ac-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={reject ? "Required rejection reason" : "Optional"}
            />
          </div>
        </div>
      </AdminConfirmModal>

      <div className="ac-toolbar">
        <input
          className="admin-search-input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search request no, type, requester, house, approver, note..."
        />
      </div>
      <section className="admin-status-card ac-section" style={{ margin: 0 }}>
        {initialLoading ? (
          <AdminDataSkeleton showSummary={false} rows={5} />
        ) : (
          <Cards
            rows={shown}
            inboxIds={inboxIds}
            runningId={runningId}
            onAction={open}
          />
        )}
        <div ref={loader} className="ac-loader">
          {initialLoading ? "" : loadingMore ? "Loading more..." : more ? "Scroll to load more" : ""}
        </div>
      </section>
    </div>
  );
}

export default function ApprovalCenterTab() {
  const [activePanel, setActivePanel] = useState("inbox");
  const [summary, setSummary] = useState({
    inbox: 0,
    processing: 0,
    completed: 0,
    rejected: 0,
  });
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const handleSummary = useCallback((nextSummary) => {
    setSummary((current) => ({ ...current, ...(nextSummary || {}) }));
  }, []);

  return (
    <>
      <Toast show={Boolean(toast)} type={toast?.type} message={toast?.message} />
      <style jsx global>{CSS}</style>
      <div className="admin-card" style={{ height: "auto", overflow: "visible" }}>
        <div className="activity-header" style={{ marginBottom: 14 }}>
          <div>
            <div className="activity-kicker">Approval Workflow</div>
            <h3 className="activity-title ac-title">Approval Center</h3>
            <p className="activity-subtitle">
              Only the active approval status is mounted and loaded.
            </p>
          </div>
        </div>

        <AdminSubtabs
          value={activePanel}
          onChange={setActivePanel}
          ariaLabel="Approval navigation"
          items={[
            {
              value: "inbox",
              label: "Need Action",
              badge: summary.inbox,
              panelId: "approval-inbox-panel",
            },
            {
              value: "processing",
              label: "In Progress",
              badge: summary.processing,
              panelId: "approval-processing-panel",
            },
            {
              value: "completed",
              label: "Approved",
              badge: summary.completed,
              panelId: "approval-completed-panel",
            },
            {
              value: "rejected",
              label: "Rejected",
              badge: summary.rejected,
              panelId: "approval-rejected-panel",
            },
          ]}
        />

        <ApprovalRequestsPanel
          key={activePanel}
          filter={activePanel}
          onSummary={handleSummary}
          showToast={showToast}
        />
      </div>
    </>
  );
}

const CSS = `
.ac-toolbar{display:grid;gap:10px;margin:14px 0}.ac-list{display:grid;gap:12px}.ac-card{display:grid;gap:12px;padding:12px;border:1px solid var(--admin-border);border-radius:16px;background:var(--admin-card)}.ac-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:nowrap}.ac-head>div{min-width:0}.ac-no{font-size:16px;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ac-type{margin-top:4px;color:var(--admin-muted);font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ac-status{flex:0 0 auto;max-width:48%;font-size:13px;font-weight:900;line-height:1.2;text-align:right;white-space:nowrap}.ac-ok{color:#15803d}.ac-progress{color:#2563eb}.ac-wait{color:#ca8a04}.ac-bad{color:#991b1b}.ac-muted-status{color:var(--admin-muted)}.ac-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.ac-field{padding:9px 10px;border:1px solid var(--admin-border);border-radius:12px;background:var(--admin-row);min-width:0}.ac-label{display:block;margin-bottom:4px;color:var(--admin-muted);font-size:10px;font-weight:900;letter-spacing:.06em;text-transform:uppercase}.ac-value{display:block;font-size:13px;font-weight:800;line-height:1.3;overflow-wrap:anywhere}.ac-muted{display:block;margin-top:3px;color:var(--admin-muted);font-size:12px;font-weight:700}.ac-steps{display:flex;gap:10px;flex-wrap:wrap}.ac-step{font-size:12px;font-weight:900}.ac-step small{display:block;color:var(--admin-muted);font-size:10px;font-weight:900;text-transform:uppercase}.ac-step-ok{color:#15803d}.ac-step-wait,.ac-step-approval-wait{color:#ca8a04}.ac-notes{display:grid;gap:7px;padding:10px;border:1px dashed var(--admin-border);border-radius:12px;background:var(--admin-row)}.ac-note-row{font-size:12px;line-height:1.35}.ac-note-row small{display:block;color:var(--admin-muted);font-size:10px;font-weight:900;text-transform:uppercase}.ac-note-text{margin-top:2px;font-weight:700;overflow-wrap:anywhere}.ac-actions{display:flex;gap:8px;flex-wrap:wrap}.ac-actions .admin-small-btn{flex:1 1 120px;min-height:42px;border-radius:12px}.ac-reject{background:#fee2e2!important;color:#991b1b!important;border:1px solid #fca5a5!important}.ac-note{width:100%;min-height:86px;box-sizing:border-box;padding:12px;border:1px solid var(--admin-border);border-radius:12px;background:var(--admin-input);color:var(--admin-text);font:inherit}.ac-loader{color:var(--admin-muted);font-size:12px;font-weight:800;text-align:center;padding:14px 0 4px}.ac-submission{border:1px solid var(--admin-border);border-radius:12px;background:var(--admin-row);overflow:hidden}.ac-submission summary{padding:10px 12px;cursor:pointer;font-size:12px;font-weight:900}.ac-submission-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:0 10px 10px}.ac-submission-field{min-width:0;padding:9px 10px;border:1px solid var(--admin-border);border-radius:10px;background:var(--admin-card)}.ac-submission-value{font-size:13px;font-weight:800;white-space:pre-wrap;overflow-wrap:anywhere}.ac-attachment{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:9px;align-items:center}.ac-attachment img{width:54px;height:54px;border-radius:9px;object-fit:cover;border:1px solid var(--admin-border)}.ac-file-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:9px;background:var(--admin-row);font-size:20px}.ac-attachment strong,.ac-attachment small,.ac-attachment em{display:block;overflow-wrap:anywhere}.ac-attachment small{margin-top:3px;color:var(--admin-muted);font-size:10px}.ac-attachment em{margin-top:3px;color:#991b1b;font-size:10px}.ac-attachment a{padding:7px 9px;border:1px solid var(--admin-border);border-radius:9px;color:var(--admin-text);font-size:11px;font-weight:900;text-decoration:none}
@media(max-width:640px){.ac-title{font-size:28px!important}.ac-section{padding:14px!important;border-radius:16px!important}.ac-status{text-align:right;font-size:12px}.ac-no{font-size:15px}.ac-submission-grid{grid-template-columns:1fr}.ac-attachment{grid-template-columns:auto minmax(0,1fr)}.ac-attachment a{grid-column:1/-1;text-align:center}}
`;
