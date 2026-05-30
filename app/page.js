import TimelineClient from "@/components/timeline/TimelineClient";
import "@/app/page.css";
import "@/app/public-theme.css";
import "@/app/timeline.css";
import "@/app/timeline-overrides.css";

const timelineInstagramRefinementCss = `
  .timeline-hero {
    text-align: center !important;
  }

  .timeline-hero .hero-eyebrow,
  .timeline-hero .hero-desc {
    margin-left: auto !important;
    margin-right: auto !important;
    text-align: center !important;
  }

  .timeline-story-item.unread .timeline-story-ring {
    background: var(--primary) !important;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 13%, transparent) !important;
  }

  .timeline-story-ring {
    overflow: hidden !important;
  }

  .timeline-story-ring img,
  .timeline-story-ring > span {
    box-sizing: border-box !important;
    max-width: 100% !important;
    max-height: 100% !important;
    aspect-ratio: 1 / 1 !important;
  }

  .timeline-story-ring img {
    display: block !important;
    object-fit: cover !important;
  }

  .timeline-story-item small,
  .timeline-back-to-top {
    display: none !important;
  }

  .timeline-story-item {
    gap: 0 !important;
  }

  .timeline-reaction-summary {
    cursor: pointer;
    border-radius: 999px;
    padding: 6px 8px;
    transition: background 0.16s ease;
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
    touch-action: manipulation;
  }

  .timeline-reaction-summary,
  .timeline-reaction-summary *,
  .timeline-reaction-count-popover,
  .timeline-reaction-count-popover * {
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
  }

  .timeline-reaction-summary:hover,
  .timeline-reaction-summary:focus-visible {
    background: color-mix(in srgb, var(--primary) 9%, transparent);
  }

  .timeline-reaction-count-popover {
    position: fixed;
    z-index: 10020;
    width: auto;
    min-width: 104px;
    max-width: min(180px, calc(100vw - 32px));
    padding: 10px;
    border: 1px solid color-mix(in srgb, var(--primary) 16%, var(--border));
    border-radius: 18px;
    background: color-mix(in srgb, var(--surface) 94%, transparent);
    box-shadow: 0 18px 44px rgba(15, 23, 42, 0.2), var(--shadow-soft);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    color: var(--text);
  }

  .timeline-reaction-count-popover-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    min-width: 76px;
    padding: 7px 8px;
    border-radius: 12px;
    font-size: 15px;
    font-weight: 900;
  }

  .timeline-reaction-count-popover-row + .timeline-reaction-count-popover-row {
    margin-top: 2px;
  }

  .timeline-reaction-count-popover-row:hover {
    background: color-mix(in srgb, var(--primary) 8%, transparent);
  }

  .timeline-reaction-count-popover-empty {
    padding: 7px 8px;
    color: var(--muted);
    font-size: 13px;
    font-weight: 800;
    white-space: nowrap;
  }

  .timeline-reaction-count-popover-loading {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 7px 8px;
    color: var(--muted);
    font-size: 13px;
    font-weight: 850;
    white-space: nowrap;
  }

  .timeline-reaction-count-popover-loading::before {
    content: "";
    width: 10px;
    height: 10px;
    border: 2px solid color-mix(in srgb, var(--primary) 28%, transparent);
    border-top-color: var(--primary);
    border-radius: 999px;
    animation: timelineReactionPopoverSpin 0.7s linear infinite;
  }

  @keyframes timelineReactionPopoverSpin {
    to { transform: rotate(360deg); }
  }

  .timeline-reaction-count-popover-count {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  .timeline-bottom-nav-item:first-child span {
    font-size: 0 !important;
  }

  .timeline-bottom-nav-item:first-child span::before {
    content: "🏠";
    font-size: 18px;
    line-height: 1;
  }
`;

const timelineReactionCountScript = `
(() => {
  const reactions = [
    { type: "like", emoji: "👍", label: "Suka" },
    { type: "care", emoji: "❤️", label: "Peduli" },
    { type: "thanks", emoji: "🙏", label: "Terima kasih" },
    { type: "appreciate", emoji: "👏", label: "Apresiasi" },
    { type: "informative", emoji: "💡", label: "Informatif" },
  ];

  function removePopover() {
    document.querySelector(".timeline-reaction-count-popover")?.remove();
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("id-ID");
  }

  function positionPopover(popover, target) {
    const rect = target.getBoundingClientRect();
    const width = popover.offsetWidth || Math.min(180, window.innerWidth - 32);
    const left = Math.min(Math.max(16, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 16);
    const top = Math.max(16, rect.top - popover.offsetHeight - 10);

    popover.style.left = left + "px";
    popover.style.top = top + "px";
  }

  function createPopover(target, html, label = "Rincian reaksi") {
    removePopover();

    const popover = document.createElement("div");
    popover.className = "timeline-reaction-count-popover";
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-label", label);
    popover.innerHTML = html;

    document.body.appendChild(popover);
    positionPopover(popover, target);
    return popover;
  }

  function renderLoadingPopover(target) {
    createPopover(target, '<div class="timeline-reaction-count-popover-loading">Memuat</div>', "Memuat rincian reaksi");
  }

  function renderPopover(target, counts) {
    const activeReactions = reactions
      .map((reaction) => ({ ...reaction, count: Number(counts?.[reaction.type] || 0) }))
      .filter((reaction) => reaction.count > 0);
    const html = activeReactions.length
      ? activeReactions.map((reaction) => (
        '<div class="timeline-reaction-count-popover-row" aria-label="' + reaction.label + ' ' + formatNumber(reaction.count) + '">' +
          '<span aria-hidden="true">' + reaction.emoji + '</span>' +
          '<span class="timeline-reaction-count-popover-count">' + formatNumber(reaction.count) + '</span>' +
        '</div>'
      )).join("")
      : '<div class="timeline-reaction-count-popover-empty">Belum ada reaksi</div>';

    createPopover(target, html);
  }

  async function showReactionCounts(target) {
    const article = target.closest("[id^='timeline-post-']");
    const postId = article?.id?.replace("timeline-post-", "") || "";
    if (!postId) return;

    renderLoadingPopover(target);

    try {
      const response = await fetch("/api/timeline/posts?post=" + encodeURIComponent(postId) + "&t=" + Date.now(), {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Gagal membaca reaksi");
      renderPopover(target, data.post?.reaction_counts || {});
    } catch {
      removePopover();
    }
  }

  document.addEventListener("pointerdown", (event) => {
    const summary = event.target.closest?.(".timeline-reaction-summary");
    if (!summary) return;

    event.preventDefault();
  }, { passive: false });

  document.addEventListener("click", (event) => {
    const summary = event.target.closest?.(".timeline-reaction-summary");

    if (summary) {
      event.preventDefault();
      event.stopPropagation();
      showReactionCounts(summary);
      return;
    }

    if (!event.target.closest?.(".timeline-reaction-count-popover")) {
      removePopover();
    }
  });

  window.addEventListener("scroll", removePopover, { passive: true });
  window.addEventListener("resize", removePopover);
})();
`;

export default function ResidentTimelinePage() {
  return (
    <>
      <style>{timelineInstagramRefinementCss}</style>
      <TimelineClient />
      <script dangerouslySetInnerHTML={{ __html: timelineReactionCountScript }} />
    </>
  );
}
