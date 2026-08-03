export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  onRetry?: (attempt: number, error: unknown) => void;
  sleep?: (ms: number) => Promise<void>;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const retries = options?.retries ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 1000;
  const onRetry = options?.onRetry;
  const sleep = options?.sleep ?? defaultSleep;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const attemptsRemaining = retries - attempt;
      if (attemptsRemaining <= 0) {
        throw lastError;
      }
      onRetry?.(attempt + 1, err);
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }

  throw lastError;
}
