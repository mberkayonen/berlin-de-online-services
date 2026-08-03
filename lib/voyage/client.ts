import { VoyageAIClient } from 'voyageai';

const MAX_BATCH_SIZE = 128;
const EMBEDDING_MODEL = 'voyage-4';

let cachedClient: VoyageAIClient | undefined;

function getClient(): VoyageAIClient {
  if (!cachedClient) {
    cachedClient = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });
  }
  return cachedClient;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function embedTexts(
  texts: string[],
  inputType: 'query' | 'document',
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const batches = chunk(texts, MAX_BATCH_SIZE);
  const results: number[][] = [];

  for (const batch of batches) {
    const response = await getClient().embed({
      input: batch,
      model: EMBEDDING_MODEL,
      inputType,
    });
    const data = response.data ?? [];
    if (data.length !== batch.length) {
      throw new Error(
        `Voyage API returned ${data.length} embeddings for a batch of ${batch.length} texts`,
      );
    }
    const embeddings = data.map((item, i) => {
      if (!item.embedding?.length) {
        throw new Error(`Missing embedding in Voyage API response for index ${i}`);
      }
      return item.embedding;
    });
    results.push(...embeddings);
  }

  return results;
}
