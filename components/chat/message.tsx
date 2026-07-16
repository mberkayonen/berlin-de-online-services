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
