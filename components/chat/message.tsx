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
