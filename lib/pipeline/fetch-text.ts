import { withRetry } from './with-retry';

export async function fetchText(url: string): Promise<string> {
  return withRetry(
    async () => {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) {
        throw new Error(`Failed to fetch ${url}: ${res.status}`);
      }
      return res.text();
    },
    {
      onRetry: (attempt, error) => {
        console.log(
          `Retry ${attempt}/3 for fetchText(${url}): ${error instanceof Error ? error.message : String(error)}`,
        );
      },
    },
  );
}
