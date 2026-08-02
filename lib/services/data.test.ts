import { describe, it, expect } from 'vitest';
import { services, getServiceById } from './data';

describe('services data', () => {
  it('loads at least one service', () => {
    expect(services.length).toBeGreaterThan(0);
  });

  it('returns undefined for an unknown id', () => {
    expect(getServiceById('does-not-exist')).toBeUndefined();
  });

  it('gives every service a working sourceUrl pointing at service.berlin.de', () => {
    for (const service of services) {
      expect(service.sourceUrl).toMatch(/^https:\/\/service\.berlin\.de\//);
    }
  });

  it('gives every service a non-empty id, name, and description', () => {
    for (const service of services) {
      expect(service.id.length).toBeGreaterThan(0);
      expect(service.name.length).toBeGreaterThan(0);
      expect(service.description.length).toBeGreaterThan(0);
    }
  });
});
