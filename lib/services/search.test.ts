import { describe, it, expect } from 'vitest';
import { searchServices } from './search';

describe('searchServices', () => {
  it('finds Anmeldung for a query about moving to Berlin', () => {
    const results = searchServices('I just moved to Berlin, what do I need to do');
    expect(results.some(r => r.id === 'anmeldung')).toBe(true);
  });

  it('finds both driving license conversion services for a generic query', () => {
    const results = searchServices('convert my foreign driving license');
    const ids = results.map(r => r.id);
    expect(ids).toContain('fuehrerschein-umschreibung-eu-ewr');
    expect(ids).toContain('fuehrerschein-umschreibung-drittstaat');
  });

  it('returns an empty array for a nonsense query', () => {
    const results = searchServices('zzz qqq nonexistent gibberish 12345');
    expect(results).toEqual([]);
  });

  it('returns at most 5 results', () => {
    const results = searchServices('a');
    expect(results.length).toBeLessThanOrEqual(5);
  });
});
