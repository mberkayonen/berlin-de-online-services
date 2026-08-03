/**
 * One-off script to fix `bookingInfo.url` for already-ingested services.
 *
 * `lib/pipeline/detail-parser.ts`'s booking-link extraction used to assume the
 * "Termin buchen" button was a sibling of its <h2>. On real berlin.de pages the
 * button lives in a sibling of the h2's *parent* (inside a shared
 * `.modul-servicepanel` ancestor), so `bookingUrl` was always null and every
 * ingested service's `bookingInfo.url` silently fell back to `sourceUrl`.
 *
 * This script re-fetches each service's `sourceUrl`, re-parses it with the
 * fixed `parseDetailPage`, and patches ONLY `bookingInfo.url` in place. It does
 * not call any LLM/embedding API and does not touch `data/embeddings.json` or
 * `data/ingestion-state.json` — translation/embedding content is unaffected by
 * this fix.
 *
 * Safe to re-run: re-fetching and re-patching an already-corrected service is
 * a no-op (aside from the wasted HTTP request), so if this crashes partway
 * through, just run it again.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseDetailPage } from '../lib/pipeline/detail-parser';
import { fetchText } from '../lib/pipeline/fetch-text';
import { servicesSchema, type Service } from '../lib/services/schema';

const DATA_DIR = path.join(process.cwd(), 'data');
const SERVICES_PATH = path.join(DATA_DIR, 'services.json');
const PROGRESS_INTERVAL = 25;

async function loadServices(): Promise<Service[]> {
  const raw = await readFile(SERVICES_PATH, 'utf-8');
  return servicesSchema.parse(JSON.parse(raw));
}

async function persist(services: Service[]): Promise<void> {
  const validated = servicesSchema.parse(services);
  await writeFile(SERVICES_PATH, JSON.stringify(validated, null, 2) + '\n', 'utf-8');
}

async function main() {
  const services = await loadServices();
  console.log(`Loaded ${services.length} services from ${SERVICES_PATH}.`);

  let distinctCount = 0;
  let fallbackCount = 0;
  let errorCount = 0;
  let processedCount = 0;

  for (const service of services) {
    try {
      const html = await fetchText(service.sourceUrl);
      const raw = parseDetailPage(html, service.sourceUrl);
      const newUrl = raw.bookingUrl ?? raw.sourceUrl;

      service.bookingInfo.url = newUrl;

      if (newUrl !== service.sourceUrl) {
        distinctCount++;
      } else {
        fallbackCount++;
      }
    } catch (err) {
      errorCount++;
      console.error(
        `Failed to patch ${service.id} (${service.sourceUrl}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    processedCount++;

    if (processedCount % PROGRESS_INTERVAL === 0) {
      await persist(services);
      console.log(
        `Progress: ${processedCount}/${services.length} (${distinctCount} distinct, ${fallbackCount} fallback, ${errorCount} errors)`,
      );
    }
  }

  await persist(services);

  console.log('Done.');
  console.log(
    `Final: ${distinctCount}/${services.length} services now have a distinct booking URL, ${fallbackCount} fell back to sourceUrl, ${errorCount} errors.`,
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
