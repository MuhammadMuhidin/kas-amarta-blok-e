"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import Toast from "@/components/Toast";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";
import { readJson, sendJson } from "@/components/admin/adminClientApi";

const APPROVAL_MASTERS_API = "/api/admin/approval-masters";
const REACTIVATE_API = "/api/admin/approval-masters/reactivate";

function clean(value) {
  return String(value || "").trim();
}

function setButton(button, { hidden, text, title } = {}) {
  if (!button) return;
  if (typeof hidden === "boolean" && button.hidden !== hidden) button.hidden = hidden;
  if (text && clean(button.textContent) !== text) button.textContent = text;
  if (title && button.title !== title) button.title = title;
}

function findButton(container, labels) {
  const accepted = new Set(labels);
  return [...(container?.querySelectorAll("button") || [])]
    .find((button) => accepted.has(clean(button.textContent))) || null;
}

function findButtonStartingWith(container, prefixes) {
  return [...(container?.querySelectorAll("button") || [])]
    .find((button) => prefixes.some((prefix) => clean(button.textContent).startsWith(prefix))) || null;
}

function sameTargets(previous, next) {
  return previous.length === next.length && previous.every((item, index) => (
    item.master.id === next[index].master.id &&
    item.action === next[index].action &&
    item.target === next[index].target
  ));
}

function configureCard(card, master) {
  const actions = card.querySelector(".mm-master-actions");
  if (!actions) return [];

  card.dataset.approvalMasterId = master.id;

  const lifecycle = clean(master.lifecycle_status).toLowerCase();
  const publishedRevision = Number(master.published_revision || 0);
  const draftRevision = Number(master.draft_revision || 0);
  const hasPublished = publishedRevision > 0;
  const hasDraft = Boolean(master.has_draft);
  const initialDraft = lifecycle === "draft" && !hasPublished;
  const active = lifecycle === "active";
  const archived = lifecycle === "archived";

  const edit = findButton(actions, ["Edit", "Edit Draft", "Create New Draft"]);
  const duplicate = findButton(actions, ["Duplicate", "Duplicate as New Request"]);
  const previewDraft = findButton(actions, ["Preview Draft"]);
  const viewActive = findButton(actions, ["View Active Version"]);
  const discardDraft = findButton(actions, ["Discard Draft"]);
  const archive = findButton(actions, ["Archive"]);

  setButton(edit, {
    hidden: false,
    text: initialDraft || hasDraft ? "Edit Draft" : "Create New Draft",
    title: initialDraft || hasDraft
      ? `Edit Draft Version ${draftRevision || 1}`
      : `Create Draft Version ${publishedRevision + 1}`,
  });

  setButton(duplicate, {
    hidden: initialDraft,
    text: "Duplicate as New Request",
    title: "Create a separate request type using this configuration as a template",
  });

  setButton(previewDraft, { hidden: !hasDraft && !initialDraft });
  setButton(viewActive, { hidden: !active || !hasPublished });
  setButton(discardDraft, { hidden: !hasDraft || !hasPublished });
  setButton(archive, { hidden: !active || !hasPublished });

  const customActions = [];
  if (archived && hasPublished) {
    customActions.push({ action: "reactivate", master, target: actions });
  }
  if (initialDraft) {
    customActions.push({ action: "delete", master, target: actions });
  }

  return customActions;
}

function configureEditor(master) {
  const editor = document.querySelector(".mm-editor");
  if (!editor) return;

  const kicker = editor.querySelector(".mm-editor-head .activity-kicker");
  const subtitle = editor.querySelector(".mm-editor-head .activity-subtitle");
  const publicationActions = editor.querySelector(".mm-publication-actions");
  const publish = findButtonStartingWith(publicationActions, [
    "Publish New Version",
    "Publish First Version",
    "Publish Draft as Version",
  ]);
  const archive = findButton(publicationActions, ["Archive"]);

  if (!master) {
    setButton(publish, { text: "Publish First Version" });
    setButton(archive, { hidden: true });
    return;
  }

  const lifecycle = clean(master.lifecycle_status).toLowerCase();
  const publishedRevision = Number(master.published_revision || 0);
  const draftRevision = Number(master.draft_revision || 0);
  const hasPublished = publishedRevision > 0;
  const hasDraft = Boolean(master.has_draft);
  const nextRevision = draftRevision || publishedRevision + 1 || 1;

  if (kicker) {
    const nextKicker = !hasPublished || hasDraft ? "Edit Draft" : "Create New Draft";
    if (clean(kicker.textContent) !== nextKicker) kicker.textContent = nextKicker;
  }

  if (subtitle) {
    let nextSubtitle;
    if (!hasPublished) {
      nextSubtitle = `Draft Version ${draftRevision || 1}. Never published.`;
    } else if (lifecycle === "archived" && hasDraft) {
      nextSubtitle = `Archived Version ${publishedRevision} · Draft ${draftRevision}. The request remains hidden until activated or the draft is published.`;
    } else if (lifecycle === "archived") {
      nextSubtitle = `Archived Version ${publishedRevision}. Changes will be saved as Draft ${publishedRevision + 1}.`;
    } else if (hasDraft) {
      nextSubtitle = `Active Version ${publishedRevision} · Draft ${draftRevision}. Residents continue using Version ${publishedRevision}.`;
    } else {
      nextSubtitle = `Active Version ${publishedRevision}. Changes will be saved as Draft ${publishedRevision + 1} and do not affect residents.`;
    }
    if (clean(subtitle.textContent) !== nextSubtitle) subtitle.textContent = nextSubtitle;
  }

  setButton(publish, {
    text: hasPublished ? `Publish Draft as Version ${nextRevision}` : "Publish First Version",
    title: hasPublished
      ? `Publish the current editor configuration as Version ${nextRevision}`
      : "Publish the first version of this request",
  });
  setButton(archive, { hidden: lifecycle !== "active" || !hasPublished });
}

function configurePreview() {
  const modal = document.querySelector(".mm-ro-modal");
  if (!modal) return;

  const badge = clean(modal.querySelector(".mm-ro-header span")?.textContent);
  const edit = modal.querySelector(".mm-ro-footer .admin-btn");
  if (!edit) return;

  setButton(edit, {
    text: badge.startsWith("Draft") ? "Edit Draft" : "Create New Draft",
  });
}

function collectCards(masters) {
  const queues = new Map();
  masters.forEach((master) => {
    const key = clean(master.name);
    if (!key) return;
    if (!queues.has(key)) queues.set(key, []);
    queues.get(key).push(master);
  });

  return [...document.querySelectorAll(".mm-master-card")].flatMap((card) => {
    const name = clean(card.querySelector(".mm-master-title-row h4")?.textContent);
    const queue = queues.get(name) || [];
    const master = queue.shift();
    return master ? configureCard(card, master) : [];
  });
}

export default function ArchivedMasterReactivationEnhancer() {
  const [masters, setMasters] = useState([]);
  const [targets, setTargets] = useState([]);
  const [selectedMasterId, setSelectedMasterId] = useState("");
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const selectedMaster = useMemo(
    () => masters.find((master) => master.id === selectedMasterId) || null,
    [masters, selectedMasterId],
  );

  async function loadMasters() {
    const data = await readJson(APPROVAL_MASTERS_API);
    setMasters(Array.isArray(data?.masters) ? data.masters : []);
  }

  useEffect(() => {
    loadMasters().catch(() => {
      // Master Management owns the primary loading error UI.
    });
  }, []);

  useEffect(() => {
    const onClick = (event) => {
      const button = event.target.closest?.("button");
      const text = clean(button?.textContent);

      if (button?.closest(".mm-list-head") && text.includes("Create Request")) {
        setSelectedMasterId("");
        return;
      }

      const card = event.target.closest?.(".mm-master-card");
      if (!card?.dataset.approvalMasterId) return;

      if (["Duplicate", "Duplicate as New Request"].includes(text)) {
        setSelectedMasterId("");
        return;
      }

      setSelectedMasterId(card.dataset.approvalMasterId);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    let frame = 0;
    const scan = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = collectCards(masters);
        configureEditor(selectedMaster);
        configurePreview();
        setTargets((previous) => sameTargets(previous, next) ? previous : next);
      });
    };

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [masters, selectedMaster]);

  function showToast(message, type = "success") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  async function executePending() {
    if (!pending || saving) return;

    setSaving(true);
    try {
      if (pending.action === "reactivate") {
        const result = await sendJson(REACTIVATE_API, "POST", { id: pending.master.id });
        showToast(result?.message || `Version ${pending.master.published_revision} activated again without a new revision.`);
      } else {
        await sendJson(APPROVAL_MASTERS_API, "POST", {
          id: pending.master.id,
          operation: "delete_initial_draft",
        });
        showToast("Initial draft deleted");
      }

      setPending(null);
      await loadMasters();
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      showToast(error.message || "Failed to process approval master", "error");
    } finally {
      setSaving(false);
    }
  }

  const pendingIsDelete = pending?.action === "delete";

  return (
    <>
      <Toast show={!!toast} type={toast?.type} message={toast?.message} />

      {targets.map(({ master, target, action }) => createPortal(
        <button
          type="button"
          className={`admin-small-btn ${action === "delete" ? "mm-danger-btn" : ""}`}
          disabled={saving}
          onClick={() => setPending({ action, master })}
          title={action === "delete"
            ? "Permanently delete this unpublished draft"
            : `Activate Version ${master.published_revision} again without creating a new version`}
        >
          {action === "delete" ? "Delete Draft" : "Activate Again"}
        </button>,
        target,
        `${action}-${master.id}`,
      ))}

      <AdminConfirmModal
        open={!!pending}
        title={pendingIsDelete ? "Delete Initial Draft" : "Activate Archived Master"}
        description={pending
          ? pendingIsDelete
            ? `${pending.master.name} has never been published and will be permanently deleted.`
            : `${pending.master.name} Version ${pending.master.published_revision} will be shown to residents again. Any saved draft remains available.`
          : ""}
        confirmText={pendingIsDelete ? "Delete Draft" : "Activate Again"}
        cancelText="Cancel"
        loading={saving}
        loadingText={pendingIsDelete ? "Deleting..." : "Activating..."}
        onCancel={() => !saving && setPending(null)}
        onConfirm={executePending}
      />
    </>
  );
}
