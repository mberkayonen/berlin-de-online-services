import { describe, it, expect } from 'vitest';
import { parseListingPage } from './listing-parser';

const fixtureHtml = `
<html><body>
<a href="/dienstleistungen/de_plain/">Plain text version</a>
<a href="https://service.berlin.de/dienstleistung/120703/">Personalausweis beantragen</a>
<a href="https://service.berlin.de/dienstleistung/121151/">Reisepass beantragen</a>
<a href="https://service.berlin.de/dienstleistung/120703/">Personalausweis beantragen</a>
</body></html>
`;

describe('parseListingPage', () => {
  it('extracts id and name for each unique dienstleistung link', () => {
    const result = parseListingPage(fixtureHtml);
    expect(result).toEqual([
      { id: '120703', name: 'Personalausweis beantragen' },
      { id: '121151', name: 'Reisepass beantragen' },
    ]);
  });

  it('ignores non-dienstleistung links', () => {
    const result = parseListingPage('<a href="/dienstleistungen/de_plain/">x</a>');
    expect(result).toEqual([]);
  });

  it('returns an empty array for a page with no matching links', () => {
    expect(parseListingPage('<html><body>no links here</body></html>')).toEqual([]);
  });
});
