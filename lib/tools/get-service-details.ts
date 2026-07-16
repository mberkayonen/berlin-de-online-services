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
