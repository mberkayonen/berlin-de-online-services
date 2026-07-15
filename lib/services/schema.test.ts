import { describe, it, expect } from 'vitest';
import { serviceSchema, servicesSchema } from './schema';

const validService = {
  id: 'anmeldung',
  name: 'Anmeldung',
  description: 'Register your address.',
  keywords: ['move', 'register address'],
  eligibility: 'Anyone moving into a new home in Berlin.',
  requiredDocuments: ['Valid ID'],
  fees: 'Free of charge.',
  processingTime: 'Same day.',
  bookingInfo: {
    office: 'Bürgeramt',
    url: 'https://service.berlin.de/dienstleistung/120697/',
  },
  sourceUrl: 'https://service.berlin.de/dienstleistung/120697/',
};

describe('serviceSchema', () => {
  it('parses a valid service', () => {
    expect(() => serviceSchema.parse(validService)).not.toThrow();
  });

  it('parses a valid service with clarifyingQuestions', () => {
    expect(() =>
      serviceSchema.parse({
        ...validService,
        clarifyingQuestions: [
          { question: 'Which country issued your license?', why: 'Changes the process.' },
        ],
      }),
    ).not.toThrow();
  });

  it('rejects a service missing a required field', () => {
    const { fees: _fees, ...missingFees } = validService;
    expect(() => serviceSchema.parse(missingFees)).toThrow();
  });

  it('rejects a service with an invalid sourceUrl', () => {
    expect(() =>
      serviceSchema.parse({ ...validService, sourceUrl: 'not-a-url' }),
    ).toThrow();
  });
});

describe('servicesSchema', () => {
  it('parses an array of valid services', () => {
    expect(() => servicesSchema.parse([validService])).not.toThrow();
  });
});
