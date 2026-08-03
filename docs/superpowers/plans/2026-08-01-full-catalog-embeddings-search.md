# Full Catalog Ingestion & Semantic Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 13 hand-curated services with an automated, resumable ingestion pipeline covering all ~1,139 services on service.berlin.de, and replace Fuse.js keyword search with Voyage embeddings-based semantic search.

**Architecture:** A standalone script (`scripts/scrape-services.ts`) fetches, parses, translates, and embeds each service, writing `data/services.json`, `data/embeddings.json`, and a pipeline-internal `data/ingestion-state.json` used for change detection on re-runs. The running app's `search_services` tool switches from Fuse.js fuzzy matching to live query embedding + in-memory cosine similarity against the precomputed vectors.

**Tech Stack:** Adds `cheerio` (HTML parsing), `voyageai` (official Voyage AI SDK), `tsx` (dev-only, runs the pipeline script). Reuses the existing Next.js / AI SDK / Zod / Vitest stack — no changes to the chat UI or agent.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-01-full-catalog-embeddings-search-design.md` — every task below implements a section of it.
- Service `id` is berlin.de's own numeric dienstleistung ID (e.g. `"120703"`), not a hand-picked slug — this supersedes the v1 curated entries' slug IDs (`"anmeldung"`, etc.), which are re-ingested through this same pipeline like every other service.
- The ingestion pipeline (`scripts/scrape-services.ts`) is a standalone script, never imported by the running Next.js app.
- No vector database — precomputed vectors live in `data/embeddings.json`, loaded into memory like `data/services.json`.
- No hallucination: the translation step must translate faithfully from extracted German text only, never inventing details; if a source field is empty, say so honestly rather than guessing (same rule as the v1 agent's system prompt, now applied to the ingestion step too).
- `ANTHROPIC_API_KEY` and `VOYAGE_API_KEY` are both already set in `.env.local`.
- Package manager: npm.

---

### Task 1: Listing Page Parser

**Files:**
- Create: `lib/pipeline/listing-parser.ts`
- Test: `lib/pipeline/listing-parser.test.ts`

**Interfaces:**
- Produces: `parseListingPage(html: string): ListingEntry[]` where `ListingEntry = { id: string; name: string }`, consumed by the orchestration script (Task 6).

- [ ] **Step 1: Install cheerio**

```bash
npm install cheerio
```

- [ ] **Step 2: Write the failing test**

Create `lib/pipeline/listing-parser.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseListingPage } from './listing-parser';

const fixtureHtml = `
<html><body>
<a href="/dienstleistungen/de_plain/">Plain text version</a>
<a href="https://service.berlin.de/dienstleistung/120703/">Personalausweis beantragen</a>
<a href="https://service.berlin.de/dienstleistung/121151/">Reisepass beantragen</a>
<a href="https://service.berlin.de/dienstleistung/120703/">Personalausweis beantragen</a>
</body></html>
`;

describe('parseListingPage', () => {
  it('extracts id and name for each unique dienstleistung link', () => {
    const result = parseListingPage(fixtureHtml);
    expect(result).toEqual([
      { id: '120703', name: 'Personalausweis beantragen' },
      { id: '121151', name: 'Reisepass beantragen' },
    ]);
  });

  it('ignores non-dienstleistung links', () => {
    const result = parseListingPage('<a href="/dienstleistungen/de_plain/">x</a>');
    expect(result).toEqual([]);
  });

  it('returns an empty array for a page with no matching links', () => {
    expect(parseListingPage('<html><body>no links here</body></html>')).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the test and verify it fails**

```bash
npx vitest run lib/pipeline/listing-parser.test.ts
```

Expected: FAIL — `Cannot find module './listing-parser'`.

- [ ] **Step 4: Implement the parser**

Create `lib/pipeline/listing-parser.ts`:

```ts
import * as cheerio from 'cheerio';

export interface ListingEntry {
  id: string;
  name: string;
}

export function parseListingPage(html: string): ListingEntry[] {
  const $ = cheerio.load(html);
  const entries = new Map<string, string>();

  $('a[href*="/dienstleistung/"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const match = href.match(/\/dienstleistung\/(\d+)\/?$/);
    if (!match) return;

    const id = match[1];
    const name = $(el).text().trim();
    if (!name) return;

    if (!entries.has(id)) {
      entries.set(id, name);
    }
  });

  return Array.from(entries, ([id, name]) => ({ id, name }));
}
```

- [ ] **Step 5: Run the test and verify it passes**

```bash
npx vitest run lib/pipeline/listing-parser.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/pipeline/listing-parser.ts lib/pipeline/listing-parser.test.ts
git commit -m "Add berlin.de listing page parser"
```

---

### Task 2: Detail Page Parser

**Files:**
- Create: `lib/pipeline/detail-parser.ts`
- Test: `lib/pipeline/detail-parser.test.ts`

**Interfaces:**
- Produces: `parseDetailPage(html: string, sourceUrl: string): RawServiceFields` where `RawServiceFields = { name: string; eligibility: string; requiredDocuments: string; fees: string; processingTime: string; office: string; bookingUrl: string | null; sourceUrl: string }` (raw German text, not yet translated or split into arrays), consumed by the content-hashing (Task 3), translation (Task 4), and orchestration (Task 6) tasks.

- [ ] **Step 1: Write the failing test**

Create `lib/pipeline/detail-parser.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseDetailPage } from './detail-parser';

const fixtureHtml = `
<html><body>
<h1 class="title">Personalausweis beantragen</h1>
<h2 class="title">Termin buchen</h2>
<div>
  <a class="button button--negative" href="/terminvereinbarung/termin/all/120703/">Berlinweite Terminbuchung</a>
</div>
<h2 class="title">Voraussetzungen</h2>
<ul class="list-clean">
  <li>Deutsche Staatsangehörigkeit</li>
  <li>Persönliche Vorsprache ist erforderlich</li>
</ul>
<h2 class="title">Erforderliche Unterlagen</h2>
<ul class="list-clean">
  <li>1 aktuelles biometrisches Passfoto</li>
  <li>Vorheriger Ausweis, falls vorhanden</li>
</ul>
<h2 class="title">Gebühren</h2>
<p><ul class="list"><li>27,60 Euro: unter 24 Jahre</li><li>46,00 Euro: ab 24 Jahre</li></ul></p>
<h2 class="title">Durchschnittliche Bearbeitungszeit</h2>
<p><ul class="list"><li>etwa 3 bis 4 Wochen</li></ul></p>
<h2 class="title">Hinweise zur Zuständigkeit</h2>
<p>Die Dienstleistung kann bei allen Bürgerämtern in Anspruch genommen werden.</p>
<h2 class="title">Kontakt</h2>
<p>Irrelevant contact block</p>
</body></html>
`;

describe('parseDetailPage', () => {
  const sourceUrl = 'https://service.berlin.de/dienstleistung/120703/';
  const result = parseDetailPage(fixtureHtml, sourceUrl);

  it('extracts the name from the h1', () => {
    expect(result.name).toBe('Personalausweis beantragen');
  });

  it('extracts list-based sections as semicolon-joined items', () => {
    expect(result.eligibility).toBe('Deutsche Staatsangehörigkeit; Persönliche Vorsprache ist erforderlich');
    expect(result.requiredDocuments).toBe('1 aktuelles biometrisches Passfoto; Vorheriger Ausweis, falls vorhanden');
    expect(result.fees).toBe('27,60 Euro: unter 24 Jahre; 46,00 Euro: ab 24 Jahre');
    expect(result.processingTime).toBe('etwa 3 bis 4 Wochen');
  });

  it('extracts the plain-text jurisdiction section', () => {
    expect(result.office).toBe('Die Dienstleistung kann bei allen Bürgerämtern in Anspruch genommen werden.');
  });

  it('resolves the booking link to an absolute URL', () => {
    expect(result.bookingUrl).toBe('https://service.berlin.de/terminvereinbarung/termin/all/120703/');
  });

  it('passes through the given sourceUrl', () => {
    expect(result.sourceUrl).toBe(sourceUrl);
  });

  it('returns an empty string for a missing section rather than throwing', () => {
    const minimal = parseDetailPage('<html><body><h1 class="title">X</h1></body></html>', sourceUrl);
    expect(minimal.eligibility).toBe('');
    expect(minimal.bookingUrl).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
npx vitest run lib/pipeline/detail-parser.test.ts
```

Expected: FAIL — `Cannot find module './detail-parser'`.

- [ ] **Step 3: Implement the parser**

Create `lib/pipeline/detail-parser.ts`:

```ts
import * as cheerio from 'cheerio';

export interface RawServiceFields {
  name: string;
  eligibility: string;
  requiredDocuments: string;
  fees: string;
  processingTime: string;
  office: string;
  bookingUrl: string | null;
  sourceUrl: string;
}

function extractSectionText($: cheerio.CheerioAPI, label: string): string {
  const heading = $('h2')
    .filter((_, el) => $(el).text().trim() === label)
    .first();
  if (heading.length === 0) return '';

  const content = heading.nextUntil('h2');
  const listItems = content.find('li');

  if (listItems.length > 0) {
    return listItems
      .map((_, li) => $(li).text().replace(/\s+/g, ' ').trim())
      .get()
      .filter(Boolean)
      .join('; ');
  }

  return content.text().replace(/\s+/g, ' ').trim();
}

export function parseDetailPage(html: string, sourceUrl: string): RawServiceFields {
  const $ = cheerio.load(html);

  const name = $('h1.title').first().text().trim();
  const eligibility = extractSectionText($, 'Voraussetzungen');
  const requiredDocuments = extractSectionText($, 'Erforderliche Unterlagen');
  const fees = extractSectionText($, 'Gebühren');
  const processingTime = extractSectionText($, 'Durchschnittliche Bearbeitungszeit');
  const office = extractSectionText($, 'Hinweise zur Zuständigkeit');

  const bookingHeading = $('h2')
    .filter((_, el) => $(el).text().trim() === 'Termin buchen')
    .first();
  const bookingHref = bookingHeading.nextUntil('h2').find('a.button').first().attr('href') ?? null;
  const bookingUrl = bookingHref ? new URL(bookingHref, 'https://service.berlin.de').toString() : null;

  return {
    name,
    eligibility,
    requiredDocuments,
    fees,
    processingTime,
    office,
    bookingUrl,
    sourceUrl,
  };
}
```

- [ ] **Step 4: Run the test and verify it passes**

```bash
npx vitest run lib/pipeline/detail-parser.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/pipeline/detail-parser.ts lib/pipeline/detail-parser.test.ts
git commit -m "Add berlin.de service detail page parser"
```

---

### Task 3: Content Hashing & Ingestion State I/O

**Files:**
- Create: `lib/pipeline/ingestion-state.ts`
- Test: `lib/pipeline/ingestion-state.test.ts`

**Interfaces:**
- Consumes: `RawServiceFields` from Task 2.
- Produces: `computeContentHash(fields: RawServiceFields): string`, `IngestionStateEntry = { contentHash: string; lastCheckedAt: string }`, `IngestionState = Record<string, IngestionStateEntry>`, `readIngestionState(path: string): Promise<IngestionState>`, `writeIngestionState(path: string, state: IngestionState): Promise<void>` — all consumed by the orchestration script (Task 6).

- [ ] **Step 1: Write the failing test**

Create `lib/pipeline/ingestion-state.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  computeContentHash,
  readIngestionState,
  writeIngestionState,
} from './ingestion-state';
import type { RawServiceFields } from './detail-parser';

const sampleFields: RawServiceFields = {
  name: 'Personalausweis beantragen',
  eligibility: 'Deutsche Staatsangehörigkeit',
  requiredDocuments: 'Passfoto',
  fees: '27,60 Euro',
  processingTime: '3 bis 4 Wochen',
  office: 'Bürgeramt',
  bookingUrl: 'https://service.berlin.de/terminvereinbarung/termin/all/120703/',
  sourceUrl: 'https://service.berlin.de/dienstleistung/120703/',
};

let tempDir: string;

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

describe('computeContentHash', () => {
  it('is deterministic for the same input', () => {
    expect(computeContentHash(sampleFields)).toBe(computeContentHash(sampleFields));
  });

  it('differs when a field changes', () => {
    const changed = { ...sampleFields, fees: '46,00 Euro' };
    expect(computeContentHash(sampleFields)).not.toBe(computeContentHash(changed));
  });
});

describe('readIngestionState / writeIngestionState', () => {
  it('returns an empty object when the file does not exist', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'ingestion-state-'));
    const state = await readIngestionState(path.join(tempDir, 'missing.json'));
    expect(state).toEqual({});
  });

  it('round-trips a written state through read', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'ingestion-state-'));
    const statePath = path.join(tempDir, 'state.json');
    const state = { '120703': { contentHash: 'abc123', lastCheckedAt: '2026-08-01T00:00:00.000Z' } };

    await writeIngestionState(statePath, state);
    const readBack = await readIngestionState(statePath);

    expect(readBack).toEqual(state);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
npx vitest run lib/pipeline/ingestion-state.test.ts
```

Expected: FAIL — `Cannot find module './ingestion-state'`.

- [ ] **Step 3: Implement**

Create `lib/pipeline/ingestion-state.ts`:

```ts
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import type { RawServiceFields } from './detail-parser';

export interface IngestionStateEntry {
  contentHash: string;
  lastCheckedAt: string;
}

export type IngestionState = Record<string, IngestionStateEntry>;

export function computeContentHash(fields: RawServiceFields): string {
  const canonical = JSON.stringify(fields, Object.keys(fields).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

export async function readIngestionState(filePath: string): Promise<IngestionState> {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as IngestionState;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw err;
  }
}

export async function writeIngestionState(filePath: string, state: IngestionState): Promise<void> {
  await writeFile(filePath, JSON.stringify(state, null, 2) + '\n', 'utf-8');
}
```

- [ ] **Step 4: Run the test and verify it passes**

```bash
npx vitest run lib/pipeline/ingestion-state.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/pipeline/ingestion-state.ts lib/pipeline/ingestion-state.test.ts
git commit -m "Add content hashing and ingestion state persistence"
```

---

### Task 4: Translation Step

**Files:**
- Create: `lib/pipeline/translate.ts`
- Test: `lib/pipeline/translate.test.ts`

**Interfaces:**
- Consumes: `RawServiceFields` from Task 2.
- Produces: `translatedFieldsSchema` (Zod), `TranslatedFields` type (`{ name, description, keywords: string[], eligibility, requiredDocuments: string[], fees, processingTime, office: string }`), `translateService(raw: RawServiceFields): Promise<TranslatedFields>` — consumed by the orchestration script (Task 6).

This task makes a real Claude API call, so — consistent with how the v1 plan handled LLM-dependent code — only the schema/validation logic is covered by the automated test; the actual translation call is verified with one real, manual smoke-test call in Step 5 (not part of `npm test`).

- [ ] **Step 1: Write the failing schema test**

Create `lib/pipeline/translate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { translatedFieldsSchema } from './translate';

const validTranslation = {
  name: 'Apply for an ID card',
  description: 'Apply for a German personal ID card at your local citizens\' office.',
  keywords: ['id card', 'personalausweis', 'identity document'],
  eligibility: 'German citizenship required.',
  requiredDocuments: ['1 current biometric photo', 'Previous ID, if available'],
  fees: '€27.60 if under 24, €46.00 if 24 or older.',
  processingTime: 'About 3 to 4 weeks.',
  office: 'This service is available at all Bürgerämter.',
};

describe('translatedFieldsSchema', () => {
  it('parses a valid translation', () => {
    expect(() => translatedFieldsSchema.parse(validTranslation)).not.toThrow();
  });

  it('rejects a translation missing a required field', () => {
    const { fees: _fees, ...missingFees } = validTranslation;
    expect(() => translatedFieldsSchema.parse(missingFees)).toThrow();
  });

  it('rejects requiredDocuments that is not an array', () => {
    expect(() =>
      translatedFieldsSchema.parse({ ...validTranslation, requiredDocuments: 'not an array' }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
npx vitest run lib/pipeline/translate.test.ts
```

Expected: FAIL — `Cannot find module './translate'`.

- [ ] **Step 3: Implement**

Create `lib/pipeline/translate.ts`:

```ts
import { generateText, Output } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import type { RawServiceFields } from './detail-parser';

export const translatedFieldsSchema = z.object({
  name: z.string(),
  description: z.string(),
  keywords: z.array(z.string()),
  eligibility: z.string(),
  requiredDocuments: z.array(z.string()),
  fees: z.string(),
  processingTime: z.string(),
  office: z.string(),
});

export type TranslatedFields = z.infer<typeof translatedFieldsSchema>;

function orNotStated(value: string): string {
  return value.trim().length > 0 ? value : '(not stated on the page)';
}

export async function translateService(raw: RawServiceFields): Promise<TranslatedFields> {
  const { output } = await generateText({
    model: anthropic('claude-haiku-4-5'),
    output: Output.object({ schema: translatedFieldsSchema }),
    prompt: `You are translating a German government service listing from berlin.de into English for a chatbot that helps residents figure out what they need to do and prepare for an appointment.

Translate the following raw extracted fields into English. Do not invent, add, or omit any factual detail — translate faithfully, only restructuring the "Required documents" text into a clean array of individual document items (one array entry per document), splitting on the natural list boundaries already present in the source text (it uses "; " between items).

Also write:
- "description": a one-sentence English summary of what this service is, based only on the name and eligibility text below.
- "keywords": 3-6 short English search terms/phrases a resident might type when looking for this service (synonyms, related situations), based only on the content below — do not invent unrelated terms.

Raw extracted German fields:
Name: ${raw.name}
Eligibility (Voraussetzungen): ${orNotStated(raw.eligibility)}
Required documents (Erforderliche Unterlagen): ${orNotStated(raw.requiredDocuments)}
Fees (Gebühren): ${orNotStated(raw.fees)}
Processing time (Durchschnittliche Bearbeitungszeit): ${orNotStated(raw.processingTime)}
Responsible office (Hinweise zur Zuständigkeit): ${orNotStated(raw.office)}

If a field says "(not stated on the page)", output an honest English equivalent like "Not stated on the page — check the official page for details." rather than inventing a value. For "requiredDocuments" specifically, if none were stated, return an empty array.`,
  });

  return output;
}
```

- [ ] **Step 4: Run the test and verify it passes**

```bash
npx vitest run lib/pipeline/translate.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Manual smoke test (real API call)**

Run this one-off script to confirm the real translation call works end-to-end:

```bash
npx tsx -e "
import { translateService } from './lib/pipeline/translate';
translateService({
  name: 'Personalausweis beantragen',
  eligibility: 'Deutsche Staatsangehörigkeit',
  requiredDocuments: '1 aktuelles biometrisches Passfoto; Vorheriger Ausweis, falls vorhanden',
  fees: '27,60 Euro: unter 24 Jahre; 46,00 Euro: ab 24 Jahre',
  processingTime: 'etwa 3 bis 4 Wochen',
  office: 'Die Dienstleistung kann bei allen Bürgerämtern in Anspruch genommen werden.',
  bookingUrl: null,
  sourceUrl: 'https://service.berlin.de/dienstleistung/120703/',
}).then(r => console.log(JSON.stringify(r, null, 2)));
"
```

If `tsx` isn't installed yet at this point, install it first: `npm install -D tsx` (Task 6 also needs it and will not re-install if already present).

Expected: a real English translation printed as JSON, matching the `translatedFieldsSchema` shape, with `requiredDocuments` as a 2-item array and no invented details beyond what's in the raw German input.

- [ ] **Step 6: Commit**

```bash
git add lib/pipeline/translate.ts lib/pipeline/translate.test.ts package.json package-lock.json
git commit -m "Add Claude-based translation step for service ingestion"
```

---

### Task 5: Voyage Embedding Client

**Files:**
- Create: `lib/voyage/client.ts`
- Test: `lib/voyage/client.test.ts`

**Interfaces:**
- Produces: `chunk<T>(items: T[], size: number): T[][]`, `embedTexts(texts: string[], inputType: 'query' | 'document'): Promise<number[][]>` — consumed by the orchestration script (Task 6) and the search rewrite (Task 7).

- [ ] **Step 1: Install the Voyage AI SDK**

```bash
npm install voyageai
```

- [ ] **Step 2: Write the failing test for the pure batching logic**

Create `lib/voyage/client.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { chunk } from './client';

describe('chunk', () => {
  it('splits an array into chunks of the given size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns a single chunk when the array is smaller than the chunk size', () => {
    expect(chunk([1, 2], 128)).toEqual([[1, 2]]);
  });

  it('returns an empty array for an empty input', () => {
    expect(chunk([], 10)).toEqual([]);
  });

  it('handles an exact multiple of the chunk size', () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  });
});
```

- [ ] **Step 3: Run the test and verify it fails**

```bash
npx vitest run lib/voyage/client.test.ts
```

Expected: FAIL — `Cannot find module './client'`.

- [ ] **Step 4: Implement**

Create `lib/voyage/client.ts`:

```ts
import { VoyageAIClient } from 'voyageai';

const MAX_BATCH_SIZE = 128;
const EMBEDDING_MODEL = 'voyage-4';

let cachedClient: VoyageAIClient | undefined;

function getClient(): VoyageAIClient {
  if (!cachedClient) {
    cachedClient = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });
  }
  return cachedClient;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function embedTexts(
  texts: string[],
  inputType: 'query' | 'document',
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const batches = chunk(texts, MAX_BATCH_SIZE);
  const results: number[][] = [];

  for (const batch of batches) {
    const response = await getClient().embed({
      input: batch,
      model: EMBEDDING_MODEL,
      inputType,
    });
    const embeddings = (response.data ?? []).map(item => item.embedding ?? []);
    results.push(...embeddings);
  }

  return results;
}
```

- [ ] **Step 5: Run the test and verify it passes**

```bash
npx vitest run lib/voyage/client.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 6: Manual smoke test (real API call)**

```bash
npx tsx -e "
import { embedTexts } from './lib/voyage/client';
embedTexts(['test query about registering an address'], 'query').then(vectors => {
  console.log('vector length:', vectors[0]?.length);
  console.log('first 5 values:', vectors[0]?.slice(0, 5));
});
"
```

Expected: prints a real vector length (a positive integer, the model's embedding dimension) and 5 sample float values — confirms `VOYAGE_API_KEY` and the real API call work.

- [ ] **Step 7: Commit**

```bash
git add lib/voyage/client.ts lib/voyage/client.test.ts package.json package-lock.json
git commit -m "Add Voyage AI embedding client with batching"
```

---

### Task 6: Orchestration Script

**Files:**
- Create: `scripts/scrape-services.ts`
- Modify: `package.json` (add `scrape` script, `tsx` devDependency)

**Interfaces:**
- Consumes: `parseListingPage` (Task 1), `parseDetailPage` (Task 2), `computeContentHash`/`IngestionState` (Task 3), `translateService` (Task 4), `embedTexts` (Task 5), `servicesSchema`/`Service` (existing `lib/services/schema.ts`).
- Produces: `data/services.json`, `data/embeddings.json`, `data/ingestion-state.json` when run — no code-level exports (this is a CLI entry point, not imported by the app).

This task only writes and dry-run-verifies the script. Running it against the full catalog is Task 9.

- [ ] **Step 1: Install tsx (skip if already installed from Task 4's smoke test)**

```bash
npm install -D tsx
```

- [ ] **Step 2: Add the npm script**

In `package.json`, add to `"scripts"`:

```json
"scrape": "tsx scripts/scrape-services.ts"
```

- [ ] **Step 3: Write the orchestration script**

Create `scripts/scrape-services.ts`. This writes its output files incrementally after every processed service — if the process crashes or is interrupted partway through a run (network blip, rate limit), a re-run resumes from the last successfully persisted state instead of losing all progress made in that run:

```ts
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseListingPage } from '../lib/pipeline/listing-parser';
import { parseDetailPage } from '../lib/pipeline/detail-parser';
import { computeContentHash, type IngestionState } from '../lib/pipeline/ingestion-state';
import { translateService } from '../lib/pipeline/translate';
import { embedTexts } from '../lib/voyage/client';
import { servicesSchema, type Service } from '../lib/services/schema';

const LISTING_URL = 'https://service.berlin.de/dienstleistungen/';
const DATA_DIR = path.join(process.cwd(), 'data');
const SERVICES_PATH = path.join(DATA_DIR, 'services.json');
const EMBEDDINGS_PATH = path.join(DATA_DIR, 'embeddings.json');
const STATE_PATH = path.join(DATA_DIR, 'ingestion-state.json');

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  return res.text();
}

async function loadJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    throw err;
  }
}

async function main() {
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined;
  const isDryRun = limit !== undefined;

  console.log('Fetching listing page...');
  const listingHtml = await fetchText(LISTING_URL);
  const fullListing = parseListingPage(listingHtml);
  const targetListing = isDryRun ? fullListing.slice(0, limit) : fullListing;
  console.log(
    `Found ${fullListing.length} services on the listing page (processing ${targetListing.length}${isDryRun ? ', dry run' : ''}).`,
  );

  const previousState = await loadJson<IngestionState>(STATE_PATH, {});
  const existingServices = await loadJson<Service[]>(SERVICES_PATH, []);
  const existingEmbeddings = await loadJson<Record<string, number[]>>(EMBEDDINGS_PATH, {});

  const servicesById = new Map(existingServices.map(s => [s.id, s]));
  const embeddingsById: Record<string, number[]> = { ...existingEmbeddings };
  const stateById: IngestionState = { ...previousState };

  async function persist() {
    const validated = servicesSchema.parse(Array.from(servicesById.values()));
    await writeFile(SERVICES_PATH, JSON.stringify(validated, null, 2) + '\n', 'utf-8');
    await writeFile(EMBEDDINGS_PATH, JSON.stringify(embeddingsById, null, 2) + '\n', 'utf-8');
    await writeFile(STATE_PATH, JSON.stringify(stateById, null, 2) + '\n', 'utf-8');
  }

  let unchangedCount = 0;
  let updatedCount = 0;
  let processedCount = 0;

  for (const entry of targetListing) {
    const detailUrl = `https://service.berlin.de/dienstleistung/${entry.id}/`;
    const detailHtml = await fetchText(detailUrl);
    const raw = parseDetailPage(detailHtml, detailUrl);
    const contentHash = computeContentHash(raw);

    const previousHash = previousState[entry.id]?.contentHash;
    const isUnchanged =
      previousHash === contentHash && servicesById.has(entry.id) && embeddingsById[entry.id] !== undefined;

    stateById[entry.id] = { contentHash, lastCheckedAt: new Date().toISOString() };

    if (!isUnchanged) {
      console.log(`Translating ${entry.id} (${raw.name})...`);
      const translated = await translateService(raw);

      const service: Service = {
        id: entry.id,
        name: translated.name,
        description: translated.description,
        keywords: translated.keywords,
        eligibility: translated.eligibility,
        requiredDocuments: translated.requiredDocuments,
        fees: translated.fees,
        processingTime: translated.processingTime,
        bookingInfo: {
          office: translated.office,
          url: raw.bookingUrl ?? raw.sourceUrl,
        },
        sourceUrl: raw.sourceUrl,
      };

      const [vector] = await embedTexts(
        [[service.name, service.description, ...service.keywords].join('. ')],
        'document',
      );

      servicesById.set(entry.id, service);
      embeddingsById[entry.id] = vector;
      updatedCount++;
    } else {
      unchangedCount++;
    }

    processedCount++;
    await persist();

    if (processedCount % 25 === 0) {
      console.log(
        `Progress: ${processedCount}/${targetListing.length} (${unchangedCount} unchanged, ${updatedCount} updated/new)`,
      );
    }
  }

  if (!isDryRun) {
    const currentIds = new Set(fullListing.map(e => e.id));
    const before = servicesById.size;
    for (const id of Array.from(servicesById.keys())) {
      if (!currentIds.has(id)) {
        servicesById.delete(id);
        delete embeddingsById[id];
        delete stateById[id];
      }
    }
    const prunedCount = before - servicesById.size;
    if (prunedCount > 0) {
      console.log(`Pruned ${prunedCount} services no longer on the listing page.`);
      await persist();
    }
  }

  console.log(
    `Done. ${unchangedCount} unchanged, ${updatedCount} updated/new. Total services: ${servicesById.size}.`,
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 4: Dry-run against 2 real services**

```bash
npm run scrape -- --limit=2
```

Expected: console output showing the listing page fetched, 2 services processed (translated + embedded), and a final "Done." line. This costs a few cents of real API usage — expected and fine.

- [ ] **Step 5: Verify the dry-run output**

```bash
cat data/services.json
cat data/embeddings.json
cat data/ingestion-state.json
```

Expected: `data/services.json` contains 2 (or up to 15, if run after Task 2's v1 seed data is still present — see note below) valid `Service` entries with real English content; `data/embeddings.json` has a vector for each service id present in `services.json`; `data/ingestion-state.json` has a `contentHash`/`lastCheckedAt` entry for each of the 2 newly-processed ids.

Note: at this point in the plan, `data/services.json` still contains the original 13 v1 curated entries (slug ids) from before this feature — the dry run only *adds* 2 new numeric-id entries alongside them via the existing `servicesById` map seeded from the current file. This mixed state is expected and harmless; Task 9's full run will replace the dataset entirely with numeric-id entries only.

- [ ] **Step 6: Re-run the same dry run to confirm change detection works**

```bash
npm run scrape -- --limit=2
```

Expected: console output shows `2 unchanged, 0 updated/new` — confirming the content-hash comparison correctly skipped re-translating/re-embedding services that haven't changed since the last run.

- [ ] **Step 7: Commit**

```bash
git add scripts/scrape-services.ts package.json package-lock.json
git commit -m "Add ingestion pipeline orchestration script"
```

Note: do not commit the dry-run's modified `data/services.json` / `data/embeddings.json` / `data/ingestion-state.json` yet — leave those for Task 9's real full run, which will produce and commit the final dataset.

---

### Task 7: Embeddings-Based Search

**Files:**
- Create: `lib/services/embeddings.ts`
- Create: `data/embeddings.json` (seeded as `{}` — populated for real by Task 9)
- Modify: `lib/services/search.ts` (full rewrite)
- Modify: `lib/services/search.test.ts` (full rewrite)
- Modify: `lib/tools/search-services.ts` (one-line change: `await` the now-async `searchServices`)
- Delete: `lib/tools/search-services.test.ts` (see rationale in Step 5)

**Interfaces:**
- Consumes: `services`/`getServiceById` from `lib/services/data.ts` (unchanged), `embedTexts` from Task 5.
- Produces: `getEmbedding(id: string): number[] | undefined`, `getAllEmbeddings(): { id: string; vector: number[] }[]`, `rankByEmbedding(queryVector, candidates, minSimilarity?, maxResults?): string[]` (pure, exported for testing), `searchServices(query: string): Promise<ServiceSearchResult[]>` (now **async**, a breaking signature change from v1) — the new signature is consumed by `lib/tools/search-services.ts`.

- [ ] **Step 1: Seed the embeddings data file**

Create `data/embeddings.json`:

```json
{}
```

This is a legitimate empty starting state (like v1 Task 2's single-entry seed for `services.json`) — Task 9's real pipeline run populates it for real; nothing here needs to be filled in as a follow-up "TODO".

- [ ] **Step 2: Create the embeddings loader**

Create `lib/services/embeddings.ts`:

```ts
import embeddingsJson from '@/data/embeddings.json';

const embeddings: Record<string, number[]> = embeddingsJson;

export function getEmbedding(id: string): number[] | undefined {
  return embeddings[id];
}

export function getAllEmbeddings(): { id: string; vector: number[] }[] {
  return Object.entries(embeddings).map(([id, vector]) => ({ id, vector }));
}
```

- [ ] **Step 3: Write the failing test for the pure ranking logic**

Replace the full contents of `lib/services/search.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { rankByEmbedding } from './search';

describe('rankByEmbedding', () => {
  const candidates = [
    { id: 'a', vector: [1, 0, 0] }, // identical to query -> similarity 1.0
    { id: 'b', vector: [0.9, 0.1, 0] }, // close to query -> high similarity
    { id: 'c', vector: [0, 1, 0] }, // orthogonal to query -> similarity 0.0
    { id: 'd', vector: [-1, 0, 0] }, // opposite of query -> similarity -1.0
  ];
  const queryVector = [1, 0, 0];

  it('ranks candidates by descending similarity', () => {
    const ranked = rankByEmbedding(queryVector, candidates, -1, 10);
    expect(ranked).toEqual(['a', 'b', 'c', 'd']);
  });

  it('filters out candidates below the minimum similarity threshold', () => {
    const ranked = rankByEmbedding(queryVector, candidates, 0.5, 10);
    expect(ranked).toEqual(['a', 'b']);
  });

  it('respects the maxResults limit', () => {
    const ranked = rankByEmbedding(queryVector, candidates, -1, 2);
    expect(ranked).toEqual(['a', 'b']);
  });

  it('returns an empty array when nothing meets the threshold', () => {
    const ranked = rankByEmbedding(queryVector, candidates, 1.5, 10);
    expect(ranked).toEqual([]);
  });

  it('returns an empty array for an empty candidate list', () => {
    expect(rankByEmbedding(queryVector, [], -1, 10)).toEqual([]);
  });
});
```

- [ ] **Step 4: Run the test and verify it fails**

```bash
npx vitest run lib/services/search.test.ts
```

Expected: FAIL — `rankByEmbedding` is not exported from `./search` yet (the old Fuse-based implementation is still in place).

- [ ] **Step 5: Rewrite the search module**

Replace the full contents of `lib/services/search.ts`:

```ts
import { cosineSimilarity } from 'ai';
import { embedTexts } from '@/lib/voyage/client';
import { services } from './data';
import { getAllEmbeddings } from './embeddings';

export interface ServiceSearchResult {
  id: string;
  name: string;
  summary: string;
}

export const MIN_SIMILARITY = 0.5;
export const MAX_RESULTS = 5;

export interface EmbeddingCandidate {
  id: string;
  vector: number[];
}

export function rankByEmbedding(
  queryVector: number[],
  candidates: EmbeddingCandidate[],
  minSimilarity = MIN_SIMILARITY,
  maxResults = MAX_RESULTS,
): string[] {
  return candidates
    .map(({ id, vector }) => ({ id, score: cosineSimilarity(queryVector, vector) }))
    .filter(({ score }) => score >= minSimilarity)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(({ id }) => id);
}

const servicesById = new Map(services.map(s => [s.id, s]));

export async function searchServices(query: string): Promise<ServiceSearchResult[]> {
  const [queryVector] = await embedTexts([query], 'query');
  const rankedIds = rankByEmbedding(queryVector, getAllEmbeddings());

  return rankedIds
    .map(id => servicesById.get(id))
    .filter((service): service is NonNullable<typeof service> => service !== undefined)
    .map(service => ({ id: service.id, name: service.name, summary: service.description }));
}
```

- [ ] **Step 6: Run the test and verify it passes**

```bash
npx vitest run lib/services/search.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 7: Update the tool wrapper to await the now-async searchServices**

In `lib/tools/search-services.ts`, change the `execute` function body from:

```ts
execute: async ({ query }) => {
  const results = searchServices(query);
  return { results };
},
```

to:

```ts
execute: async ({ query }) => {
  const results = await searchServices(query);
  return { results };
},
```

- [ ] **Step 8: Delete the now-invalid tool test**

```bash
rm lib/tools/search-services.test.ts
```

Rationale: this test previously called the real `searchServicesTool.execute` end-to-end and asserted on a specific hardcoded id (`'anmeldung'`). Now that `searchServices` makes a live Voyage network call internally, that same test would either need to hit the real network on every `npm test` run (slow, costs money, non-deterministic timing) or be mocked (more complexity than this thin wrapper justifies). The wrapper's only logic (`await searchServices(query)` then wrap in `{ results }`) is trivial and is exercised for real in Task 11's live verification. The meaningful logic — ranking/threshold/top-k — is already covered deterministically by `lib/services/search.test.ts` in Step 3 above.

- [ ] **Step 9: Verify the build**

```bash
npx tsc --noEmit
npm run build
```

Expected: both succeed — confirms `data/embeddings.json`'s `{}` seed satisfies the JSON import and the async `searchServices` change type-checks correctly everywhere it's used.

- [ ] **Step 10: Commit**

```bash
git add lib/services/embeddings.ts lib/services/search.ts lib/services/search.test.ts lib/tools/search-services.ts data/embeddings.json
git rm lib/tools/search-services.test.ts
git commit -m "Replace Fuse.js keyword search with Voyage embeddings-based semantic search"
```

---

### Task 8: Update ID-Scheme-Dependent Tests

**Files:**
- Modify: `lib/services/data.test.ts`
- Modify: `lib/tools/get-service-details.test.ts`

**Interfaces:** none — these are test-only changes making existing tests independent of the specific slug ids used in v1's curated data, so they keep passing after Task 9 replaces the dataset with numeric ids.

- [ ] **Step 1: Rewrite the services data test to be id-scheme-agnostic**

Replace the full contents of `lib/services/data.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { services, getServiceById } from './data';

describe('services data', () => {
  it('loads at least one service', () => {
    expect(services.length).toBeGreaterThan(0);
  });

  it('returns undefined for an unknown id', () => {
    expect(getServiceById('does-not-exist')).toBeUndefined();
  });

  it('gives every service a working sourceUrl pointing at service.berlin.de', () => {
    for (const service of services) {
      expect(service.sourceUrl).toMatch(/^https:\/\/service\.berlin\.de\//);
    }
  });

  it('gives every service a non-empty id, name, and description', () => {
    for (const service of services) {
      expect(service.id.length).toBeGreaterThan(0);
      expect(service.name.length).toBeGreaterThan(0);
      expect(service.description.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Rewrite the get-service-details test to pick a real id dynamically**

Replace the full contents of `lib/tools/get-service-details.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getServiceDetailsTool } from './get-service-details';
import { services } from '@/lib/services/data';

describe('getServiceDetailsTool', () => {
  it('returns the full service record for a known id', async () => {
    const knownService = services[0];
    const output = await getServiceDetailsTool.execute!(
      { serviceId: knownService.id },
      { toolCallId: 'test-call', messages: [], context: {} },
    );
    expect(output.service?.id).toBe(knownService.id);
    expect(output.service?.requiredDocuments.length).toBeGreaterThanOrEqual(0);
  });

  it('returns an error for an unknown id', async () => {
    const output = await getServiceDetailsTool.execute!(
      { serviceId: 'does-not-exist' },
      { toolCallId: 'test-call', messages: [], context: {} },
    );
    expect(output.service).toBeUndefined();
    expect(output.error).toContain('does-not-exist');
  });
});
```

Note: `requiredDocuments.length` uses `toBeGreaterThanOrEqual(0)` rather than `toBeGreaterThan(0)` here — unlike v1's curated data, an auto-translated service could legitimately have an empty `requiredDocuments` array if the source page never listed any (the translation step is instructed to return an empty array in that case, per Task 4, rather than inventing a document).

- [ ] **Step 3: Run the full test suite and verify everything passes**

```bash
npx vitest run
```

Expected: all tests pass (this exercises the still-present v1 seed data in `data/services.json`, since Task 9 hasn't replaced it yet).

- [ ] **Step 4: Commit**

```bash
git add lib/services/data.test.ts lib/tools/get-service-details.test.ts
git commit -m "Make id-dependent tests independent of the specific slug/numeric id scheme"
```

---

### Task 9: Run the Real Pipeline

**Files:** none directly (this task runs `scripts/scrape-services.ts` for real; it modifies `data/services.json`, `data/embeddings.json`, `data/ingestion-state.json` as data, not code).

This is a real, paid, long-running operation — expect roughly $3–4 in Claude Haiku 4.5 usage and a runtime of perhaps 40–70 minutes for ~1,139 services processed mostly sequentially (translation is the slow part; unchanged-service checks are fast). Because this exceeds a normal foreground command's practical time budget, run the full pass in the background and monitor it rather than blocking on it.

- [ ] **Step 1: Confirm both API keys are present**

```bash
grep -c "ANTHROPIC_API_KEY=sk-" .env.local
grep -c "VOYAGE_API_KEY=" .env.local
```

Expected: both commands print `1`. If either prints `0`, STOP and report BLOCKED — do not proceed without real keys, since the full run's cost/time only makes sense once both are confirmed working (Task 6 Step 4/5 and Task 4/5's smoke tests already exercised both keys, so this should already be true).

- [ ] **Step 2: Run the full pipeline in the background**

```bash
npm run scrape > /tmp/scrape-services-full-run.log 2>&1 &
echo "Started with PID $!"
```

If your environment provides a dedicated background-command mechanism (e.g. a `run_in_background` option on your shell tool), prefer that over the `&`/redirect approach above — either way, the goal is the same: don't block waiting on a single command for over an hour.

- [ ] **Step 3: Monitor progress periodically**

```bash
tail -30 /tmp/scrape-services-full-run.log
```

Expected: periodic `Progress: N/1139 (...)` lines (the script logs every 25 services). Check back periodically rather than continuously polling — this is a long-running background process.

- [ ] **Step 4: Confirm completion**

```bash
tail -5 /tmp/scrape-services-full-run.log
```

Expected: a final `Done. X unchanged, Y updated/new. Total services: Z.` line, where `Z` is close to 1,139 (some services may legitimately be skipped if their detail page fails to parse meaningfully — that's fine as long as it's a small fraction, not most of them). If the log shows an uncaught error partway through instead, the script's incremental persistence means you can simply re-run `npm run scrape` (foreground is fine for a resumed run, since most services will now be `unchanged` and skip the slow translate/embed steps) rather than starting over.

- [ ] **Step 5: Sanity-check the output**

```bash
node -e "
const services = require('./data/services.json');
const embeddings = require('./data/embeddings.json');
console.log('services:', services.length);
console.log('embeddings:', Object.keys(embeddings).length);
console.log('sample:', JSON.stringify(services[0], null, 2));
console.log('missing embeddings:', services.filter(s => !embeddings[s.id]).length);
"
```

Expected: `services` count in the hundreds-to-~1139 range, `embeddings` count matching (or very close to) the services count, `missing embeddings` at or near 0, and the sample record showing real, coherent English content (not German, not empty).

- [ ] **Step 6: Run the full automated test suite**

```bash
npm test
npx tsc --noEmit
npm run build
```

Expected: all pass — confirms the newly-generated (much larger) `data/services.json` still validates against `serviceSchema`/`servicesSchema` and the app still builds with real data in place.

- [ ] **Step 7: Commit the generated dataset**

```bash
git add data/services.json data/embeddings.json data/ingestion-state.json
git commit -m "Run full ingestion pipeline: populate all berlin.de services and embeddings"
```

Note: `data/embeddings.json` and `data/ingestion-state.json` may be large (embeddings especially, potentially several MB) — this is expected and fine to commit, matching how `data/services.json` is already committed.

---

### Task 10: Spot-Check Verification

**Files:** none (verification only, no code/data changes expected — see Step 4 for the one exception).

- [ ] **Step 1: Select a spot-check sample**

From the freshly generated `data/services.json`, pick ~20-30 services to verify: a random sample of ~20, plus explicitly include a few with unusually complex fee structures or long document lists (higher translation risk) if you spot any while sampling.

- [ ] **Step 2: Compare each sampled service against its live berlin.de page**

For each sampled service, fetch its `sourceUrl` (a real live berlin.de page) and compare against the corresponding `data/services.json` entry: does the English `requiredDocuments` list match what the German page actually lists (same count, same substance)? Do `fees` figures match the real numbers? Does `eligibility`/`description` accurately reflect the page without inventing anything? Is the `bookingInfo.url` a working, relevant link?

- [ ] **Step 3: Record findings**

For each checked service, note pass/fail and, for any failure, what specifically was wrong (missing document, wrong fee figure, mistranslation, hallucinated detail not on the source page).

- [ ] **Step 4: Fix any systemic issues found**

If a failure pattern shows up across multiple services (e.g. a parsing bug that drops a section, or a translation prompt issue), fix the root cause in the relevant Task 1–4 file, then re-run `npm run scrape` (which will only re-process services whose content genuinely changed since last run — a parser or prompt fix doesn't change the source content hash, so you'll need to either delete the affected entries from `data/ingestion-state.json` to force re-processing, or, for a systemic fix, delete `data/ingestion-state.json` entirely and re-run the full pipeline). If you do this, re-run this task's spot-check on the affected services afterward and commit the corrected data with a clear commit message.

If only isolated, non-systemic issues are found (e.g. one page's unusual formatting), note them as known minor gaps rather than blocking on them — this mirrors the acceptable-risk bar the v1 curated dataset was held to.

---

### Task 11: End-to-End Scenario Verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full automated test suite**

```bash
npm test
npx tsc --noEmit
npm run build
```

Expected: all pass.

- [ ] **Step 2: Start the app and open it in a browser**

```bash
npm run dev
```

- [ ] **Step 3: Verify the similarity threshold correctly returns no match**

Ask several clearly out-of-scope queries, e.g. "I want to adopt a shelter dog", "what's the weather like today", "recommend a good restaurant in Kreuzberg". For each, confirm the assistant says it doesn't have a matching service (per the existing system prompt behavior) rather than confidently presenting an unrelated service as if it matched. If any of these incorrectly return a confident match, the `MIN_SIMILARITY` constant in `lib/services/search.ts` (currently `0.5`) is too low — raise it, re-run this check along with Step 4 below (to confirm real matches still work at the new threshold), and commit the change with a clear rationale, the same threshold-tuning discipline used for the v1 Fuse.js fix.

- [ ] **Step 4: Verify real matches still work**

Ask 4-5 clear, in-scope queries against services you know are in the dataset from Task 10's spot-check (e.g. "I need a new passport", "I just moved to Berlin, what do I need to do?"). Confirm each returns a relevant, accurate checklist.

- [ ] **Step 5: Verify disambiguation still works for a similar-service pair**

Search the current `data/services.json` for two services both related to converting a foreign driving license (there should be one for EU/EEA and one for non-EU/EEA licenses, as there were in v1, now under new numeric ids):

```bash
node -e "
const services = require('./data/services.json');
const matches = services.filter(s => /führerschein|driving licen[cs]e/i.test(s.name + ' ' + s.description));
console.log(matches.map(s => ({ id: s.id, name: s.name })));
"
```

Ask "I need to convert my driving license" in the browser. Confirm the assistant asks which country issued the license rather than picking one of the two services arbitrarily (same behavior v1 verified, now driven by embedding similarity instead of keyword overlap).

- [ ] **Step 6: Record the outcome**

If all checks pass, this feature is complete. If Step 3 required a threshold change, make sure Steps 3 and 4 were both re-verified against the new threshold before committing.

- [ ] **Step 7: Final commit if anything changed**

```bash
git status
```

If any fixes were made during this task (e.g. a threshold adjustment), stage and commit them with a message describing what was wrong and what changed.
