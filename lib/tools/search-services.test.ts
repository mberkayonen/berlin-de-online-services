import { describe, it, expect } from 'vitest';
import { searchServicesTool } from './search-services';

describe('searchServicesTool', () => {
  it('wraps searchServices and returns results', async () => {
    const output = await searchServicesTool.execute!(
      { query: 'moved to berlin' },
      { toolCallId: 'test-call', messages: [], context: {} },
    );
    expect(output.results.some(r => r.id === 'anmeldung')).toBe(true);
  });
});
