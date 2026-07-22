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
