import { describe, it, expect } from 'vitest';
import { services, getServiceById } from './data';

describe('services data', () => {
  it('loads at least one valid service', () => {
    expect(services.length).toBeGreaterThan(0);
  });

  it('finds the seeded Anmeldung service by id', () => {
    const anmeldung = getServiceById('anmeldung');
    expect(anmeldung).toBeDefined();
    expect(anmeldung?.name).toContain('Anmeldung');
    expect(anmeldung?.fees).toBe('Free of charge.');
  });

  it('returns undefined for an unknown id', () => {
    expect(getServiceById('does-not-exist')).toBeUndefined();
  });
});
