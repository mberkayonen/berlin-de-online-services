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
