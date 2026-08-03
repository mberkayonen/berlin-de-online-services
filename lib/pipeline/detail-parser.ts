import * as cheerio from 'cheerio';

export interface RawServiceFields {
  name: string;
  eligibility: string;
  requiredDocuments: string;
  fees: string;
  processingTime: string;
  office: string;
  bookingUrl: string | null;
  sourceUrl: string;
}

function extractSectionText($: cheerio.CheerioAPI, label: string): string {
  const heading = $('h2')
    .filter((_, el) => $(el).text().trim() === label)
    .first();
  if (heading.length === 0) return '';

  const content = heading.nextUntil('h2');
  const listItems = content.find('li');

  if (listItems.length > 0) {
    return listItems
      .map((_, li) => $(li).text().replace(/\s+/g, ' ').trim())
      .get()
      .filter(Boolean)
      .join('; ');
  }

  return content.text().replace(/\s+/g, ' ').trim();
}

export function parseDetailPage(html: string, sourceUrl: string): RawServiceFields {
  const $ = cheerio.load(html);

  const name = $('h1.title').first().text().trim();
  const eligibility = extractSectionText($, 'Voraussetzungen');
  const requiredDocuments = extractSectionText($, 'Erforderliche Unterlagen');
  const fees = extractSectionText($, 'Gebühren');
  const processingTime = extractSectionText($, 'Durchschnittliche Bearbeitungszeit');
  const office = extractSectionText($, 'Hinweise zur Zuständigkeit');

  const bookingHeading = $('h2')
    .filter((_, el) => $(el).text().trim() === 'Termin buchen')
    .first();
  const bookingPanel = bookingHeading.closest('.modul-servicepanel');
  const bookingHref =
    (bookingPanel.length > 0 ? bookingPanel : bookingHeading.nextUntil('h2'))
      .find('a.button')
      .first()
      .attr('href') ?? null;
  const bookingUrl = bookingHref ? new URL(bookingHref, 'https://service.berlin.de').toString() : null;

  return {
    name,
    eligibility,
    requiredDocuments,
    fees,
    processingTime,
    office,
    bookingUrl,
    sourceUrl,
  };
}
