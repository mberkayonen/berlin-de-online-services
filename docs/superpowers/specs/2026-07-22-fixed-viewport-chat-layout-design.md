# Fixed-Viewport Chat Layout — Design

## Purpose

The chat page currently grows with the conversation — the whole browser window scrolls as messages accumulate, since `app/layout.tsx`'s body is `min-h-full` with no scroll container. This restructures the page into a fixed-viewport layout with an internally-scrolling message list, matching the standard Claude/ChatGPT chat pattern: header and disclaimer pinned at top, input pinned at bottom, only the conversation itself scrolls, and new messages auto-scroll into view.

Presentation/layout only — no changes to the agent, tools, data, or any visual styling beyond restructuring existing elements into fixed vs. scrollable regions.

## Design

**`app/layout.tsx`:** body changes from `min-h-full flex flex-col` to `h-full flex flex-col overflow-hidden` — locks the page to the viewport height and prevents the document itself from scrolling, forcing any scrolling to happen inside a child container.

**`app/page.tsx`:** restructured into three stacked regions inside a `flex h-full flex-col` container:

1. **Fixed top (`flex-shrink-0`):** the `<h1>` title (with status dot) and `<Disclaimer />` — unchanged content, just wrapped so it doesn't shrink or scroll.
2. **Scrollable middle (`flex-1 overflow-y-auto`):** the prompt chips (shown when `messages.length === 0`, as today) followed by the mapped `<Message />` list, followed by an empty scroll-anchor `<div>` at the very end.
3. **Fixed bottom (`flex-shrink-0`):** the input `<form>` — no longer needs `sticky bottom-4` since it's now a natural flex child pinned by the layout itself, not by scroll position.

**Auto-scroll:** a `ref` on the scroll-anchor div at the bottom of the scrollable region. A `useEffect` that runs whenever `messages` changes calls `scrollIntoView({ behavior: 'smooth' })` on that ref, so the view follows new messages the way Claude/ChatGPT do.

## Testing

No behavioral/data change, so no new automated tests — consistent with how prior UI-only passes in this project were verified. Manual verification:

1. Send enough messages to overflow the viewport — confirm only the message list scrolls, not the whole page; header/disclaimer/input stay fixed in place.
2. Confirm the view auto-scrolls to the latest message as the assistant's reply streams in.
3. Confirm the empty-state prompt chips still render and are clickable inside the scrollable region.
4. Resize to a mobile width and confirm the fixed-viewport layout still behaves correctly (no double scrollbars, input stays reachable).
