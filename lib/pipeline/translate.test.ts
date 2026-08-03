import { describe, it, expect } from 'vitest';
import { translatedFieldsSchema } from './translate';

const validTranslation = {
  name: 'Apply for an ID card',
  description: 'Apply for a German personal ID card at your local citizens\' office.',
  keywords: ['id card', 'personalausweis', 'identity document'],
  eligibility: 'German citizenship required.',
  requiredDocuments: ['1 current biometric photo', 'Previous ID, if available'],
  fees: '€27.60 if under 24, €46.00 if 24 or older.',
  processingTime: 'About 3 to 4 weeks.',
  office: 'This service is available at all Bürgerämter.',
};

describe('translatedFieldsSchema', () => {
  it('parses a valid translation', () => {
    expect(() => translatedFieldsSchema.parse(validTranslation)).not.toThrow();
  });

  it('rejects a translation missing a required field', () => {
    const { fees: _fees, ...missingFees } = validTranslation;
    expect(() => translatedFieldsSchema.parse(missingFees)).toThrow();
  });

  it('rejects requiredDocuments that is not an array', () => {
    expect(() =>
      translatedFieldsSchema.parse({ ...validTranslation, requiredDocuments: 'not an array' }),
    ).toThrow();
  });
});
