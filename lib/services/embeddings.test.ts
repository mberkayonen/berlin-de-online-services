import { describe, it, expect } from 'vitest';
import { services } from './data';
import { getEmbedding } from './embeddings';

describe('services/embeddings alignment', () => {
  it('has an embedding for every service in the catalog', () => {
    // Guards against data/services.json and data/embeddings.json drifting
    // apart (e.g. embeddings.json getting emptied or a service ingested
    // without ever getting embedded). Pure on-disk check, no network calls.
    for (const service of services) {
      expect(getEmbedding(service.id)).toBeDefined();
    }
  });
});
