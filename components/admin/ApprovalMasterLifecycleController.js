"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Toast from "@/components/Toast";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";
import { ADMIN_DATA_MUTATED_EVENT, readJson, sendJson } from "@/components/admin/adminClientApi";

const API = "/api/admin/approval-masters";
const REACTIVATE_API = `${API}/reactivate`;
const clean = (value) => String(value || "").trim();

function lifecycle(card) {
  if (card.querySelector(".mm-status-archived")) return "archived";
  if (card.querySelector(".mm-status-active")) return "active";
  return "draft";
}

function snapshot(card) {
  const summary = clean(card.querySelector(".mm-master-main p")?.textContent);
  return {
    name: clean(card.querySelector(".mm-master-title-row h4")?.textContent),
    lifecycle: lifecycle(card),
    revision: Number(summary.match(/active\s+version\s+(\d+)/i)?.[1] || 0),
    category: clean(summary.split("·")[0]),
    fields: Number(summary.match(/(\d+)\s+fields/i)?.[1] || 0),
    steps: Number(summary.match(/(\d+)\s+steps/i)?.[1] || 0),
  };
}

function score(master, current) {
  let value = clean(master.name) === current.name ? 100 : 0;
  if (clean(master.lifecycle_status) === current.lifecycle) value += 20;
  if (Number(master.published_revision || 0) === current.revision) value += 15;
  if (clean(master.category) === current.category) value += 8;
  if ((master.fields_schema || []).length === current.fields) value += 5;
  if ((master.flow_schema || []).length === current.steps) value += 5;
  return value;
}

function resolveMaster(card, masters) {
  const id = clean(card.dataset.approvalMasterId);
  const byId = id && masters.find((master) => master.id === id);
  if (byId) return byId;

  const current = snapshot(card);
  return masters
    .map((master) => ({ master, score: score(master, current) }))
    .filter((item) => item.score >= 100)
    .sort((left, right) => right.score - left.score)[0]?.master || null;
}

function button(actions, labels) {
  const accepted = new Set(labels);
  return [...actions.querySelectorAll("button")]
    .find((item) => accepted.has(clean(item.textContent))) || null;
}

function updateButton(target, { hidden, text, title }) {
  if (!target) return;
  if (typeof hidden === "boolean") target.hidden = hidden;
  if (text && clean(target.textContent) !== text) target.textContent = text;
  if (title) target.title = title;
}

function configureCard(card, source) {
  const actions = card.querySelector(".mm-master-actions");
  if (!actions) return [];

  const status = lifecycle(card);
  const badges = [...card.querySelectorAll(".mm-master-title-row .mm-status")];
  const draftBadge = badges.find((item) => /draft\s+v\d+\s+available/i.test(clean(item.textContent)));
  const summary = clean(card.querySelector(".mm-master-main p")?.textContent);
  const published = Number(summary.match(/active\s+version\s+(\d+)/i)?.[1] || source.published_revision || 0);
  const draft = Number(clean(draftBadge?.textContent).match(/draft\s+v(\d+)/i)?.[1] || 0);
  const hasPublished = published > 0;
  const hasDraft = Boolean(draftBadge);
  const initialDraft = status === "draft" && !hasPublished;

  const master = { ...source, lifecycle_status: status, published_revision: published, draft_revision: draft, has_draft: hasDraft };
  card.dataset.approvalMasterId = master.id;

  updateButton(button(actions, ["Edit", "Edit Draft", "Create New Draft"]), {
    hidden: false,
    text: initialDraft || hasDraft ? "Edit Draft" : "Create New Draft",
    title: initialDraft || hasDraft ? `Edit Draft Version ${draft || 1}` : `Create Draft Version ${published + 1}`,
  });
  updateButton(button(actions, ["Duplicate", "Duplicate as New Request"]), {
    hidden: initialDraft,
    text: "Duplicate as New Request",
    title: "Create a separate request type from this template",
  });
  updateButton(button(actions, ["Preview Draft"]), { hidden: !hasDraft && !initialDraft });
  updateButton(button(actions, ["View Active Version"]), { hidden: status !== "active" || !hasPublished });
  updateButton(button(actions, ["Discard Draft"]), { hidden: !hasDraft || !hasPublished });
  updateButton(button(actions, ["Archive"]), { hidden: status !== "active" || !hasPublished });

  const extra = [];
  if (status === "archived" && hasPublished) extra.push({ action: "reactivate", master, target: actions });
  if (initialDraft) extra.push({ action: "delete", master, target: actions });
  return extra;
}

function configureEditor(master) {
  const editor = document.querySelector(".mm-editor");
  if (!editor) return;
  const publish = [...(editor.querySelectorAll(".mm-publication-actions button") || [])]
    .find((item) => clean(item.textContent).startsWith("Publish"));
  const archive = button(editor.querySelector(".mm-publication-actions"), ["Archive"]);
  if (!master) {
    updateButton(publish, { text: "Publish First Version" });
    updateButton(archive, { hidden: true });
    return;
  }
  const published = Number(master.published_revision || 0);
  const draft = Number(master.draft_revision || 0);
  updateButton(publish, { text: published ? `Publish Draft as Version ${draft || published + 1}` : "Publish First Version" });
  updateButton(archive, { hidden: master.lifecycle_status !== "active" || !published });
}

function refreshActiveTab() {
  document.querySelector(".admin-tab.admin-tab-active")?.click();
}

export default function ApprovalMasterLifecycleController() {
  const [masters, setMasters] = useState([]);
  const [targets, setTargets] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const requestId = useRef(0);
  const timer = useRef(0);

  async function load() {
    const id = ++requestId.current;
    const data = await readJson(`${API}?_=${Date.now()}`);
    if (id === requestId.current) setMasters(Array.isArray(data?.masters) ? data.masters : []);
  }

  function schedule(delay = 20) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => load().catch(() => {}), delay);
  }

  useEffect(() => {
    load().catch(() => {});
    const mutation = (event) => clean(event.detail?.path).startsWith(API) && schedule();
    const visible = () => document.visibilityState === "visible" && schedule(0);
    window.addEventListener(ADMIN_DATA_MUTATED_EVENT, mutation);
    window.addEventListener("pageshow", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      requestId.current += 1;
      clearTimeout(timer.current);
      window.removeEventListener(ADMIN_DATA_MUTATED_EVENT, mutation);
      window.removeEventListener("pageshow", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);

  useEffect(() => {
    const click = (event) => {
      const card = event.target.closest?.(".mm-master-card");
      if (card?.dataset.approvalMasterId) setSelectedId(card.dataset.approvalMasterId);
      if (event.target.closest?.(".mm-list-head") || /duplicate/i.test(clean(event.target.textContent))) setSelectedId("");
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, []);

  useEffect(() => {
    let frame = 0;
    const scan = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const extra = [...document.querySelectorAll(".mm-master-card")].flatMap((card) => {
          const master = resolveMaster(card, masters);
          return master ? configureCard(card, master) : [];
        });
        configureEditor(masters.find((master) => master.id === selectedId) || null);
        setTargets(extra);
      });
    };
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [masters, selectedId]);

  async function execute() {
    if (!pending || saving) return;
    setSaving(true);
    try {
      if (pending.action === "reactivate") {
        const result = await sendJson(REACTIVATE_API, "POST", { id: pending.master.id });
        setToast({ type: "success", message: result?.message || "Master activated again" });
      } else {
        await sendJson(API, "POST", { id: pending.master.id, operation: "delete_initial_draft" });
        setToast({ type: "success", message: "Initial draft deleted" });
      }
      setPending(null);
      await load();
      refreshActiveTab();
    } catch (error) {
      setToast({ type: "error", message: error.message || "Failed to process approval master" });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  }

  const deleting = pending?.action === "delete";
  return <>
    <Toast show={!!toast} type={toast?.type} message={toast?.message} />
    {targets.map(({ action, master, target }) => createPortal(
      <button type="button" className={`admin-small-btn ${action === "delete" ? "mm-danger-btn" : ""}`} disabled={saving} onClick={() => setPending({ action, master })}>
        {action === "delete" ? "Delete Draft" : "Activate Again"}
      </button>, target, `${action}-${master.id}`,
    ))}
    <AdminConfirmModal
      open={!!pending}
      title={deleting ? "Delete Initial Draft" : "Activate Archived Master"}
      description={pending ? deleting ? `${pending.master.name} has never been published and will be permanently deleted.` : `${pending.master.name} Version ${pending.master.published_revision} will be shown to residents again.` : ""}
      confirmText={deleting ? "Delete Draft" : "Activate Again"}
      cancelText="Cancel"
      loading={saving}
      loadingText={deleting ? "Deleting..." : "Activating..."}
      onCancel={() => !saving && setPending(null)}
      onConfirm={execute}
    />
  </>;
}
