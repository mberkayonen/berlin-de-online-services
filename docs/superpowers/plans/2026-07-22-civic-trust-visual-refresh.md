# Civic Trust Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the existing Berlin Services Assistant chat UI with the "Civic Trust" navy/red palette and three validated UX additions (example-prompt chips, styled chat bubbles, an enriched checklist card) — presentation only, no behavioral changes.

**Architecture:** Retheme via shadcn's existing CSS token system in `app/globals.css` so `Button`/`Card`/`Badge` re-skin automatically, then update the chat components that render on top of those tokens. Two components are pure restyles of existing markup (`service-details-card.tsx`, `disclaimer.tsx`); `message.tsx` gets restructured to use bubbles instead of a plain prefixed line; one new component (`prompt-chips.tsx`) is added.

**Tech Stack:** Next.js (App Router), Tailwind CSS v4, shadcn/ui — same stack as v1, no new dependencies.

## Global Constraints

- Presentation only: no changes to `lib/agents/`, `lib/tools/`, `lib/services/`, `data/services.json`, or `app/api/chat/route.ts`.
- Light theme only — do not add a dark mode toggle or touch the existing `.dark` class block in `app/globals.css`.
- No new automated tests: this is a UI-only, non-behavioral change (consistent with how v1's UI tasks were verified) — verification is manual browser checks plus running the existing suite to confirm nothing broke.
- Exact palette (use these hex values verbatim, do not approximate):
  - Primary (navy): `#1a3a5c` / primary-foreground: `#ffffff`
  - Background: `#f7f8fa` / Foreground: `#1f2d3a`
  - Card & Popover: `#ffffff` / their foreground: `#1f2d3a`
  - Secondary & Accent: `#eef2f6` / their foreground: `#1a3a5c`
  - Muted: `#eef2f6` / Muted-foreground: `#5a6b7a`
  - Destructive (Berlin red, also used for the header status dot): `#e2413a`
  - Border & Input: `#d8dde3`
  - Ring: `#1a3a5c`
- Disclaimer copy (verbatim, unchanged from v1): "Unofficial, independent tool — not affiliated with the City of Berlin. Always verify details on service.berlin.de." with a link to `https://service.berlin.de/dienstleistungen/`.
- Example prompts (verbatim): "I just moved to Berlin, what do I need to do?", "I need a new passport", "Convert my foreign driving license".
- Package manager: npm.

---

### Task 1: Civic Trust Color Tokens

**Files:**
- Modify: `app/globals.css:52-84` (the `:root` block only — do not touch the `@theme inline` block or the `.dark` block)

**Interfaces:**
- Produces: new values for the CSS custom properties `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--border`, `--input`, `--ring`. These are consumed automatically by every shadcn component in the app (`Button`, `Card`, `Badge`, `Alert`) — no component code changes are needed for this task alone to take visible effect.

- [ ] **Step 1: Replace the `:root` block's color values**

In `app/globals.css`, replace the `:root { ... }` block (currently lines 51-84) with:

```css
:root {
  --background: #f7f8fa;
  --foreground: #1f2d3a;
  --card: #ffffff;
  --card-foreground: #1f2d3a;
  --popover: #ffffff;
  --popover-foreground: #1f2d3a;
  --primary: #1a3a5c;
  --primary-foreground: #ffffff;
  --secondary: #eef2f6;
  --secondary-foreground: #1a3a5c;
  --muted: #eef2f6;
  --muted-foreground: #5a6b7a;
  --accent: #eef2f6;
  --accent-foreground: #1a3a5c;
  --destructive: #e2413a;
  --border: #d8dde3;
  --input: #d8dde3;
  --ring: #1a3a5c;
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --radius: 0.625rem;
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}
```

Note: `--chart-*` and `--sidebar-*` values are left as their original oklch values — nothing in this app uses charts or a sidebar, so they're inert. Do not touch the `@theme inline` block above `:root`, and do not touch the `.dark { ... }` block below it (dark mode is out of scope for this pass).

- [ ] **Step 2: Verify the build**

```bash
npx tsc --noEmit
npm run build
```

Expected: both succeed with no errors (this is a CSS-only change, so this mainly confirms nothing else broke).

- [ ] **Step 3: Visually verify in the browser**

Start the dev server and open `http://localhost:3000`. Confirm the page background is now a light blue-gray (`#f7f8fa`) instead of white, and the "Send" button is navy instead of black (it's using `--primary` via the shadcn `Button` component's default variant). Stop the dev server after confirming.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "Apply Civic Trust color palette to theme tokens"
```

---

### Task 2: Chat Message Bubbles

**Files:**
- Modify: `components/chat/message.tsx` (full rewrite of the component body)

**Interfaces:**
- Consumes: `BerlinServicesUIMessage` type from `@/lib/agents/berlin-services-agent` (unchanged from v1), `ServiceSearchResults` and `ServiceDetailsCard` components (unchanged props from v1).
- Produces: `Message({ message, onSelectService })` — **same exported name and prop signature as before**, so `app/page.tsx`'s existing usage does not need to change for this task.

**Design note:** this task removes the "You: " / "Assistant: " text prefix that v1 had — role is now conveyed by bubble alignment and color instead (navy filled + right-aligned for the user, white bordered + left-aligned for the assistant), matching the approved mockup. This is an intentional behavior change, not an oversight.

- [ ] **Step 1: Replace the component**

Replace the full contents of `components/chat/message.tsx`:

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
  const isUser = message.role === 'user';

  return (
    <div className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
      {message.parts.map((part, i) => {
        switch (part.type) {
          case 'text':
            return (
              <div
                key={i}
                className={
                  isUser
                    ? 'max-w-[75%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground whitespace-pre-wrap'
                    : 'max-w-[75%] rounded-2xl rounded-bl-sm border bg-card px-4 py-2 text-sm text-card-foreground whitespace-pre-wrap'
                }
              >
                {part.text}
              </div>
            );
          case 'tool-search_services':
            return (
              <div key={i} className="w-full max-w-[80%]">
                <ServiceSearchResults invocation={part} onSelect={onSelectService} />
              </div>
            );
          case 'tool-get_service_details':
            return (
              <div key={i} className="w-full max-w-[80%]">
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

- [ ] **Step 2: Verify the build**

```bash
npx tsc --noEmit
npm run build
```

Expected: both succeed with no errors.

- [ ] **Step 3: Visually verify in the browser**

Start the dev server, open `http://localhost:3000`, and send a message (e.g. "I need a new passport"). Confirm: your message appears as a navy bubble on the right, the assistant's text reply appears as a white bordered bubble on the left, and neither shows a "You:"/"Assistant:" label. Stop the dev server after confirming.

- [ ] **Step 4: Commit**

```bash
git add components/chat/message.tsx
git commit -m "Add styled chat bubbles, remove role text prefix"
```

---

### Task 3: Example Prompt Chips

**Files:**
- Create: `components/chat/prompt-chips.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Produces: `PromptChips({ onSelect }: { onSelect: (prompt: string) => void })`, consumed by `app/page.tsx`.

- [ ] **Step 1: Create the prompt chips component**

Create `components/chat/prompt-chips.tsx`:

```tsx
'use client';

const EXAMPLE_PROMPTS = [
  'I just moved to Berlin, what do I need to do?',
  'I need a new passport',
  'Convert my foreign driving license',
];

export function PromptChips({ onSelect }: { onSelect: (prompt: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs text-muted-foreground">Try asking:</div>
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_PROMPTS.map(prompt => (
          <button
            key={prompt}
            type="button"
            onClick={() => onSelect(prompt)}
            className="rounded-full border bg-card px-3 py-1.5 text-sm text-card-foreground hover:bg-secondary"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the page and add the header status dot**

Replace the full contents of `app/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { BerlinServicesUIMessage } from '@/lib/agents/berlin-services-agent';
import { Message } from '@/components/chat/message';
import { Disclaimer } from '@/components/chat/disclaimer';
import { PromptChips } from '@/components/chat/prompt-chips';
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
      <h1 className="flex items-center gap-2 text-xl font-semibold">
        <span className="inline-block h-2 w-2 rounded-full bg-destructive" />
        Berlin Services Assistant (unofficial)
      </h1>
      <Disclaimer />

      {messages.length === 0 && (
        <PromptChips onSelect={prompt => sendMessage({ text: prompt })} />
      )}

      <div className="flex flex-col gap-3">
        {messages.map(message => (
          <Message
            key={message.id}
            message={message}
            onSelectService={serviceName => sendMessage({ text: `Tell me more about: ${serviceName}` })}
          />
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

- [ ] **Step 3: Verify the build**

```bash
npx tsc --noEmit
npm run build
```

Expected: both succeed with no errors.

- [ ] **Step 4: Visually verify in the browser**

Start the dev server, open `http://localhost:3000`. Confirm: a small red dot appears before the page title, the 3 example prompt chips render below the disclaimer since the conversation is empty, and clicking one immediately sends it as a message (chips should disappear once `messages.length > 0`). Stop the dev server after confirming.

- [ ] **Step 5: Commit**

```bash
git add components/chat/prompt-chips.tsx app/page.tsx
git commit -m "Add example prompt chips and header status dot"
```

---

### Task 4: Enriched Service Details Card

**Files:**
- Modify: `components/chat/service-details-card.tsx`

**Interfaces:**
- Consumes: `GetServiceDetailsInvocation`/`UIToolInvocation<typeof getServiceDetailsTool>` (unchanged from v1), `Service` type fields (unchanged from v1: `name`, `bookingInfo.office`, `eligibility`, `requiredDocuments`, `fees`, `processingTime`, `bookingInfo.url`, `sourceUrl`).
- Produces: `ServiceDetailsCard({ invocation })` — **same exported name and prop signature as before**, so `components/chat/message.tsx` (Task 2) does not need further changes for this task.

**Important:** the `input-streaming`/`input-available`/`output-error`/`state !== 'output-available'` guard clauses at the top of the component were deliberately added and independently verified in a prior task (they resolve a real AI SDK typing issue around unreachable approval states). Do not remove or restructure them — only restyle the `output-available` branch below them.

- [ ] **Step 1: Replace the component**

Replace the full contents of `components/chat/service-details-card.tsx`:

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

  if (invocation.state !== 'output-available') {
    return null;
  }

  const { service, error } = invocation.output;

  if (!service) {
    return <p className="text-sm text-destructive">{error ?? 'Service not found.'}</p>;
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between bg-secondary px-4 py-3">
        <div className="font-semibold text-secondary-foreground">{service.name}</div>
        <Badge className="bg-primary text-primary-foreground">{service.bookingInfo.office}</Badge>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div>
          <div className="text-sm font-medium mb-1">Eligibility</div>
          <p className="text-sm text-muted-foreground">{service.eligibility}</p>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Bring with you
          </div>
          <div className="flex flex-col gap-1.5">
            {service.requiredDocuments.map((doc, i) => (
              <div key={i} className="flex gap-2 text-sm text-foreground">
                <span className="text-primary">✓</span>
                {doc}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Fees
            </div>
            <div className="text-sm text-foreground">{service.fees}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Processing
            </div>
            <div className="text-sm text-foreground">{service.processingTime}</div>
          </div>
        </div>

        <Separator />

        <div className="flex gap-4 text-sm">
          <a
            href={service.bookingInfo.url}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            Book an appointment
          </a>
          <a
            href={service.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            View official page
          </a>
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Verify the build**

```bash
npx tsc --noEmit
npm run build
```

Expected: both succeed with no errors.

- [ ] **Step 3: Visually verify in the browser**

Start the dev server, ask "I need a new passport", and confirm the details card shows: a navy-tinted header row with the service name and an office badge, a "Bring with you" section with checkmarked documents, a two-column Fees/Processing row, and both links working. Stop the dev server after confirming.

- [ ] **Step 4: Commit**

```bash
git add components/chat/service-details-card.tsx
git commit -m "Restyle service details card with header row and checkmarked documents"
```

---

### Task 5: Quieter Disclaimer Strip

**Files:**
- Modify: `components/chat/disclaimer.tsx`

**Interfaces:**
- Produces: `Disclaimer()` — **same exported name and no props, unchanged**, so `app/page.tsx` does not need further changes for this task.

- [ ] **Step 1: Replace the component**

Replace the full contents of `components/chat/disclaimer.tsx`:

```tsx
export function Disclaimer() {
  return (
    <div className="w-full rounded-md bg-secondary px-4 py-2 text-center text-xs text-muted-foreground">
      Unofficial, independent tool — not affiliated with the City of Berlin. Always verify
      details on{' '}
      <a
        href="https://service.berlin.de/dienstleistungen/"
        target="_blank"
        rel="noreferrer"
        className="underline"
      >
        service.berlin.de
      </a>
      .
    </div>
  );
}
```

This drops the `Alert`/`AlertTitle`/`AlertDescription` import in favor of a plain styled `div`, matching the thin-strip design from the approved mockup. The `Alert` shadcn component itself is untouched and may still be used elsewhere later — this task only stops using it here.

- [ ] **Step 2: Verify the build**

```bash
npx tsc --noEmit
npm run build
```

Expected: both succeed with no errors.

- [ ] **Step 3: Visually verify in the browser**

Start the dev server, open `http://localhost:3000`, and confirm the disclaimer now renders as a thin, centered, light-blue strip instead of a boxed `Alert` with a title. Confirm the link still works. Stop the dev server after confirming.

- [ ] **Step 4: Commit**

```bash
git add components/chat/disclaimer.tsx
git commit -m "Restyle disclaimer as a thin strip instead of a boxed alert"
```

---

### Task 6: End-to-End Manual Verification

**Files:** none (no code changes — this task exercises the running app per the spec's "Testing" section).

- [ ] **Step 1: Run the full automated test suite**

```bash
npm test
npx tsc --noEmit
npm run build
```

Expected: all pass with no errors (confirms this visual-only pass didn't break any v1 functionality — the agent, tools, and data are untouched, but this is the regression check for that claim).

- [ ] **Step 2: Start the app and open it in a browser**

```bash
npm run dev
```

Navigate to `http://localhost:3000`.

- [ ] **Step 3: Walk through the spec's verification checklist**

1. Empty conversation: confirm the 3 prompt chips render and are clickable.
2. Click a chip (or type a message): confirm it sends correctly and the user/assistant bubbles render with navy/white styling respectively.
3. Ask "I need a new passport": confirm the restyled checklist card shows all fields correctly (documents with checkmarks, fees, processing time, both links working).
4. Confirm the disclaimer strip renders above the chips/messages and its link works.
5. Resize the browser to a mobile width (e.g. 375px) and confirm: chips wrap onto multiple lines without overflowing, chat bubbles don't overflow the viewport, and the details card stays readable (no horizontal scroll).

- [ ] **Step 4: Record the outcome**

If all checks pass, the visual refresh is complete. If anything fails, it's most likely a Tailwind class issue in the specific component involved — fix it there, not by touching `app/globals.css`'s token values (which were already validated against the approved mockup in Task 1).

- [ ] **Step 5: Stop the dev server and do a final commit if anything changed**

```bash
git status
```

If Step 4 required fixes, stage and commit them with a message describing what was wrong and what changed.
