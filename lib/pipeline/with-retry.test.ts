import { describe, it, expect, vi } from 'vitest';
import { withRetry } from './with-retry';

describe('withRetry', () => {
  it('succeeds on the first try with no retries needed', async () => {
    const fn = vi.fn().mockResolvedValue('ok');

    const result = await withRetry(fn);

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('fails twice then succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValueOnce('ok');
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await withRetry(fn, { sleep });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('exhausts all retries and rethrows the original last error', async () => {
    const lastError = new Error('final failure');
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockRejectedValueOnce(new Error('fail 3'))
      .mockRejectedValueOnce(lastError);
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(withRetry(fn, { retries: 3, sleep })).rejects.toBe(lastError);
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('passes correct exponential backoff delays to the injected sleep', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockRejectedValueOnce(new Error('fail 3'))
      .mockResolvedValueOnce('ok');
    const sleep = vi.fn().mockResolvedValue(undefined);

    await withRetry(fn, { retries: 3, baseDelayMs: 1000, sleep });

    expect(sleep).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 1000);
    expect(sleep).toHaveBeenNthCalledWith(2, 2000);
    expect(sleep).toHaveBeenNthCalledWith(3, 4000);
  });

  it('calls onRetry with the attempt number and error on each retry', async () => {
    const err1 = new Error('fail 1');
    const err2 = new Error('fail 2');
    const fn = vi
      .fn()
      .mockRejectedValueOnce(err1)
      .mockRejectedValueOnce(err2)
      .mockResolvedValueOnce('ok');
    const sleep = vi.fn().mockResolvedValue(undefined);
    const onRetry = vi.fn();

    await withRetry(fn, { sleep, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, err1);
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, err2);
  });
});
