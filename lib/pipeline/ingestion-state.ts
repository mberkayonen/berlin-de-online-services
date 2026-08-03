import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { RawServiceFields } from './detail-parser';
import { writeJsonAtomic } from './atomic-write';

export interface IngestionStateEntry {
  contentHash: string;
  lastCheckedAt: string;
}

export type IngestionState = Record<string, IngestionStateEntry>;

export function computeContentHash(fields: RawServiceFields): string {
  const canonical = JSON.stringify(fields, Object.keys(fields).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

export async function readIngestionState(filePath: string): Promise<IngestionState> {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as IngestionState;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw err;
  }
}

export async function writeIngestionState(filePath: string, state: IngestionState): Promise<void> {
  await writeJsonAtomic(filePath, state);
}
