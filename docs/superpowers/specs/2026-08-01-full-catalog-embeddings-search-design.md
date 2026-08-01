# Full Catalog Ingestion & Semantic Search — Design

## Purpose

Extend the Berlin Services Assistant from a hand-curated set of 13 services to the full berlin.de catalog (verified: **1,139 unique services**, all listed on a single page at [service.berlin.de/dienstleistungen](https://service.berlin.de/dienstleistungen/) — not the ~400 originally assumed). This requires two coupled changes: an automated data-ingestion pipeline (replacing manual per-service research, which doesn't scale past a few dozen services) and a move from keyword search to embeddings-based semantic search (since Fuse.js keyword matching over ~1,139 richly-worded records was already flagged in the v1 design as a stopgap for a small dataset).

This spec covers ingestion + search only. No changes to the chat UI, the agent's conversational behavior, or `app/api/chat/route.ts` beyond `search_services` now doing embedding similarity instead of fuzzy keyword matching internally — its input/output contract to the agent is unchanged.

## Non-Goals

- No changes to the visual design, chat layout, or any component from prior passes.
- No vector database — 1,139 precomputed vectors fit comfortably in memory; introducing one now would be premature infrastructure for this scale.
- No automated translation-quality grading beyond the spot-check sample described below.
- No scheduled/automatic re-runs of the pipeline (e.g. a cron job) — it's a script the user runs manually when they want to refresh the data. Automating that trigger is a possible future pass, not part of this one.

## Ingestion Pipeline

A standalone script (`scripts/scrape-services.ts`, run via `npm run scrape`, not part of the live app) that is safe to re-run repeatedly:

1. **Fetch the listing page** (`service.berlin.de/dienstleistungen/`) — parse all current `{id, name}` pairs via HTML parsing (no LLM). The `id` used throughout the pipeline and the app is berlin.de's own numeric dienstleistung ID (e.g. `"120703"` from `/dienstleistung/120703/`) rather than a hand-picked slug — stable, collision-free, and directly matches the source. This supersedes the human-chosen slugs (`"anmeldung"`, `"reisepass"`, etc.) used by the 13 services curated in the original v1 pass; those 13 services are re-ingested through this same pipeline like every other service; there is no separate hand-curated tier to maintain going forward.
2. **For each service, check for change:** fetch its detail page, extract the structured German content (`Voraussetzungen`, `Erforderliche Unterlagen`, `Gebühren`, `Durchschnittliche Bearbeitungszeit`, office/contact info) via HTML parsing, and compute a content hash. Compare against the hash stored in `data/ingestion-state.json` from the last run.
   - **Hash unchanged:** skip translation and embedding for this service; keep its existing entries in `data/services.json` / `data/embeddings.json` as-is.
   - **Hash changed, or service is new:** run the full translate + embed step (below) for this service only.
3. **Translate:** one Claude call per changed/new service, with structured output validated against the `Service` schema — translating the extracted German fields to English. Model: Claude Haiku 4.5 (cheap, and this is mechanical extraction-into-a-schema, not reasoning-heavy work).
4. **Embed:** one Voyage `voyage-4` embedding call per changed/new service (batchable), over the concatenated `name + description + keywords` text. The `keywords` field is repurposed here — it no longer drives search matching directly (embeddings replace Fuse.js), but it still enriches the text that gets embedded, giving the vector more semantic surface to match against varied phrasings of the same need.
5. **Prune removed services:** any `id` present in the last run's state but absent from the current listing page is dropped from `data/services.json` and `data/embeddings.json` — if berlin.de no longer lists a service, the app shouldn't offer to help with it.
6. **Write outputs:** `data/services.json` (schema-validated, same `Service` shape as v1), `data/embeddings.json` (`{ [id]: number[] }`), `data/ingestion-state.json` (`{ [id]: { contentHash, lastCheckedAt } }` — pipeline-internal only, never loaded by the running app).

The pipeline must be resumable: if it fails partway through (network error, rate limit), a re-run picks up from `ingestion-state.json` rather than re-processing everything already written.

**Cost:** a full first run costs roughly $3–4 in Claude Haiku 4.5 translation calls (the dominant cost) plus a negligible fraction of a cent in Voyage embeddings (covered by Voyage's free tier at this volume). A later re-run costs roughly proportional to how much actually changed on berlin.de since the last run, typically well under $1.

## Data Schema & Storage

- `lib/services/schema.ts`'s `Service` type is unchanged in shape from v1 (`id`, `name`, `description`, `keywords`, `eligibility`, `requiredDocuments`, `fees`, `processingTime`, `bookingInfo: {office, url}`, `sourceUrl`, optional `clarifyingQuestions`). `bookingInfo` stays a single office/URL pair — the pipeline picks the page's primary booking link rather than enumerating every district office that might handle a given service.
- `data/services.json` grows from 13 to ~1,139 entries (a few MB), still a plain static JSON file imported and validated at module load, same pattern as v1 — no database.
- `data/embeddings.json` (new): `{ [serviceId: string]: number[] }`, one Voyage vector per service, loaded into memory alongside the services list.
- `data/ingestion-state.json` (new): pipeline-only bookkeeping, described above.

## Search Integration

`lib/services/search.ts`'s `searchServices` is rewritten from Fuse.js fuzzy matching to embeddings-based semantic search:

1. Embed the user's query via Voyage (one live API call per search; negligible cost, ~100–300ms added latency).
2. Compute cosine similarity between the query vector and all ~1,139 precomputed service vectors, in memory (fast enough at this size without an approximate-nearest-neighbor index).
3. Return the top-k results **above a minimum similarity threshold**, not just the top-k unconditionally.

**The threshold is the highest-risk part of this change and needs the same discipline that caught the v1 Fuse threshold bug.** Cosine similarity always returns *some* top-k result, even for a completely unrelated query — unlike Fuse's threshold, there's no natural zero. Without a correctly-tuned floor, an out-of-scope query (e.g. "I want to adopt a shelter dog") could start returning the closest-but-still-wrong service instead of no match, silently reintroducing the exact over-matching failure mode found and fixed in v1. The threshold must be tuned against both true-positive queries (should match) and true-negative queries (should return nothing) before being trusted, mirroring the fix in `docs/superpowers/plans/2026-07-14-berlin-services-chatbot-v1.md`'s Task 4.

`VOYAGE_API_KEY` becomes a required runtime environment variable (already provisioned).

## Testing & Verification

- **Data accuracy:** after the first full pipeline run, spot-check ~20–30 services (a random sample plus a few chosen for translation-risk, e.g. services with complex fee tables) by fetching the live berlin.de page and comparing against the pipeline's output — same method used for the v1 curated set.
- **Search quality:** re-run the scenario-based conversational tests from the v1 manual verification script (clear match, ambiguous/disambiguation, no-good-match, follow-up question) against the new embedding-backed search over the full catalog, since both the data source and the matching mechanism changed. Explicitly include a batch of clearly out-of-scope queries to confirm the similarity threshold correctly returns no match.
- **Automated tests:** update the existing schema/count tests for ~1,139 entries; add unit tests for the cosine-similarity/top-k/threshold logic using small synthetic vector fixtures — deterministic, no network calls, no Voyage cost in CI.
