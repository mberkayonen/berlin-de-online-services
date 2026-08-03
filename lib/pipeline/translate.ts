import { generateText, Output } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import type { RawServiceFields } from './detail-parser';

export const translatedFieldsSchema = z.object({
  name: z.string(),
  description: z.string(),
  keywords: z.array(z.string()),
  eligibility: z.string(),
  requiredDocuments: z.array(z.string()),
  fees: z.string(),
  processingTime: z.string(),
  office: z.string(),
});

export type TranslatedFields = z.infer<typeof translatedFieldsSchema>;

function orNotStated(value: string): string {
  return value.trim().length > 0 ? value : '(not stated on the page)';
}

export async function translateService(raw: RawServiceFields): Promise<TranslatedFields> {
  const { output } = await generateText({
    model: anthropic('claude-haiku-4-5'),
    output: Output.object({ schema: translatedFieldsSchema }),
    prompt: `You are translating a German government service listing from berlin.de into English for a chatbot that helps residents figure out what they need to do and prepare for an appointment.

Translate the following raw extracted fields into English. Do not invent, add, or omit any factual detail — translate faithfully, only restructuring the "Required documents" text into a clean array of individual document items (one array entry per document), splitting on the natural list boundaries already present in the source text (it uses "; " between items).

Also write:
- "description": a one-sentence English summary of what this service is, based only on the name and eligibility text below.
- "keywords": 3-6 short English search terms/phrases a resident might type when looking for this service (synonyms, related situations), based only on the content below — do not invent unrelated terms.

Raw extracted German fields:
Name: ${raw.name}
Eligibility (Voraussetzungen): ${orNotStated(raw.eligibility)}
Required documents (Erforderliche Unterlagen): ${orNotStated(raw.requiredDocuments)}
Fees (Gebühren): ${orNotStated(raw.fees)}
Processing time (Durchschnittliche Bearbeitungszeit): ${orNotStated(raw.processingTime)}
Responsible office (Hinweise zur Zuständigkeit): ${orNotStated(raw.office)}

If a field says "(not stated on the page)", output an honest English equivalent like "Not stated on the page — check the official page for details." rather than inventing a value. For "requiredDocuments" specifically, if none were stated, return an empty array.`,
  });

  return output;
}
