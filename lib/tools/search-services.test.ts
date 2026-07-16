import { describe, it, expect } from 'vitest';
import { searchServicesTool } from './search-services';
import type { ServiceSearchResult } from '@/lib/services/search';

describe('searchServicesTool', () => {
  it('wraps searchServices and returns results', async () => {
    const output = (await searchServicesTool.execute!(
      { query: 'moved to berlin' },
      { toolCallId: 'test-call', messages: [], context: {} },
    )) as { results: ServiceSearchResult[] };
    expect(output.results.some((r) => r.id === 'anmeldung')).toBe(true);
  });
});
