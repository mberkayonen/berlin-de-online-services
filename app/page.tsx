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
