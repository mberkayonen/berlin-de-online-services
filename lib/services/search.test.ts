import { describe, it, expect, vi, afterEach } from 'vitest';
import { rankByEmbedding } from './search';

vi.mock('@/lib/voyage/client', () => ({
  embedTexts: vi.fn(),
}));

describe('rankByEmbedding', () => {
  const candidates = [
    { id: 'a', vector: [1, 0, 0] }, // identical to query -> similarity 1.0
    { id: 'b', vector: [0.9, 0.1, 0] }, // close to query -> high similarity
    { id: 'c', vector: [0, 1, 0] }, // orthogonal to query -> similarity 0.0
    { id: 'd', vector: [-1, 0, 0] }, // opposite of query -> similarity -1.0
  ];
  const queryVector = [1, 0, 0];

  it('ranks candidates by descending similarity', () => {
    const ranked = rankByEmbedding(queryVector, candidates, -1, 10);
    expect(ranked).toEqual(['a', 'b', 'c', 'd']);
  });

  it('filters out candidates below the minimum similarity threshold', () => {
    const ranked = rankByEmbedding(queryVector, candidates, 0.5, 10);
    expect(ranked).toEqual(['a', 'b']);
  });

  it('respects the maxResults limit', () => {
    const ranked = rankByEmbedding(queryVector, candidates, -1, 2);
    expect(ranked).toEqual(['a', 'b']);
  });

  it('returns an empty array when nothing meets the threshold', () => {
    const ranked = rankByEmbedding(queryVector, candidates, 1.5, 10);
    expect(ranked).toEqual([]);
  });

  it('returns an empty array for an empty candidate list', () => {
    expect(rankByEmbedding(queryVector, [], -1, 10)).toEqual([]);
  });
});

describe('searchServices', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an empty array instead of throwing when embedding the query fails', async () => {
    const { embedTexts } = await import('@/lib/voyage/client');
    vi.mocked(embedTexts).mockRejectedValueOnce(new Error('Voyage API outage'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { searchServices } = await import('./search');
    const results = await searchServices('renew my passport');

    expect(results).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
