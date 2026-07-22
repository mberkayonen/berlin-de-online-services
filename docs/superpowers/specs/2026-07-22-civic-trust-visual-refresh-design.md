# Civic Trust Visual Refresh — Design

## Purpose

A visual and chat-UX refresh of the Berlin Services Assistant's v1 UI, chosen through mockup-driven brainstorming. No functional or behavioral changes — the agent, tools, and curated dataset from v1 are untouched. Scope is presentation only: color palette, chat bubble styling, an enriched "get ready" checklist card, example-prompt chips for the empty state, and a quieter disclaimer.

## Visual Direction: Civic Trust

Deep navy (`#1a3a5c`) as the primary color, with a small Berlin-red (`#e2413a`) accent used sparingly (e.g. a status dot in the header). Light theme only — dark mode is explicitly out of scope for this pass and can be a separate follow-up. This direction was chosen over two alternatives (a dark "Modern Minimal" zinc+amber theme, and a warm cream+terracotta theme) via a mockup comparison — navy reads as official and credible, appropriate for a tool that helps with real government processes.

## Scope

**In scope:**
- Retheme existing shadcn components (`Button`, `Card`, `Badge`, `Alert`) via CSS token overrides in `app/globals.css`
- Add styled chat message bubbles (user vs. assistant)
- Add example-prompt chips shown before the first message
- Restyle the service details checklist card (section labels, checkmark icons, office badge, two-column fee/processing-time stats)
- Restyle the disclaimer as a thin top strip instead of a full `Alert` box

**Out of scope:**
- Dark mode / theme toggle
- Any change to agent behavior, tools, or `data/services.json`
- Any change to the search-results card's structure (only color tokens flow through to it automatically; no dedicated redesign)
- Automated visual regression testing

## Architecture

Retheme via shadcn's CSS token system rather than hardcoding hex values in components: override `--color-primary`, `--color-background`, `--color-card`, `--color-border`, etc. in `app/globals.css`'s `@theme inline` block. Existing shadcn-based components (`Button`, `Card`, `Badge`, `Alert`) automatically re-skin with no per-component edits, since they already consume these tokens. This keeps the palette centralized in one file for future adjustment, consistent with how shadcn/ui is meant to be used (token-based, not ad-hoc Tailwind classes).

Two new small presentational components are added for UI pieces that don't map to existing shadcn primitives:
- `components/chat/prompt-chips.tsx` — the example-prompt chips
- Message bubble styling is added directly inside `components/chat/message.tsx` (not factored into a separate component, since it's a small, single-purpose wrapper around the existing `text` part case)

## Files Touched

- `app/globals.css` — Civic Trust color tokens (light theme only)
- `components/chat/message.tsx` — wrap `text` parts in styled bubbles: user messages right-aligned with navy fill and white text; assistant messages left-aligned with white background and a thin border
- `components/chat/prompt-chips.tsx` *(new)* — renders 3 clickable example prompts; clicking one calls the passed-in `sendMessage` the same way manual typing does
- `components/chat/service-details-card.tsx` — restyle only (same data fields as v1): header row with service name + office badge, "Bring with you" section label above checkmarked documents, two-column fees/processing-time stat row, booking/source links at the bottom
- `components/chat/disclaimer.tsx` — replace the `Alert`-based block with a thin full-width strip: small centered text, same wording as v1 ("Unofficial, independent tool — not affiliated with the City of Berlin. Always verify details on service.berlin.de."), link to `service.berlin.de/dienstleistungen/`
- `app/page.tsx` — render `PromptChips` when `messages.length === 0`; pass its click handler through to `sendMessage`

## Component Details

**Prompt chips** (only shown pre-first-message): "I just moved to Berlin, what do I need to do?", "I need a new passport", "Convert my foreign driving license" — the third one is deliberately chosen to demo the ambiguous-service clarifying-question flow from v1's design when a user tries it.

**Chat bubbles:** rounded-corner bubbles, user messages navy-filled and right-aligned, assistant messages white/bordered and left-aligned. Tool-result cards (search results, service details) continue to render as their own blocks below/alongside assistant text, unchanged in position — only their internal styling picks up the new color tokens.

**Checklist card:** visually restructured but functionally identical to v1 — same fields (eligibility, required documents, fees, processing time, booking link, source link), same underlying `ServiceDetailsCard` component and `getServiceDetailsTool` data. The restructuring is presentation-only: a labeled header row, checkmark icons per document instead of a plain bulleted list, and fees/processing time laid out as a two-column stat block instead of stacked paragraphs.

## Testing

This is a UI-only, non-behavioral change, so no new automated tests are added (consistent with how the original v1 UI tasks — chat shell, structured card rendering — were verified: no unit tests for presentational React components, manual browser verification instead). Verification plan:

1. Run the dev server, load the app with an empty conversation — confirm the 3 prompt chips render and are clickable.
2. Click a chip (or type a message) — confirm it sends correctly and the user/assistant bubbles render with the new styling.
3. Ask for a service with real details (e.g. "I need a new passport") — confirm the restyled checklist card shows all fields correctly (documents, fees, processing time, both links working).
4. Confirm the disclaimer strip renders and its link works.
5. Resize to a mobile viewport width and confirm the layout doesn't break (chips wrap, bubbles don't overflow, checklist card stays readable) — this wasn't covered by the mockups and is a genuine gap to check by hand.
6. Run the full existing automated test suite (`npm test`, `npx tsc --noEmit`, `npm run build`) to confirm this pass didn't break anything functional.

## Non-Goals / Explicitly Deferred

- Dark mode (may become its own follow-up spec if wanted later)
- Any redesign of the search-results card beyond automatic color-token inheritance
- Accessibility audit beyond what shadcn's components already provide (not raised during brainstorming, but worth flagging as a gap for a future pass)
