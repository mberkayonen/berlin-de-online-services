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
    const results = await searchServices(query);
    return { results };
  },
});
