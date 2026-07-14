# Berlin Services Chatbot v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working v1 of an unofficial Berlin city-services chatbot: a Next.js app where a tool-calling Claude agent recommends the right berlin.de service for a user's need and helps them get ready for it (documents, eligibility, fees, booking), backed by a small hand-curated dataset.

**Architecture:** A Next.js App Router app with one AI SDK `ToolLoopAgent` (`lib/agents/berlin-services-agent.ts`) that has two tools — `search_services` (keyword search over a local JSON dataset) and `get_service_details` (full record lookup). The API route (`app/api/chat/route.ts`) streams the agent's responses to a `useChat`-based chat UI (`app/page.tsx`) that renders both plain text and structured tool-result cards.

**Tech Stack:** Next.js (App Router, TypeScript), Tailwind CSS, shadcn/ui, AI SDK (`ai` v7 + `@ai-sdk/anthropic` + `@ai-sdk/react`), Zod, Fuse.js, Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-14-berlin-services-chatbot-design.md` — every task below implements a section of it; deviations are called out inline.
- English only for v1 (no German UI/content).
- No hallucinated service details: the agent must only state what tool results contain (spec "Error Handling").
- The agent must ask a clarifying question whenever it lacks the information to pick or accurately detail a service, rather than guessing (spec "Conversation Flow" governing rule).
- The bot never books appointments — it only links out to berlin.de.
- No automated eval/tracing in this plan — that's an explicitly separate Phase 2 spec (Langfuse).
- Package manager: npm.

---

### Task 1: Project Scaffolding

**Files:**
- Create: Next.js project files at repo root (`package.json`, `tsconfig.json`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, etc.) via `create-next-app`
- Create: `.env.local` (gitignored, holds `ANTHROPIC_API_KEY`)
- Create: `.env.local.example`
- Modify: `tsconfig.json` (ensure `resolveJsonModule: true`)
- Create: `vitest.config.ts`
- Modify: `package.json` (add `test` script)
- Create: `components.json`, `lib/utils.ts`, `components/ui/*` via shadcn CLI

**Interfaces:**
- Produces: a bootable Next.js app at repo root, `@/*` import alias resolving to repo root, `npm test` running Vitest, shadcn `Button`, `Card`, `Badge`, `Separator`, `Checkbox`, `Alert` components available under `components/ui/`.

- [ ] **Step 1: Scaffold the Next.js app**

Run from the repo root (`/Users/mebeon/dev/berlin-de-online-services`, already a git repo with the spec committed):

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --yes
```

- [ ] **Step 2: Verify `resolveJsonModule` is enabled**

Open `tsconfig.json`. Confirm `"compilerOptions"` includes `"resolveJsonModule": true`. If it's missing, add it (Next.js's generated config includes it by default as of current versions, but this project will import `data/services.json` directly, so it's a hard requirement).

- [ ] **Step 3: Install AI SDK and data dependencies**

```bash
npm install ai @ai-sdk/anthropic @ai-sdk/react zod fuse.js
```

- [ ] **Step 4: Install test dependencies**

```bash
npm install -D vitest vite-tsconfig-paths
```

- [ ] **Step 5: Create Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 6: Add the test script**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run"
```

- [ ] **Step 7: Initialize shadcn/ui and add components**

```bash
npx shadcn@latest init -d
npx shadcn@latest add button card badge separator checkbox alert
```

- [ ] **Step 8: Create the env files**

Create `.env.local.example`:

```
ANTHROPIC_API_KEY=
```

Create `.env.local` (this file must already be gitignored by `create-next-app`'s default `.gitignore` — confirm `.env*.local` is listed there) with your real key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

- [ ] **Step 9: Verify the app builds and boots**

```bash
npm run build
```

Expected: build succeeds with no errors.

```bash
npm test
```

Expected: Vitest runs with "No test files found" (no tests exist yet) — this confirms the runner itself works.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Scaffold Next.js app with AI SDK, shadcn/ui, and Vitest"
```

---

### Task 2: Service Data Schema, Loader, and Seed Entry

**Files:**
- Create: `lib/services/schema.ts`
- Create: `lib/services/data.ts`
- Create: `data/services.json`
- Test: `lib/services/schema.test.ts`
- Test: `lib/services/data.test.ts`

**Interfaces:**
- Produces: `Service` and `ClarifyingQuestion` types, `serviceSchema`/`servicesSchema` (Zod), `services: Service[]`, `getServiceById(id: string): Service | undefined` — all consumed by later tool tasks.

- [ ] **Step 1: Write the failing schema test**

Create `lib/services/schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { serviceSchema, servicesSchema } from './schema';

const validService = {
  id: 'anmeldung',
  name: 'Anmeldung',
  description: 'Register your address.',
  keywords: ['move', 'register address'],
  eligibility: 'Anyone moving into a new home in Berlin.',
  requiredDocuments: ['Valid ID'],
  fees: 'Free of charge.',
  processingTime: 'Same day.',
  bookingInfo: {
    office: 'Bürgeramt',
    url: 'https://service.berlin.de/dienstleistung/120697/',
  },
  sourceUrl: 'https://service.berlin.de/dienstleistung/120697/',
};

describe('serviceSchema', () => {
  it('parses a valid service', () => {
    expect(() => serviceSchema.parse(validService)).not.toThrow();
  });

  it('parses a valid service with clarifyingQuestions', () => {
    expect(() =>
      serviceSchema.parse({
        ...validService,
        clarifyingQuestions: [
          { question: 'Which country issued your license?', why: 'Changes the process.' },
        ],
      }),
    ).not.toThrow();
  });

  it('rejects a service missing a required field', () => {
    const { fees: _fees, ...missingFees } = validService;
    expect(() => serviceSchema.parse(missingFees)).toThrow();
  });

  it('rejects a service with an invalid sourceUrl', () => {
    expect(() =>
      serviceSchema.parse({ ...validService, sourceUrl: 'not-a-url' }),
    ).toThrow();
  });
});

describe('servicesSchema', () => {
  it('parses an array of valid services', () => {
    expect(() => servicesSchema.parse([validService])).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
npx vitest run lib/services/schema.test.ts
```

Expected: FAIL — `Cannot find module './schema'`.

- [ ] **Step 3: Implement the schema**

Create `lib/services/schema.ts`:

```ts
import { z } from 'zod';

export const clarifyingQuestionSchema = z.object({
  question: z.string(),
  why: z.string(),
});

export const bookingInfoSchema = z.object({
  office: z.string(),
  url: z.string().url(),
});

export const serviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  keywords: z.array(z.string()),
  eligibility: z.string(),
  requiredDocuments: z.array(z.string()),
  fees: z.string(),
  processingTime: z.string(),
  bookingInfo: bookingInfoSchema,
  sourceUrl: z.string().url(),
  clarifyingQuestions: z.array(clarifyingQuestionSchema).optional(),
});

export const servicesSchema = z.array(serviceSchema);

export type ClarifyingQuestion = z.infer<typeof clarifyingQuestionSchema>;
export type BookingInfo = z.infer<typeof bookingInfoSchema>;
export type Service = z.infer<typeof serviceSchema>;
```

- [ ] **Step 4: Run the test and verify it passes**

```bash
npx vitest run lib/services/schema.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Write the failing loader test**

Create `lib/services/data.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { services, getServiceById } from './data';

describe('services data', () => {
  it('loads at least one valid service', () => {
    expect(services.length).toBeGreaterThan(0);
  });

  it('finds the seeded Anmeldung service by id', () => {
    const anmeldung = getServiceById('anmeldung');
    expect(anmeldung).toBeDefined();
    expect(anmeldung?.name).toContain('Anmeldung');
    expect(anmeldung?.fees).toBe('Free of charge.');
  });

  it('returns undefined for an unknown id', () => {
    expect(getServiceById('does-not-exist')).toBeUndefined();
  });
});
```

- [ ] **Step 6: Run the test and verify it fails**

```bash
npx vitest run lib/services/data.test.ts
```

Expected: FAIL — `Cannot find module './data'` (and `data/services.json` doesn't exist yet).

- [ ] **Step 7: Create the seed dataset**

Create `data/services.json` with one real, verified entry (address registration — a stable, well-documented, fee-free process):

```json
[
  {
    "id": "anmeldung",
    "name": "Anmeldung (Registering your address)",
    "description": "Register your address with the district citizens' office (Bürgeramt) after moving into a new home in Berlin. Required by German law within 14 days of moving in.",
    "keywords": [
      "move", "moving", "moved to berlin", "new address", "register address",
      "residence registration", "wohnsitz", "ummeldung", "anmeldung"
    ],
    "eligibility": "Anyone moving into a new home in Berlin — new residents and people relocating within Berlin — must register within 14 days of moving in.",
    "requiredDocuments": [
      "Valid ID card or passport",
      "Completed 'Anmeldung einer Wohnung' registration form",
      "Wohnungsgeberbestätigung — a written confirmation from your landlord or property owner that you moved in, legally required since 2015"
    ],
    "fees": "Free of charge.",
    "processingTime": "Done on the spot at your appointment; you receive a registration confirmation (Meldebescheinigung) immediately.",
    "bookingInfo": {
      "office": "Bürgeramt (any district citizens' office)",
      "url": "https://service.berlin.de/dienstleistung/120697/"
    },
    "sourceUrl": "https://service.berlin.de/dienstleistung/120697/"
  }
]
```

- [ ] **Step 8: Implement the loader**

Create `lib/services/data.ts`:

```ts
import servicesJson from '@/data/services.json';
import { servicesSchema, type Service } from './schema';

export const services: Service[] = servicesSchema.parse(servicesJson);

export function getServiceById(id: string): Service | undefined {
  return services.find(service => service.id === id);
}
```

- [ ] **Step 9: Run the test and verify it passes**

```bash
npx vitest run lib/services/data.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 10: Commit**

```bash
git add lib/services/schema.ts lib/services/schema.test.ts lib/services/data.ts lib/services/data.test.ts data/services.json
git commit -m "Add service data schema, loader, and seeded Anmeldung entry"
```

---

### Task 3: Curate the Full Services Dataset

**Files:**
- Modify: `data/services.json` (append ~12 more real, researched entries)
- Modify: `lib/services/data.test.ts` (add coverage for the full dataset)

**Interfaces:**
- Consumes: `servicesSchema` from Task 2 (`lib/services/schema.ts`) — every appended entry must satisfy it.
- Produces: no new interfaces; `services`/`getServiceById` from Task 2 now return the full curated set.

This task requires researching real berlin.de content — **do not fabricate fees, documents, or eligibility rules from memory.** For each URL below, fetch the live page (e.g. with a web-fetch tool) and extract the real current details. If a detail isn't visible on the page, write a shorter but honest field rather than inventing specifics (e.g. `"fees": "Check the official page for current fees."` is acceptable; a made-up number is not).

- [ ] **Step 1: Research and add these 12 services to `data/services.json`**

For each, follow the exact `Service` shape from `lib/services/schema.ts` (id, name, description, keywords, eligibility, requiredDocuments, fees, processingTime, bookingInfo, sourceUrl, and optionally clarifyingQuestions). Fetch each `sourceUrl` and base the content on what it says.

| id | Real berlin.de source to fetch |
|---|---|
| `personalausweis` | https://service.berlin.de/dienstleistung/120703/ ("Personalausweis beantragen") |
| `reisepass` | https://service.berlin.de/dienstleistung/121151/ ("Reisepass beantragen") |
| `fuehrungszeugnis` | https://service.berlin.de/dienstleistung/120926/ ("Führungszeugnis beantragen") |
| `kfz-neuzulassung` | https://service.berlin.de/dienstleistung/120882/ ("Erstzulassung eines Fahrzeugs") |
| `kfz-ummeldung-nach-umzug` | https://service.berlin.de/dienstleistung/120918/ ("Kraftfahrzeug ummelden — nach einem Umzug nach Berlin") |
| `fahrerlaubnis-ersterteilung` | https://service.berlin.de/dienstleistung/121627/ ("Fahrerlaubnis — Ersterteilung beantragen") |
| `fuehrerschein-umschreibung-eu-ewr` | https://service.berlin.de/dienstleistung/121598/ ("Umschreibung einer ausländischen Fahrerlaubnis aus einem EU-/EWR-Staat") |
| `fuehrerschein-umschreibung-drittstaat` | https://service.berlin.de/dienstleistung/327537/ ("Umschreibung einer ausländischen Fahrerlaubnis aus einem Nicht-EU/EWR-Land") |
| `gewerbe-anmelden` | https://service.berlin.de/dienstleistung/121921/ ("Gewerbe anmelden") |
| `eheschliessung-anmelden` | https://service.berlin.de/dienstleistung/318961/ ("Eheschließung anmelden") |
| `geburt-melden` | https://service.berlin.de/dienstleistung/318957/ ("Geburt eines Kindes melden") |
| `einbuergerung` | https://service.berlin.de/dienstleistung/318998/ ("Einbürgerung — Verleihung der deutschen Staatsangehörigkeit beantragen") |

For the two driving-license-conversion entries (`fuehrerschein-umschreibung-eu-ewr` and `fuehrerschein-umschreibung-drittstaat`), give both **overlapping keywords** (e.g. both should include `"driving license"`, `"führerschein"`, `"convert license"`, `"foreign license"`) so a generic query like "convert my driving license" matches both — this is what makes the agent's disambiguating question ("which country issued your license?") necessary in Task 6's system instructions. Do not add a `clarifyingQuestions` field to these two — the disambiguation happens at the search-results level (two candidate services), not within one record.

- [ ] **Step 2: Update the loader test to cover the full dataset**

Replace the contents of `lib/services/data.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { services, getServiceById } from './data';

describe('services data', () => {
  it('loads at least 12 services', () => {
    expect(services.length).toBeGreaterThanOrEqual(12);
  });

  it('finds the seeded Anmeldung service by id', () => {
    const anmeldung = getServiceById('anmeldung');
    expect(anmeldung).toBeDefined();
    expect(anmeldung?.fees).toBe('Free of charge.');
  });

  it('returns undefined for an unknown id', () => {
    expect(getServiceById('does-not-exist')).toBeUndefined();
  });

  it('has both driving license conversion variants with a shared keyword', () => {
    const eu = getServiceById('fuehrerschein-umschreibung-eu-ewr');
    const nonEu = getServiceById('fuehrerschein-umschreibung-drittstaat');
    expect(eu).toBeDefined();
    expect(nonEu).toBeDefined();
    expect(eu?.keywords).toContain('führerschein');
    expect(nonEu?.keywords).toContain('führerschein');
  });

  it('gives every service a working sourceUrl pointing at service.berlin.de', () => {
    for (const service of services) {
      expect(service.sourceUrl).toMatch(/^https:\/\/service\.berlin\.de\//);
    }
  });
});
```

- [ ] **Step 3: Run the tests and verify they pass**

```bash
npx vitest run lib/services/data.test.ts
```

Expected: PASS (5 tests). Since `data.ts` calls `servicesSchema.parse()` on load, any malformed entry from Step 1 will already have failed loudly here — fix the JSON if so.

- [ ] **Step 4: Commit**

```bash
git add data/services.json lib/services/data.test.ts
git commit -m "Curate full v1 services dataset from real berlin.de listings"
```

---

### Task 4: Search Tool

**Files:**
- Create: `lib/services/search.ts`
- Create: `lib/tools/search-services.ts`
- Test: `lib/services/search.test.ts`

**Interfaces:**
- Consumes: `services: Service[]` from `lib/services/data.ts` (Task 2/3).
- Produces: `searchServices(query: string): ServiceSearchResult[]` where `ServiceSearchResult = { id: string; name: string; summary: string }`; `searchServicesTool` (an AI SDK `tool()`), consumed by the agent in Task 6.

- [ ] **Step 1: Write the failing test**

Create `lib/services/search.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { searchServices } from './search';

describe('searchServices', () => {
  it('finds Anmeldung for a query about moving to Berlin', () => {
    const results = searchServices('I just moved to Berlin, what do I need to do');
    expect(results.some(r => r.id === 'anmeldung')).toBe(true);
  });

  it('finds both driving license conversion services for a generic query', () => {
    const results = searchServices('convert my foreign driving license');
    const ids = results.map(r => r.id);
    expect(ids).toContain('fuehrerschein-umschreibung-eu-ewr');
    expect(ids).toContain('fuehrerschein-umschreibung-drittstaat');
  });

  it('returns an empty array for a nonsense query', () => {
    const results = searchServices('zzz qqq nonexistent gibberish 12345');
    expect(results).toEqual([]);
  });

  it('returns at most 5 results', () => {
    const results = searchServices('a');
    expect(results.length).toBeLessThanOrEqual(5);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
npx vitest run lib/services/search.test.ts
```

Expected: FAIL — `Cannot find module './search'`.

- [ ] **Step 3: Implement the search function**

Create `lib/services/search.ts`:

```ts
import Fuse from 'fuse.js';
import { services } from './data';

export interface ServiceSearchResult {
  id: string;
  name: string;
  summary: string;
}

const fuse = new Fuse(services, {
  keys: ['name', 'description', 'keywords'],
  threshold: 0.4,
  ignoreLocation: true,
});

export function searchServices(query: string): ServiceSearchResult[] {
  return fuse
    .search(query)
    .slice(0, 5)
    .map(({ item }) => ({
      id: item.id,
      name: item.name,
      summary: item.description,
    }));
}
```

- [ ] **Step 4: Run the test and verify it passes**

```bash
npx vitest run lib/services/search.test.ts
```

Expected: PASS (4 tests). If the "nonsense query" test fails because Fuse still fuzzy-matches something, raise the check by lowering `threshold` (e.g. to `0.3`) and re-run.

- [ ] **Step 5: Write the failing tool test**

Create `lib/tools/search-services.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { searchServicesTool } from './search-services';

describe('searchServicesTool', () => {
  it('wraps searchServices and returns results', async () => {
    const output = await searchServicesTool.execute!(
      { query: 'moved to berlin' },
      { toolCallId: 'test-call', messages: [], context: {} },
    );
    expect(output.results.some(r => r.id === 'anmeldung')).toBe(true);
  });
});
```

- [ ] **Step 6: Run the test and verify it fails**

```bash
npx vitest run lib/tools/search-services.test.ts
```

Expected: FAIL — `Cannot find module './search-services'`.

- [ ] **Step 7: Implement the tool**

Create `lib/tools/search-services.ts`:

```ts
import { tool } from 'ai';
import { z } from 'zod';
import { searchServices } from '@/lib/services/search';

export const searchServicesTool = tool({
  description:
    'Search the curated Berlin city services for ones matching what the user wants to get done. Returns up to 5 candidate services with id, name, and a short summary. If a query could plausibly match more than one distinct service, all of them are returned — check whether they differ on a fact you do not yet know before recommending one.',
  inputSchema: z.object({
    query: z.string().describe("The user's need, described in a few words"),
  }),
  execute: async ({ query }) => {
    const results = searchServices(query);
    return { results };
  },
});
```

- [ ] **Step 8: Run the test and verify it passes**

```bash
npx vitest run lib/tools/search-services.test.ts
```

Expected: PASS (1 test).

- [ ] **Step 9: Commit**

```bash
git add lib/services/search.ts lib/services/search.test.ts lib/tools/search-services.ts lib/tools/search-services.test.ts
git commit -m "Add search_services tool with keyword search over the curated dataset"
```

---

### Task 5: Get Service Details Tool

**Files:**
- Create: `lib/tools/get-service-details.ts`
- Test: `lib/tools/get-service-details.test.ts`

**Interfaces:**
- Consumes: `getServiceById(id: string): Service | undefined` from `lib/services/data.ts` (Task 2).
- Produces: `getServiceDetailsTool` (an AI SDK `tool()`) and `GetServiceDetailsInvocation` type, consumed by the agent in Task 6 and the UI in Task 8.

- [ ] **Step 1: Write the failing test**

Create `lib/tools/get-service-details.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getServiceDetailsTool } from './get-service-details';

describe('getServiceDetailsTool', () => {
  it('returns the full service record for a known id', async () => {
    const output = await getServiceDetailsTool.execute!(
      { serviceId: 'anmeldung' },
      { toolCallId: 'test-call', messages: [], context: {} },
    );
    expect(output.service?.id).toBe('anmeldung');
    expect(output.service?.requiredDocuments.length).toBeGreaterThan(0);
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

- [ ] **Step 2: Run the test and verify it fails**

```bash
npx vitest run lib/tools/get-service-details.test.ts
```

Expected: FAIL — `Cannot find module './get-service-details'`.

- [ ] **Step 3: Implement the tool**

Create `lib/tools/get-service-details.ts`:

```ts
import { tool, type UIToolInvocation } from 'ai';
import { z } from 'zod';
import { getServiceById } from '@/lib/services/data';
import type { Service } from '@/lib/services/schema';

export const getServiceDetailsTool = tool({
  description:
    'Get the full details for a specific Berlin city service by id, including required documents, eligibility, fees, processing time, booking info, and any clarifyingQuestions that must be resolved before giving the user accurate guidance. Call this only after a service has been identified via search_services and confirmed with the user.',
  inputSchema: z.object({
    serviceId: z
      .string()
      .describe('The id of the service, taken from search_services results'),
  }),
  execute: async ({ serviceId }): Promise<{ service?: Service; error?: string }> => {
    const service = getServiceById(serviceId);
    if (!service) {
      return { error: `No service found with id "${serviceId}"` };
    }
    return { service };
  },
});

export type GetServiceDetailsInvocation = UIToolInvocation<typeof getServiceDetailsTool>;
```

- [ ] **Step 4: Run the test and verify it passes**

```bash
npx vitest run lib/tools/get-service-details.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/tools/get-service-details.ts lib/tools/get-service-details.test.ts
git commit -m "Add get_service_details tool"
```

---

### Task 6: Agent and Chat API Route

**Files:**
- Create: `lib/agents/berlin-services-agent.ts`
- Create: `app/api/chat/route.ts`

**Interfaces:**
- Consumes: `searchServicesTool` (Task 4), `getServiceDetailsTool` (Task 5).
- Produces: `berlinServicesAgent: ToolLoopAgent`, `type BerlinServicesUIMessage` — consumed by `app/page.tsx` in Task 7.

There is no automated test for this task — the agent's conversational behavior (asking clarifying questions, avoiding hallucination) is inherently a judgment call by the model, not something a unit test can verify. It is checked manually in Task 9, per the spec's "Testing (v1, pre-Langfuse)" section. This task's own verification is a build/type check plus one manual smoke request.

- [ ] **Step 1: Implement the agent**

Create `lib/agents/berlin-services-agent.ts`:

```ts
import { ToolLoopAgent, InferAgentUIMessage, isStepCount } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { searchServicesTool } from '@/lib/tools/search-services';
import { getServiceDetailsTool } from '@/lib/tools/get-service-details';

const SYSTEM_INSTRUCTIONS = `You are an unofficial assistant that helps people figure out which Berlin city service (from service.berlin.de) they need, and get ready for it.

You only know about the services described by the search_services and get_service_details tools. You have no other knowledge of berlin.de services — never invent a service, document, fee, eligibility rule, or booking process from general knowledge.

Follow this flow:
1. When the user describes a need, call search_services with a short query capturing their intent.
2. If search_services returns nothing relevant, say so plainly and suggest browsing the full list at https://service.berlin.de/dienstleistungen/. Do not guess a service.
3. If search_services returns multiple plausible matches that require different information to tell apart — for example, converting a foreign driving license depends on which country issued it, since EU/EEA and non-EU/EEA licenses are handled by different services with different requirements — ask the user for that missing fact before recommending one. Do not pick one arbitrarily.
4. Once you and the user agree on a service, call get_service_details with its id.
5. If the returned service has a clarifyingQuestions field with questions not yet answered in the conversation, ask them before presenting the checklist. Only proceed once you have the facts you need to be accurate for this specific user.
6. Present the "get ready" checklist using ONLY what's in the tool result: required documents, eligibility, fees, processing time, and how/where to book. Always mention the service's sourceUrl so the user can verify against the official page.
7. If the user asks about something the tool result doesn't cover, say you don't have that detail and point them to the sourceUrl rather than guessing.

You never book appointments on the user's behalf — you only explain how and where to book.

You are an unofficial, independent assistant, not an official City of Berlin product. Make that clear if it's relevant to the conversation.`;

export const berlinServicesAgent = new ToolLoopAgent({
  model: anthropic('claude-sonnet-5'),
  instructions: SYSTEM_INSTRUCTIONS,
  tools: {
    search_services: searchServicesTool,
    get_service_details: getServiceDetailsTool,
  },
  stopWhen: isStepCount(8),
});

export type BerlinServicesUIMessage = InferAgentUIMessage<typeof berlinServicesAgent>;
```

- [ ] **Step 2: Implement the API route**

Create `app/api/chat/route.ts`:

```ts
import { createAgentUIStreamResponse } from 'ai';
import { berlinServicesAgent } from '@/lib/agents/berlin-services-agent';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  return createAgentUIStreamResponse({
    agent: berlinServicesAgent,
    uiMessages: messages,
  });
}
```

- [ ] **Step 3: Type-check and build**

```bash
npx tsc --noEmit
npm run build
```

Expected: both succeed with no errors.

- [ ] **Step 4: Manual smoke test of the route**

Start the dev server:

```bash
npm run dev
```

In a second terminal, send a request shaped like the client will send (replace the message id if you like):

```bash
curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"id":"1","role":"user","parts":[{"type":"text","text":"I just moved to Berlin, what do I need to do?"}]}]}'
```

Expected: a streamed response (SSE-style chunks) that, read as text, shows the model calling `search_services` and then responding about Anmeldung. Stop the dev server after confirming this (`Ctrl+C`).

- [ ] **Step 5: Commit**

```bash
git add lib/agents/berlin-services-agent.ts app/api/chat/route.ts
git commit -m "Add ToolLoopAgent and chat API route"
```

---

### Task 7: Chat UI Shell

**Files:**
- Modify: `app/page.tsx`
- Create: `components/chat/message.tsx`
- Create: `components/chat/disclaimer.tsx`

**Interfaces:**
- Consumes: `BerlinServicesUIMessage` (Task 6).
- Produces: a working chat page rendering plain text turns; structured tool-result rendering is added on top of this in Task 8.

- [ ] **Step 1: Create the disclaimer component**

Create `components/chat/disclaimer.tsx`:

```tsx
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function Disclaimer() {
  return (
    <Alert className="mb-4">
      <AlertTitle>Unofficial tool</AlertTitle>
      <AlertDescription>
        This is an independent, unofficial assistant and is not affiliated with the City of
        Berlin. Always verify details on{' '}
        <a
          href="https://service.berlin.de/dienstleistungen/"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          service.berlin.de
        </a>
        .
      </AlertDescription>
    </Alert>
  );
}
```

- [ ] **Step 2: Create the message component (text parts only for now)**

Create `components/chat/message.tsx`:

```tsx
import type { BerlinServicesUIMessage } from '@/lib/agents/berlin-services-agent';

export function Message({ message }: { message: BerlinServicesUIMessage }) {
  return (
    <div className="whitespace-pre-wrap">
      <strong>{message.role === 'user' ? 'You: ' : 'Assistant: '}</strong>
      {message.parts.map((part, i) => {
        if (part.type === 'text') {
          return <span key={i}>{part.text}</span>;
        }
        return null;
      })}
    </div>
  );
}
```

- [ ] **Step 3: Wire up the chat page**

Replace the contents of `app/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { BerlinServicesUIMessage } from '@/lib/agents/berlin-services-agent';
import { Message } from '@/components/chat/message';
import { Disclaimer } from '@/components/chat/disclaimer';
import { Button } from '@/components/ui/button';

export default function Chat() {
  const [input, setInput] = useState('');
  const { messages, sendMessage } = useChat<BerlinServicesUIMessage>({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput('');
  };

  return (
    <div className="flex flex-col w-full max-w-2xl py-12 mx-auto gap-4 px-4">
      <h1 className="text-xl font-semibold">Berlin Services Assistant (unofficial)</h1>
      <Disclaimer />

      <div className="flex flex-col gap-3">
        {messages.map(message => (
          <Message key={message.id} message={message} />
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 sticky bottom-4">
        <input
          className="flex-1 border rounded px-3 py-2 bg-background"
          value={input}
          placeholder="What do you need to get done?"
          onChange={e => setInput(e.target.value)}
        />
        <Button type="submit">Send</Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Verify in the browser**

```bash
npm run dev
```

Open `http://localhost:3000` in a browser. Type "I just moved to Berlin, what do I need to do?" and send it. Expected: the page shows your message, then (after a delay) the assistant's text response mentioning Anmeldung. Stop the dev server after confirming.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx components/chat/message.tsx components/chat/disclaimer.tsx
git commit -m "Add chat UI shell with text rendering"
```

---

### Task 8: Structured Tool-Result Rendering

**Files:**
- Create: `components/chat/service-search-results.tsx`
- Create: `components/chat/service-details-card.tsx`
- Modify: `components/chat/message.tsx`

**Interfaces:**
- Consumes: `UIToolInvocation`-typed parts for `tool-search_services` and `tool-get_service_details` (from Tasks 4 and 5's tool definitions, inferred automatically via `BerlinServicesUIMessage`).
- Produces: clickable search-result cards and a structured "get ready" checklist card.

- [ ] **Step 1: Create the search results component**

Create `components/chat/service-search-results.tsx`:

```tsx
import type { UIToolInvocation } from 'ai';
import type { searchServicesTool } from '@/lib/tools/search-services';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Invocation = UIToolInvocation<typeof searchServicesTool>;

export function ServiceSearchResults({
  invocation,
  onSelect,
}: {
  invocation: Invocation;
  onSelect: (serviceName: string) => void;
}) {
  if (invocation.state === 'input-streaming' || invocation.state === 'input-available') {
    return <p className="text-sm text-muted-foreground">Searching services…</p>;
  }

  if (invocation.state === 'output-error') {
    return <p className="text-sm text-destructive">Error searching services.</p>;
  }

  const { results } = invocation.output;

  if (results.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No matching services found in the curated list.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {results.map(result => (
        <Card key={result.id} className="p-3 flex flex-col gap-2">
          <div className="font-medium">{result.name}</div>
          <p className="text-sm text-muted-foreground">{result.summary}</p>
          <Button
            size="sm"
            variant="outline"
            className="self-start"
            onClick={() => onSelect(result.name)}
          >
            Tell me more about this
          </Button>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create the service details card**

Create `components/chat/service-details-card.tsx`:

```tsx
import type { UIToolInvocation } from 'ai';
import type { getServiceDetailsTool } from '@/lib/tools/get-service-details';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

type Invocation = UIToolInvocation<typeof getServiceDetailsTool>;

export function ServiceDetailsCard({ invocation }: { invocation: Invocation }) {
  if (invocation.state === 'input-streaming' || invocation.state === 'input-available') {
    return <p className="text-sm text-muted-foreground">Looking up service details…</p>;
  }

  if (invocation.state === 'output-error') {
    return <p className="text-sm text-destructive">Error looking up service details.</p>;
  }

  const { service, error } = invocation.output;

  if (!service) {
    return <p className="text-sm text-destructive">{error ?? 'Service not found.'}</p>;
  }

  return (
    <Card className="p-4 flex flex-col gap-3">
      <div>
        <div className="font-semibold">{service.name}</div>
        <Badge variant="secondary" className="mt-1">
          {service.bookingInfo.office}
        </Badge>
      </div>

      <Separator />

      <div>
        <div className="text-sm font-medium mb-1">Eligibility</div>
        <p className="text-sm text-muted-foreground">{service.eligibility}</p>
      </div>

      <div>
        <div className="text-sm font-medium mb-1">Documents to bring</div>
        <ul className="list-disc list-inside text-sm text-muted-foreground">
          {service.requiredDocuments.map((doc, i) => (
            <li key={i}>{doc}</li>
          ))}
        </ul>
      </div>

      <div className="flex gap-6">
        <div>
          <div className="text-sm font-medium mb-1">Fees</div>
          <p className="text-sm text-muted-foreground">{service.fees}</p>
        </div>
        <div>
          <div className="text-sm font-medium mb-1">Processing time</div>
          <p className="text-sm text-muted-foreground">{service.processingTime}</p>
        </div>
      </div>

      <Separator />

      <div className="flex gap-4 text-sm">
        <a
          href={service.bookingInfo.url}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Book an appointment
        </a>
        <a href={service.sourceUrl} target="_blank" rel="noreferrer" className="underline">
          View official page
        </a>
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: Wire both into the message component**

Replace the contents of `components/chat/message.tsx`:

```tsx
'use client';

import type { BerlinServicesUIMessage } from '@/lib/agents/berlin-services-agent';
import { ServiceSearchResults } from '@/components/chat/service-search-results';
import { ServiceDetailsCard } from '@/components/chat/service-details-card';

export function Message({
  message,
  onSelectService,
}: {
  message: BerlinServicesUIMessage;
  onSelectService: (serviceName: string) => void;
}) {
  return (
    <div className="whitespace-pre-wrap">
      <strong>{message.role === 'user' ? 'You: ' : 'Assistant: '}</strong>
      {message.parts.map((part, i) => {
        switch (part.type) {
          case 'text':
            return <span key={i}>{part.text}</span>;
          case 'tool-search_services':
            return (
              <div key={i} className="mt-2">
                <ServiceSearchResults invocation={part} onSelect={onSelectService} />
              </div>
            );
          case 'tool-get_service_details':
            return (
              <div key={i} className="mt-2">
                <ServiceDetailsCard invocation={part} />
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
```

- [ ] **Step 4: Pass a select handler from the page**

In `app/page.tsx`, update the message rendering loop to pass `onSelectService`, which sends a follow-up user message naming the chosen service:

```tsx
{messages.map(message => (
  <Message
    key={message.id}
    message={message}
    onSelectService={serviceName => sendMessage({ text: `Tell me more about: ${serviceName}` })}
  />
))}
```

- [ ] **Step 5: Verify in the browser**

```bash
npm run dev
```

Open `http://localhost:3000`. Ask "I need a new passport." Expected: a search-results card appears with a "Tell me more about this" button; clicking it sends a follow-up and a details card renders with documents, fees, processing time, and working links to berlin.de. Stop the dev server after confirming.

- [ ] **Step 6: Commit**

```bash
git add components/chat/service-search-results.tsx components/chat/service-details-card.tsx components/chat/message.tsx app/page.tsx
git commit -m "Render structured search results and service details cards"
```

---

### Task 9: End-to-End Manual Verification

**Files:** none (no code changes — this task exercises the running app per the spec's "Testing (v1, pre-Langfuse)" section).

- [ ] **Step 1: Run the full automated test suite**

```bash
npm test
npx tsc --noEmit
npm run build
```

Expected: all pass with no errors.

- [ ] **Step 2: Start the app and open it in a browser**

```bash
npm run dev
```

Navigate to `http://localhost:3000`.

- [ ] **Step 3: Run through the verification script from the spec**

For each query, confirm the behavior matches what's described (from `docs/superpowers/specs/2026-07-14-berlin-services-chatbot-design.md`, "Testing" section):

1. **Clear match:** "I need a new passport." → recommends Reisepass, checklist has real documents/fees/link.
2. **Ambiguous across services:** "I need to convert my driving license." → the assistant asks which country issued the license (does *not* pick EU/EWR or non-EU/EWR arbitrarily). Answer "France" → it proceeds with the EU/EWR service. Start a fresh chat and answer "India" instead → it proceeds with the non-EU/EWR service.
3. **No good match:** "I want to adopt a shelter dog." → the assistant says it doesn't have a matching curated service and points to the full berlin.de list, rather than inventing one.
4. **Follow-up question:** after getting a details checklist (e.g. for Anmeldung), ask "what if I don't have the landlord confirmation?" → the assistant answers only using what's in the data or says it doesn't have that detail, without inventing a workaround.
5. **No hallucination spot-check:** for any presented checklist, confirm every document/fee/eligibility claim traces back to what you saw in the curated `data/services.json` entry for that service.

- [ ] **Step 4: Record the outcome**

If all five behaviors check out, v1 is functionally complete. If any fail, file it as a follow-up — most likely fixes are to `SYSTEM_INSTRUCTIONS` in `lib/agents/berlin-services-agent.ts` (Task 6) or to a specific `data/services.json` entry (Task 3), not to the tool/UI code.

- [ ] **Step 5: Stop the dev server and do a final commit if anything changed**

```bash
git status
```

If Step 4 required fixes, stage and commit them with a message describing what was wrong and what changed.

---

## Deployment (manual, after this plan)

This plan covers local build + manual verification only. Deploying to Vercel (per the spec's architecture) requires your own Vercel account and an `ANTHROPIC_API_KEY` set as a project environment variable — do this yourself via `vercel link` and `vercel env add ANTHROPIC_API_KEY`, then `vercel deploy` for a preview URL, once you're happy with local behavior.
