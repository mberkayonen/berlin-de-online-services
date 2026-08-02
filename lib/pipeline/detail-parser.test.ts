import { describe, it, expect } from 'vitest';
import { parseDetailPage } from './detail-parser';

const fixtureHtml = `
<html><body>
<h1 class="title">Personalausweis beantragen</h1>
<h2 class="title">Termin buchen</h2>
<div>
  <a class="button button--negative" href="/terminvereinbarung/termin/all/120703/">Berlinweite Terminbuchung</a>
</div>
<h2 class="title">Voraussetzungen</h2>
<ul class="list-clean">
  <li>Deutsche Staatsangehörigkeit</li>
  <li>Persönliche Vorsprache ist erforderlich</li>
</ul>
<h2 class="title">Erforderliche Unterlagen</h2>
<ul class="list-clean">
  <li>1 aktuelles biometrisches Passfoto</li>
  <li>Vorheriger Ausweis, falls vorhanden</li>
</ul>
<h2 class="title">Gebühren</h2>
<p><ul class="list"><li>27,60 Euro: unter 24 Jahre</li><li>46,00 Euro: ab 24 Jahre</li></ul></p>
<h2 class="title">Durchschnittliche Bearbeitungszeit</h2>
<p><ul class="list"><li>etwa 3 bis 4 Wochen</li></ul></p>
<h2 class="title">Hinweise zur Zuständigkeit</h2>
<p>Die Dienstleistung kann bei allen Bürgerämtern in Anspruch genommen werden.</p>
<h2 class="title">Kontakt</h2>
<p>Irrelevant contact block</p>
</body></html>
`;

describe('parseDetailPage', () => {
  const sourceUrl = 'https://service.berlin.de/dienstleistung/120703/';
  const result = parseDetailPage(fixtureHtml, sourceUrl);

  it('extracts the name from the h1', () => {
    expect(result.name).toBe('Personalausweis beantragen');
  });

  it('extracts list-based sections as semicolon-joined items', () => {
    expect(result.eligibility).toBe('Deutsche Staatsangehörigkeit; Persönliche Vorsprache ist erforderlich');
    expect(result.requiredDocuments).toBe('1 aktuelles biometrisches Passfoto; Vorheriger Ausweis, falls vorhanden');
    expect(result.fees).toBe('27,60 Euro: unter 24 Jahre; 46,00 Euro: ab 24 Jahre');
    expect(result.processingTime).toBe('etwa 3 bis 4 Wochen');
  });

  it('extracts the plain-text jurisdiction section', () => {
    expect(result.office).toBe('Die Dienstleistung kann bei allen Bürgerämtern in Anspruch genommen werden.');
  });

  it('resolves the booking link to an absolute URL', () => {
    expect(result.bookingUrl).toBe('https://service.berlin.de/terminvereinbarung/termin/all/120703/');
  });

  it('passes through the given sourceUrl', () => {
    expect(result.sourceUrl).toBe(sourceUrl);
  });

  it('returns an empty string for a missing section rather than throwing', () => {
    const minimal = parseDetailPage('<html><body><h1 class="title">X</h1></body></html>', sourceUrl);
    expect(minimal.eligibility).toBe('');
    expect(minimal.bookingUrl).toBeNull();
  });
});
