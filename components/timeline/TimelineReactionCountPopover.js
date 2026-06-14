"use client";

import { useEffect } from "react";

const REACTIONS = [
  { type: "like", emoji: "👍", label: "Suka" },
  { type: "care", emoji: "❤️", label: "Peduli" },
  { type: "thanks", emoji: "🙏", label: "Terima kasih" },
  { type: "appreciate", emoji: "👏", label: "Apresiasi" },
  { type: "informative", emoji: "💡", label: "Informatif" },
];

function getElementTarget(event) {
  return event.target instanceof Element ? event.target : null;
}

function getOpenPopover() {
  return document.querySelector(".timeline-reaction-count-popover");
}

function getPostIdFromSummary(target) {
  return target.closest("[id^='timeline-post-']")?.id?.replace("timeline-post-", "") || "";
}

function removePopover() {
  getOpenPopover()?.remove();
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("id-ID");
}

function getActiveReactions(counts) {
  return REACTIONS
    .map((reaction) => ({
      ...reaction,
      count: Number(counts?.[reaction.type] || 0),
    }))
    .filter((reaction) => reaction.count > 0);
}

function getReactionTotal(counts) {
  return REACTIONS.reduce(
    (sum, reaction) => sum + Number(counts?.[reaction.type] || 0),
    0,
  );
}

function positionPopover(popover, target) {
  const rect = target.getBoundingClientRect();
  const width = popover.offsetWidth || Math.min(180, window.innerWidth - 32);
  const left = Math.min(
    Math.max(16, rect.left + rect.width / 2 - width / 2),
    window.innerWidth - width - 16,
  );
  const top = Math.max(16, rect.top - popover.offsetHeight - 10);

  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
}

function createPopover(target, html, label = "Rincian reaksi") {
  removePopover();

  const popover = document.createElement("div");
  popover.className = "timeline-reaction-count-popover";
  popover.dataset.postId = getPostIdFromSummary(target);
  popover.setAttribute("role", "dialog");
  popover.setAttribute("aria-label", label);
  popover.innerHTML = html;

  document.body.appendChild(popover);
  positionPopover(popover, target);
}

function renderLoadingPopover(target) {
  createPopover(
    target,
    '<div class="timeline-reaction-count-popover-loading">Memuat</div>',
    "Memuat rincian reaksi",
  );
}

function syncSummary(target, counts) {
  const total = getReactionTotal(counts);
  const activeReactions = getActiveReactions(counts).slice(0, 3);
  const icons = target.querySelector(".timeline-reaction-icons");
  const label = target.querySelector(":scope > span:last-child");

  target.dataset.reactionCounts = JSON.stringify(counts || {});
  target.setAttribute("aria-label", `${total} reaksi`);

  if (icons) {
    icons.innerHTML = activeReactions
      .map((reaction) => `<span aria-hidden="true">${reaction.emoji}</span>`)
      .join("");
    icons.style.display = activeReactions.length ? "inline-flex" : "none";
  }

  if (label) {
    label.textContent = `${formatNumber(total)} reaksi`;
  }
}

function renderPopover(target, counts) {
  const activeReactions = getActiveReactions(counts);
  const html = activeReactions.length
    ? activeReactions
        .map(
          (reaction) =>
            `<div class="timeline-reaction-count-popover-row" aria-label="${reaction.label} ${formatNumber(reaction.count)}">` +
            `<span aria-hidden="true">${reaction.emoji}</span>` +
            `<span class="timeline-reaction-count-popover-count">${formatNumber(reaction.count)}</span>` +
            "</div>",
        )
        .join("")
    : '<div class="timeline-reaction-count-popover-empty">Belum ada reaksi</div>';

  syncSummary(target, counts);
  createPopover(target, html);
}

function readEmbeddedCounts(target) {
  try {
    const parsed = JSON.parse(target.dataset.reactionCounts || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

async function refreshReactionCounts(target) {
  const postId = getPostIdFromSummary(target);
  if (!postId) return;

  try {
    const response = await fetch(
      `/api/timeline/posts?post=${encodeURIComponent(postId)}&t=${Date.now()}`,
      {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      },
    );
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.post?.reaction_counts) return;
    renderPopover(target, data.post.reaction_counts);
  } catch {
    // Pertahankan jumlah reaksi yang sudah dirender jika refresh gagal.
  }
}

function showReactionCounts(target) {
  const embeddedCounts = readEmbeddedCounts(target);

  if (getReactionTotal(embeddedCounts) > 0) {
    renderPopover(target, embeddedCounts);
  } else {
    renderLoadingPopover(target);
  }

  refreshReactionCounts(target);
}

function isSameOpenSummary(summary) {
  const openPopover = getOpenPopover();
  return Boolean(
    openPopover &&
      summary &&
      openPopover.dataset.postId === getPostIdFromSummary(summary),
  );
}

export default function TimelineReactionCountPopover() {
  useEffect(() => {
    function handlePointerDown(event) {
      const target = getElementTarget(event);
      const summary = target?.closest(".timeline-reaction-summary");
      const popover = target?.closest(".timeline-reaction-count-popover");

      if (summary) {
        event.preventDefault();
        return;
      }

      if (!popover) removePopover();
    }

    function handleClick(event) {
      const target = getElementTarget(event);
      const summary = target?.closest(".timeline-reaction-summary");

      if (summary) {
        event.preventDefault();
        event.stopPropagation();

        if (isSameOpenSummary(summary)) {
          removePopover();
          return;
        }

        showReactionCounts(summary);
        return;
      }

      if (!target?.closest(".timeline-reaction-count-popover")) {
        removePopover();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, { passive: false });
    document.addEventListener("click", handleClick);
    window.addEventListener("scroll", removePopover, { passive: true });
    window.addEventListener("resize", removePopover);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("click", handleClick);
      window.removeEventListener("scroll", removePopover);
      window.removeEventListener("resize", removePopover);
      removePopover();
    };
  }, []);

  return null;
}
