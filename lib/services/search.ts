import { cosineSimilarity } from 'ai';
import { embedTexts } from '@/lib/voyage/client';
import { services } from './data';
import { getAllEmbeddings } from './embeddings';

export interface ServiceSearchResult {
  id: string;
  name: string;
  summary: string;
}

export const MIN_SIMILARITY = 0.5;
export const MAX_RESULTS = 5;

export interface EmbeddingCandidate {
  id: string;
  vector: number[];
}

export function rankByEmbedding(
  queryVector: number[],
  candidates: EmbeddingCandidate[],
  minSimilarity = MIN_SIMILARITY,
  maxResults = MAX_RESULTS,
): string[] {
  return candidates
    .map(({ id, vector }) => ({ id, score: cosineSimilarity(queryVector, vector) }))
    .filter(({ score }) => score >= minSimilarity)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(({ id }) => id);
}

const servicesById = new Map(services.map(s => [s.id, s]));

export async function searchServices(query: string): Promise<ServiceSearchResult[]> {
  const [queryVector] = await embedTexts([query], 'query');
  const rankedIds = rankByEmbedding(queryVector, getAllEmbeddings());

  return rankedIds
    .map(id => servicesById.get(id))
    .filter((service): service is NonNullable<typeof service> => service !== undefined)
    .map(service => ({ id: service.id, name: service.name, summary: service.description }));
}
