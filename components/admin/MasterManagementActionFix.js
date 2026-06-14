"use client";

import { useEffect } from "react";

function selectedAction(button) {
  const actions = button?.closest?.(".mm-publication-actions");
  if (!actions) return "";

  const buttons = [...actions.querySelectorAll("button")];
  if (button === buttons[0]) return "draft";
  if (button === buttons[1]) return "active";
  return "";
}

export default function MasterManagementActionFix() {
  useEffect(() => {
    let intendedAction = "";
    let actionStarted = false;

    function clear(editor) {
      if (editor) delete editor.dataset.mmSavingAction;
      intendedAction = "";
      actionStarted = false;
    }

    function sync() {
      const editor = document.querySelector(".mm-editor");
      if (!editor) {
        clear(null);
        return;
      }

      if (!intendedAction) {
        delete editor.dataset.mmSavingAction;
        return;
      }

      const buttons = [...(editor.querySelectorAll(".mm-publication-actions button") || [])];
      const target = intendedAction === "draft" ? buttons[0] : buttons[1];

      if (target?.disabled) {
        editor.dataset.mmSavingAction = intendedAction;
        actionStarted = true;
        return;
      }

      if (actionStarted) clear(editor);
    }

    function handleClick(event) {
      const button = event.target.closest?.(".mm-publication-actions button");
      const action = selectedAction(button);
      if (!action) return;

      intendedAction = action;
      actionStarted = false;
      queueMicrotask(sync);
      window.setTimeout(sync, 0);
    }

    document.addEventListener("click", handleClick, true);

    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled"],
    });

    return () => {
      document.removeEventListener("click", handleClick, true);
      observer.disconnect();
    };
  }, []);

  return null;
}
