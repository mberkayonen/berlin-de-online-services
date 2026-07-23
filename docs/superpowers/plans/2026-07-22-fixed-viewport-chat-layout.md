# Fixed-Viewport Chat Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock the chat page to viewport height with an internally-scrolling message list and auto-scroll-to-latest, matching the standard Claude/ChatGPT chat layout — header/disclaimer fixed at top, input fixed at bottom, only the conversation scrolls.

**Architecture:** `app/layout.tsx`'s body becomes a fixed-height, non-scrolling flex container; `app/page.tsx` is restructured into three flex regions (fixed top, scrollable middle, fixed bottom) with a scroll-anchor `<div>` and a `useEffect` that scrolls it into view whenever `messages` changes.

**Tech Stack:** Next.js (App Router), Tailwind CSS v4 — same stack as before, no new dependencies.

## Global Constraints

- Layout only: no changes to `lib/agents/`, `lib/tools/`, `lib/services/`, `data/services.json`, `app/api/chat/route.ts`, or any component's visual styling/colors (Civic Trust palette from the prior pass is untouched).
- No new automated tests: this is a UI-only, non-behavioral change — verification is manual browser checks.
- Package manager: npm.

---

### Task 1: Fixed-Viewport Layout with Auto-Scroll

**Files:**
- Modify: `app/layout.tsx` (body className only)
- Modify: `app/page.tsx` (full rewrite)

**Interfaces:**
- Consumes: `Message`, `Disclaimer`, `PromptChips`, `Button` components (unchanged exports from prior tasks — no changes needed to any of them).
- Produces: no new exports; this is the page component itself.

- [ ] **Step 1: Fix the body to viewport height**

In `app/layout.tsx`, change the `<body>` element's className from `"min-h-full flex flex-col"` to `"h-full flex flex-col overflow-hidden"`:

```tsx
<body className="h-full flex flex-col overflow-hidden">{children}</body>
```

- [ ] **Step 2: Restructure the page into fixed top / scrollable middle / fixed bottom**

Replace the full contents of `app/page.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
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
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput('');
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col px-4">
      <div className="flex flex-shrink-0 flex-col gap-4 py-6">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <span className="inline-block h-2 w-2 rounded-full bg-destructive" aria-hidden="true" />
          Berlin Services Assistant (unofficial)
        </h1>
        <Disclaimer />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-3 pb-4">
          {messages.length === 0 && (
            <PromptChips onSelect={prompt => sendMessage({ text: prompt })} />
          )}

          {messages.map(message => (
            <Message
              key={message.id}
              message={message}
              onSelectService={serviceName => sendMessage({ text: `Tell me more about: ${serviceName}` })}
            />
          ))}

          <div ref={scrollAnchorRef} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-shrink-0 gap-2 py-4">
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

Note what changed from before: the outer container is now `h-full flex flex-col` instead of a growing `py-12` block; the header/disclaimer are wrapped in a `flex-shrink-0` region; the message area is wrapped in a new `flex-1 overflow-y-auto` scroll container with its own inner `flex flex-col gap-3` (this inner wrapper is needed so `overflow-y-auto` scrolls contained content rather than fighting with `gap`); the form dropped `sticky bottom-4` in favor of `flex-shrink-0` (it's now pinned by the flex layout itself, not by scroll position); and a `scrollAnchorRef` + `useEffect` were added for auto-scroll.

- [ ] **Step 3: Verify the build**

```bash
npx tsc --noEmit
npm run build
```

Expected: both succeed with no errors.

- [ ] **Step 4: Visually verify in the browser**

Start the dev server, open `http://localhost:3000`, and:
1. Confirm the header, disclaimer, and input box are all visible without scrolling on initial load, with the empty-state prompt chips visible in between.
2. Send several messages back-to-back (e.g. click a prompt chip, then ask a couple of follow-up questions) until the conversation is long enough to overflow the visible area — confirm only the message list scrolls; the header/disclaimer at top and the input form at bottom stay fixed in place (the browser window/page itself does not scroll).
3. Confirm the view auto-scrolls down as each new assistant reply streams in, so the latest content is always visible without manual scrolling.
4. Resize to a mobile width (e.g. 375px) and confirm the same fixed-top/scrollable-middle/fixed-bottom behavior holds, with no double scrollbars and the input always reachable.

Stop the dev server after confirming.

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx app/page.tsx
git commit -m "Add fixed-viewport chat layout with auto-scroll"
```
