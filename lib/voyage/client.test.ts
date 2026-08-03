import { describe, it, expect, vi, afterEach } from 'vitest';
import { chunk } from './client';

const embedMock = vi.fn();

vi.mock('voyageai', () => ({
  VoyageAIClient: class {
    embed = embedMock;
  },
}));

describe('chunk', () => {
  it('splits an array into chunks of the given size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns a single chunk when the array is smaller than the chunk size', () => {
    expect(chunk([1, 2], 128)).toEqual([[1, 2]]);
  });

  it('returns an empty array for an empty input', () => {
    expect(chunk([], 10)).toEqual([]);
  });

  it('handles an exact multiple of the chunk size', () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  });
});

describe('embedTexts', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('returns the embedding vectors from a well-formed response', async () => {
    embedMock.mockResolvedValueOnce({
      data: [{ embedding: [0.1, 0.2] }, { embedding: [0.3, 0.4] }],
    });

    const { embedTexts } = await import('./client');
    const result = await embedTexts(['a', 'b'], 'document');

    expect(result).toEqual([[0.1, 0.2], [0.3, 0.4]]);
  });

  it('throws instead of silently substituting an empty vector when an item is missing its embedding', async () => {
    embedMock.mockResolvedValueOnce({
      data: [{ embedding: [0.1, 0.2] }, { embedding: undefined }],
    });

    const { embedTexts } = await import('./client');

    await expect(embedTexts(['a', 'b'], 'document')).rejects.toThrow(
      'Missing embedding in Voyage API response for index 1',
    );
  });

  it('throws instead of silently substituting an empty vector when an item has an empty embedding array', async () => {
    embedMock.mockResolvedValueOnce({
      data: [{ embedding: [0.1, 0.2] }, { embedding: [] }],
    });

    const { embedTexts } = await import('./client');

    await expect(embedTexts(['a', 'b'], 'document')).rejects.toThrow(
      'Missing embedding in Voyage API response for index 1',
    );
  });

  it('throws when the response has fewer items than the requested batch', async () => {
    embedMock.mockResolvedValueOnce({
      data: [{ embedding: [0.1, 0.2] }],
    });

    const { embedTexts } = await import('./client');

    await expect(embedTexts(['a', 'b'], 'document')).rejects.toThrow(
      'Voyage API returned 1 embeddings for a batch of 2 texts',
    );
  });
});
