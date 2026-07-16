import { describe, it, expect } from 'vitest';
import { getServiceDetailsTool } from './get-service-details';

describe('getServiceDetailsTool', () => {
  it('returns the full service record for a known id', async () => {
    const output = await getServiceDetailsTool.execute!(
      { serviceId: 'anmeldung' },
      { toolCallId: 'test-call', messages: [], context: {} },
    );
    expect(output.service?.id).toBe('anmeldung');
    expect(output.service?.requiredDocuments.length).toBeGreaterThan(0);
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
