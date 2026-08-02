import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseListingPage } from '../lib/pipeline/listing-parser';
import { parseDetailPage } from '../lib/pipeline/detail-parser';
import { computeContentHash, type IngestionState } from '../lib/pipeline/ingestion-state';
import { translateService } from '../lib/pipeline/translate';
import { embedTexts } from '../lib/voyage/client';
import { servicesSchema, type Service } from '../lib/services/schema';

const LISTING_URL = 'https://service.berlin.de/dienstleistungen/';
const DATA_DIR = path.join(process.cwd(), 'data');
const SERVICES_PATH = path.join(DATA_DIR, 'services.json');
const EMBEDDINGS_PATH = path.join(DATA_DIR, 'embeddings.json');
const STATE_PATH = path.join(DATA_DIR, 'ingestion-state.json');

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  return res.text();
}

async function loadJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    throw err;
  }
}

async function main() {
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined;
  const isDryRun = limit !== undefined;

  console.log('Fetching listing page...');
  const listingHtml = await fetchText(LISTING_URL);
  const fullListing = parseListingPage(listingHtml);
  const targetListing = isDryRun ? fullListing.slice(0, limit) : fullListing;
  console.log(
    `Found ${fullListing.length} services on the listing page (processing ${targetListing.length}${isDryRun ? ', dry run' : ''}).`,
  );

  const previousState = await loadJson<IngestionState>(STATE_PATH, {});
  const existingServices = await loadJson<Service[]>(SERVICES_PATH, []);
  const existingEmbeddings = await loadJson<Record<string, number[]>>(EMBEDDINGS_PATH, {});

  const servicesById = new Map(existingServices.map(s => [s.id, s]));
  const embeddingsById: Record<string, number[]> = { ...existingEmbeddings };
  const stateById: IngestionState = { ...previousState };

  async function persist() {
    const validated = servicesSchema.parse(Array.from(servicesById.values()));
    await writeFile(SERVICES_PATH, JSON.stringify(validated, null, 2) + '\n', 'utf-8');
    await writeFile(EMBEDDINGS_PATH, JSON.stringify(embeddingsById, null, 2) + '\n', 'utf-8');
    await writeFile(STATE_PATH, JSON.stringify(stateById, null, 2) + '\n', 'utf-8');
  }

  let unchangedCount = 0;
  let updatedCount = 0;
  let processedCount = 0;

  for (const entry of targetListing) {
    const detailUrl = `https://service.berlin.de/dienstleistung/${entry.id}/`;
    const detailHtml = await fetchText(detailUrl);
    const raw = parseDetailPage(detailHtml, detailUrl);
    const contentHash = computeContentHash(raw);

    const previousHash = previousState[entry.id]?.contentHash;
    const isUnchanged =
      previousHash === contentHash && servicesById.has(entry.id) && embeddingsById[entry.id] !== undefined;

    stateById[entry.id] = { contentHash, lastCheckedAt: new Date().toISOString() };

    if (!isUnchanged) {
      console.log(`Translating ${entry.id} (${raw.name})...`);
      const translated = await translateService(raw);

      const service: Service = {
        id: entry.id,
        name: translated.name,
        description: translated.description,
        keywords: translated.keywords,
        eligibility: translated.eligibility,
        requiredDocuments: translated.requiredDocuments,
        fees: translated.fees,
        processingTime: translated.processingTime,
        bookingInfo: {
          office: translated.office,
          url: raw.bookingUrl ?? raw.sourceUrl,
        },
        sourceUrl: raw.sourceUrl,
      };

      const [vector] = await embedTexts(
        [[service.name, service.description, ...service.keywords].join('. ')],
        'document',
      );

      servicesById.set(entry.id, service);
      embeddingsById[entry.id] = vector;
      updatedCount++;
    } else {
      unchangedCount++;
    }

    processedCount++;
    await persist();

    if (processedCount % 25 === 0) {
      console.log(
        `Progress: ${processedCount}/${targetListing.length} (${unchangedCount} unchanged, ${updatedCount} updated/new)`,
      );
    }
  }

  if (!isDryRun) {
    const currentIds = new Set(fullListing.map(e => e.id));
    const before = servicesById.size;
    for (const id of Array.from(servicesById.keys())) {
      if (!currentIds.has(id)) {
        servicesById.delete(id);
        delete embeddingsById[id];
        delete stateById[id];
      }
    }
    const prunedCount = before - servicesById.size;
    if (prunedCount > 0) {
      console.log(`Pruned ${prunedCount} services no longer on the listing page.`);
      await persist();
    }
  }

  console.log(
    `Done. ${unchangedCount} unchanged, ${updatedCount} updated/new. Total services: ${servicesById.size}.`,
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
