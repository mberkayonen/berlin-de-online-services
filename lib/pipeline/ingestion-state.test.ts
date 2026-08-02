import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  computeContentHash,
  readIngestionState,
  writeIngestionState,
} from './ingestion-state';
import type { RawServiceFields } from './detail-parser';

const sampleFields: RawServiceFields = {
  name: 'Personalausweis beantragen',
  eligibility: 'Deutsche Staatsangehörigkeit',
  requiredDocuments: 'Passfoto',
  fees: '27,60 Euro',
  processingTime: '3 bis 4 Wochen',
  office: 'Bürgeramt',
  bookingUrl: 'https://service.berlin.de/terminvereinbarung/termin/all/120703/',
  sourceUrl: 'https://service.berlin.de/dienstleistung/120703/',
};

let tempDir: string;

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

describe('computeContentHash', () => {
  it('is deterministic for the same input', () => {
    expect(computeContentHash(sampleFields)).toBe(computeContentHash(sampleFields));
  });

  it('differs when a field changes', () => {
    const changed = { ...sampleFields, fees: '46,00 Euro' };
    expect(computeContentHash(sampleFields)).not.toBe(computeContentHash(changed));
  });
});

describe('readIngestionState / writeIngestionState', () => {
  it('returns an empty object when the file does not exist', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'ingestion-state-'));
    const state = await readIngestionState(path.join(tempDir, 'missing.json'));
    expect(state).toEqual({});
  });

  it('round-trips a written state through read', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'ingestion-state-'));
    const statePath = path.join(tempDir, 'state.json');
    const state = { '120703': { contentHash: 'abc123', lastCheckedAt: '2026-08-01T00:00:00.000Z' } };

    await writeIngestionState(statePath, state);
    const readBack = await readIngestionState(statePath);

    expect(readBack).toEqual(state);
  });
});
