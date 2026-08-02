import embeddingsJson from '@/data/embeddings.json';

const embeddings: Record<string, number[]> = embeddingsJson;

export function getEmbedding(id: string): number[] | undefined {
  return embeddings[id];
}

export function getAllEmbeddings(): { id: string; vector: number[] }[] {
  return Object.entries(embeddings).map(([id, vector]) => ({ id, vector }));
}
