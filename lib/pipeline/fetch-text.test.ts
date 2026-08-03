import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchText } from './fetch-text';

describe('fetchText', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the response body text on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('<html>ok</html>') });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchText('https://example.com/page');

    expect(result).toBe('<html>ok</html>');
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/page', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
  });

  it('retries once on a non-ok status and returns the eventual success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, text: () => Promise.resolve('') })
      .mockResolvedValueOnce({ ok: true, status: 200, text: () => Promise.resolve('<html>recovered</html>') });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchText('https://example.com/flaky');

    expect(result).toBe('<html>recovered</html>');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 10000);
});
