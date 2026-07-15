import { describe, it, expect } from 'vitest';
import { services, getServiceById } from './data';

describe('services data', () => {
  it('loads at least 12 services', () => {
    expect(services.length).toBeGreaterThanOrEqual(12);
  });

  it('finds the seeded Anmeldung service by id', () => {
    const anmeldung = getServiceById('anmeldung');
    expect(anmeldung).toBeDefined();
    expect(anmeldung?.fees).toBe('Free of charge.');
  });

  it('returns undefined for an unknown id', () => {
    expect(getServiceById('does-not-exist')).toBeUndefined();
  });

  it('has both driving license conversion variants with a shared keyword', () => {
    const eu = getServiceById('fuehrerschein-umschreibung-eu-ewr');
    const nonEu = getServiceById('fuehrerschein-umschreibung-drittstaat');
    expect(eu).toBeDefined();
    expect(nonEu).toBeDefined();
    expect(eu?.keywords).toContain('führerschein');
    expect(nonEu?.keywords).toContain('führerschein');
  });

  it('gives every service a working sourceUrl pointing at service.berlin.de', () => {
    for (const service of services) {
      expect(service.sourceUrl).toMatch(/^https:\/\/service\.berlin\.de\//);
    }
  });
});
