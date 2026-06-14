"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import Toast from "@/components/Toast";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";
import LoadingButtonContent from "@/components/admin/LoadingButtonContent";
import { readJson, sendJson } from "@/components/admin/adminClientApi";

const APPROVAL_MASTERS_API = "/api/admin/approval-masters";
const REACTIVATE_API = "/api/admin/approval-masters/reactivate";

function sameTargets(previous, next) {
  return previous.length === next.length && previous.every((item, index) => (
    item.master.id === next[index].master.id && item.target === next[index].target
  ));
}

function hideArchivedActiveVersionButton(card) {
  const button = [...card.querySelectorAll(".mm-master-actions button")]
    .find((item) => String(item.textContent || "").trim() === "View Active Version");

  if (button && !button.hidden) button.hidden = true;
}

function collectTargets(archivedMasters) {
  const queues = new Map();

  archivedMasters.forEach((master) => {
    const key = String(master.name || "").trim();
    if (!key) return;
    if (!queues.has(key)) queues.set(key, []);
    queues.get(key).push(master);
  });

  return [...document.querySelectorAll(".mm-master-card")]
    .map((card) => {
      if (!card.querySelector(".mm-status-archived")) return null;

      hideArchivedActiveVersionButton(card);

      const name = String(card.querySelector(".mm-master-title-row h4")?.textContent || "").trim();
      const target = card.querySelector(".mm-master-actions");
      const queue = queues.get(name) || [];
      const master = queue.shift();

      return master && target ? { master, target } : null;
    })
    .filter(Boolean);
}

export default function ArchivedMasterReactivationEnhancer() {
  const [masters, setMasters] = useState([]);
  const [targets, setTargets] = useState([]);
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const archivedMasters = useMemo(() => (
    masters.filter((master) => (
      master.lifecycle_status === "archived" && Number(master.published_revision || 0) > 0
    ))
  ), [masters]);

  useEffect(() => {
    let cancelled = false;

    readJson(APPROVAL_MASTERS_API)
      .then((data) => {
        if (!cancelled) setMasters(Array.isArray(data?.masters) ? data.masters : []);
      })
      .catch(() => {
        // Master Management already owns the primary loading error UI.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!archivedMasters.length) {
      setTargets([]);
      return undefined;
    }

    let frame = 0;
    const scan = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = collectTargets(archivedMasters);
        setTargets((previous) => sameTargets(previous, next) ? previous : next);
      });
    };

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [archivedMasters]);

  function showToast(message, type = "success") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  async function reactivate() {
    if (!pending || saving) return;

    setSaving(true);
    try {
      const result = await sendJson(REACTIVATE_API, "POST", { id: pending.id });
      setMasters((current) => current.map((master) => (
        master.id === pending.id
          ? { ...master, active: true, lifecycle_status: "active" }
          : master
      )));
      setPending(null);
      showToast(result?.message || `Version ${pending.published_revision} activated again without a new revision.`);
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      showToast(error.message || "Failed to reactivate approval master", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Toast show={!!toast} type={toast?.type} message={toast?.message} />

      {targets.map(({ master, target }) => createPortal(
        <button
          type="button"
          className="admin-small-btn"
          disabled={saving}
          onClick={() => setPending(master)}
          title={`Activate Version ${master.published_revision} again without creating a new version`}
        >
          Activate Again
        </button>,
        target,
        `reactivate-${master.id}`,
      ))}

      <AdminConfirmModal
        open={!!pending}
        title="Activate Archived Master"
        description={pending
          ? `${pending.name} Version ${pending.published_revision} will be shown to residents again. No new version or configuration diff will be created.`
          : ""}
        confirmText="Activate Again"
        cancelText="Cancel"
        loading={saving}
        loadingText="Activating..."
        onCancel={() => !saving && setPending(null)}
        onConfirm={reactivate}
      >
        {pending ? (
          <div className="mm-success-note">
            <LoadingButtonContent loading={false}>
              Version {pending.published_revision} will remain Version {pending.published_revision}.
            </LoadingButtonContent>
          </div>
        ) : null}
      </AdminConfirmModal>
    </>
  );
}
