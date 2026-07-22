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
