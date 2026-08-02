import { describe, it, expect } from 'vitest';
import { getServiceDetailsTool } from './get-service-details';
import { services } from '@/lib/services/data';

describe('getServiceDetailsTool', () => {
  it('returns the full service record for a known id', async () => {
    const knownService = services[0];
    const output = await getServiceDetailsTool.execute!(
      { serviceId: knownService.id },
      { toolCallId: 'test-call', messages: [], context: {} },
    );
    expect(output.service?.id).toBe(knownService.id);
    expect(output.service?.requiredDocuments.length).toBeGreaterThanOrEqual(0);
  });

  it('returns an error for an unknown id', async () => {
    const output = await getServiceDetailsTool.execute!(
      { serviceId: 'does-not-exist' },
      { toolCallId: 'test-call', messages: [], context: {} },
    );
    expect(output.service).toBeUndefined();
    expect(output.error).toContain('does-not-exist');
  });
});
