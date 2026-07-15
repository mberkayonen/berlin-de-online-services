import { z } from 'zod';

export const clarifyingQuestionSchema = z.object({
  question: z.string(),
  why: z.string(),
});

export const bookingInfoSchema = z.object({
  office: z.string(),
  url: z.string().url(),
});

export const serviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  keywords: z.array(z.string()),
  eligibility: z.string(),
  requiredDocuments: z.array(z.string()),
  fees: z.string(),
  processingTime: z.string(),
  bookingInfo: bookingInfoSchema,
  sourceUrl: z.string().url(),
  clarifyingQuestions: z.array(clarifyingQuestionSchema).optional(),
});

export const servicesSchema = z.array(serviceSchema);

export type ClarifyingQuestion = z.infer<typeof clarifyingQuestionSchema>;
export type BookingInfo = z.infer<typeof bookingInfoSchema>;
export type Service = z.infer<typeof serviceSchema>;
