import { describe, it, expect } from 'vitest';
import { getServiceDetailsTool } from './get-service-details';
import type { Service } from '@/lib/services/schema';

describe('getServiceDetailsTool', () => {
  it('returns the full service record for a known id', async () => {
    const output = (await getServiceDetailsTool.execute!(
      { serviceId: 'anmeldung' },
      { toolCallId: 'test-call', messages: [], context: {} },
    )) as { service?: Service; error?: string };
    expect(output.service?.id).toBe('anmeldung');
    expect(output.service?.requiredDocuments.length).toBeGreaterThan(0);
  });

  it('returns an error for an unknown id', async () => {
    const output = (await getServiceDetailsTool.execute!(
      { serviceId: 'does-not-exist' },
      { toolCallId: 'test-call', messages: [], context: {} },
    )) as { service?: Service; error?: string };
    expect(output.service).toBeUndefined();
    expect(output.error).toContain('does-not-exist');
  });
});
