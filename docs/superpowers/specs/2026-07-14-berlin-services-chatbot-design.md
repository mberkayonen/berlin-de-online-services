# Berlin Services Chatbot — v1 Design

## Purpose

A personal learning project for gaining real-world experience building, evaluating, and
tracking the performance of an LLM-powered AI product. The product itself: an unofficial
chatbot for the City of Berlin's online services portal
([service.berlin.de/dienstleistungen](https://service.berlin.de/dienstleistungen/)) that:

1. Understands what a user needs to get done with the city and recommends the right online
   service.
2. Once a service is selected, helps the user get ready for it (required documents,
   eligibility, fees, processing time, how to book).

This is explicitly a two-phase project:

- **Phase 1 (this spec):** the core product — knowledge base, conversational agent, chat UI.
- **Phase 2 (future spec):** evaluation and observability, instrumented with Langfuse.

Phase 1 is scoped to be small and fast to build so there is a working product to evaluate in
Phase 2, rather than over-building before anything is measurable.

## Non-goals for v1

- Full coverage of berlin.de's ~400 services (curated subset only).
- German language support (English only).
- Automated evaluation, tracing, or performance tracking (Phase 2, via Langfuse).
- RAG / vector search infrastructure (deferred; not needed at this dataset size).
- Booking appointments on the user's behalf (the bot links out to berlin.de; it never
  performs the booking, since that is a real-world side effect with consequences for the
  user).

## Architecture

- **Stack:** Next.js (App Router) + Vercel AI SDK, deployed on Vercel.
- **Chat UI:** Built with the AI SDK's `useChat` hook, plus `ai-elements`/shadcn components
  for structured message rendering (see UI section).
- **Model:** Claude, called via the AI SDK's Anthropic provider directly (not the Vercel AI
  Gateway). This keeps Phase 1 simple. Phase 2's Langfuse instrumentation wraps AI SDK calls
  via OpenTelemetry and works the same regardless of provider vs. gateway, so this choice
  doesn't block Phase 2.
- **Knowledge base:** A single curated JSON file, `data/services.json`, containing ~15-20
  hand-picked, commonly-needed services (e.g. Anmeldung, Personalausweis,
  Führungszeugnis, Reisepass, KFZ-Zulassung), manually sourced and verified against
  [service.berlin.de/dienstleistungen](https://service.berlin.de/dienstleistungen/).

  Each entry has the shape:

  ```json
  {
    "id": "anmeldung",
    "name": "Anmeldung (Registering your address)",
    "description": "...",
    "keywords": ["move", "new address", "register", "residence"],
    "eligibility": "...",
    "requiredDocuments": ["..."],
    "fees": "...",
    "processingTime": "...",
    "bookingInfo": {
      "office": "Bürgeramt",
      "url": "https://service.berlin.de/..."
    },
    "sourceUrl": "https://service.berlin.de/dienstleistung/..."
  }
  ```

- **Agent tools** (defined via the AI SDK's `tool()`):
  - `search_services(query)` — fuzzy/keyword match (e.g. Fuse.js) over `name`,
    `description`, and `keywords`; returns the top matching services (id + short summary).
  - `get_service_details(service_id)` — returns the full record for a given service, used
    to render the "get ready" checklist.
- **Conversation loop:** Standard AI SDK multi-step tool calling (`maxSteps` > 1). The model
  decides when to call `search_services` (to interpret intent) and
  `get_service_details` (once a service is confirmed), interleaved with natural-language
  turns.

## Conversation Flow

1. User describes their need in plain English (e.g. "I just moved to Berlin, what do I need
   to do?").
2. Model calls `search_services`, then responds with 1-3 candidate services (name + a
   one-line reason it matches), asking the user to confirm or narrow down if the request was
   ambiguous.
3. User picks one (by clicking a suggested option or typing).
4. Model calls `get_service_details` and renders a structured "get ready" checklist:
   required documents, eligibility, fees, processing time, and how/where to book — plus a
   link back to the authoritative berlin.de page.
5. The user can continue the conversation (follow-up questions, or start over for a
   different need).

## UI

- Single-page chat interface using the AI SDK's `useChat` hook.
- Plain conversational turns render as normal chat bubbles.
- Assistant messages carrying a service recommendation or a details checklist render as
  structured cards rather than plain prose — e.g. a checklist with checkboxes for required
  documents, and a "Book here" link button pointing at berlin.de.
- A persistent, small disclaimer is shown in the UI stating this is an unofficial,
  independent tool not affiliated with the City of Berlin, with a link to the real
  berlin.de site for final verification. This matters both ethically (it's not an official
  government product) and practically (sets correct user expectations about accuracy).

## Error Handling

- **No relevant match:** if `search_services` returns nothing relevant, the model says so
  plainly and suggests browsing the full service list on berlin.de (with a link), rather
  than guessing or inventing a service.
- **Ambiguous request:** if a request could plausibly match multiple unrelated services, the
  model asks a clarifying question instead of picking one arbitrarily.
- **No hallucinated details:** the system prompt explicitly instructs the model to state
  only what is present in tool results (documents, fees, eligibility, etc.), and to respond
  with "I don't have that detail — check the official page" for anything not covered by the
  curated data. This is the single biggest accuracy risk in the product, since a wrong
  document list could cause a user to have a wasted trip to a Bürgeramt.

## Testing (v1, pre-Langfuse)

No automated evaluation yet — that is explicitly Phase 2's job, built on Langfuse. For v1,
verification is manual: a short written test script of ~10 representative queries, covering:

- A clear, unambiguous match ("I need a new passport").
- An ambiguous request that could map to multiple services.
- A request with no good match in the curated set.
- Follow-up questions after a service is selected (e.g. "what if I don't have X document?").

Run by hand in the browser before calling v1 "done."

## Phase 2 Preview (not designed yet)

Explicitly deferred to a separate spec, to be brainstormed once v1 is working:

- Langfuse integration for tracing every conversation (tool calls, model turns).
- An evaluation harness/dataset (e.g. did `search_services` get called with a sensible
  query, was the correct service recommended, did the details response stay grounded in the
  curated data with no hallucinated fields).
- Performance/quality tracking dashboards.
- Possible expansion: broader service catalog, German language support, RAG-based retrieval
  if the catalog grows past what fits comfortably in a keyword search.
