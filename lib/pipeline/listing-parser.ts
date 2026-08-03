import * as cheerio from 'cheerio';

export interface ListingEntry {
  id: string;
  name: string;
}

export function parseListingPage(html: string): ListingEntry[] {
  const $ = cheerio.load(html);
  const entries = new Map<string, string>();

  $('a[href*="/dienstleistung/"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const match = href.match(/\/dienstleistung\/(\d+)\/?$/);
    if (!match) return;

    const id = match[1];
    const name = $(el).text().trim();
    if (!name) return;

    if (!entries.has(id)) {
      entries.set(id, name);
    }
  });

  return Array.from(entries, ([id, name]) => ({ id, name }));
}
