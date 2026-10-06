import { z } from 'zod';

export const VerificationResultSchema = z.object({
  found: z.boolean().describe('Whether the target scavenger item was observed in the submitted image or audio.'),
  confidence: z
    .number()
    .min(0.0)
    .max(1.0)
    .describe('Confidence score between 0.0 and 1.0 of the match.'),
  isUncertain: z
    .boolean()
    .describe('True if the observation is ambiguous, blurry, or partially obscured.'),
  speciesIdentified: z
    .string()
    .nullable()
    .describe('Best-guess common name if a species is detected; NEVER claimed as 100% certainty.'),
  certaintyCaveat: z
    .string()
    .nullable()
    .describe('Caveat reminding walkers that AI botanical/wildlife IDs are not medical or official truth.'),
  spokenFeedback: z
    .string()
    .min(10)
    .max(300)
    .describe('Warm, enthusiastic, kid-friendly spoken response for the walk narrator.'),
  followUpQuestion: z
    .string()
    .nullable()
    .describe('If uncertain or interesting, an audio follow-up prompt to investigate closer safely.'),
  observationNotes: z
    .string()
    .min(10)
    .max(400)
    .describe('Concise field notes recording colors, textures, patterns for the exportable field journal.'),
});

export type VerificationResult = z.infer<typeof VerificationResultSchema>;

export const VerificationRequestSchema = z.object({
  questItemId: z.string(),
  itemTitle: z.string(),
  targetDescription: z.string(),
  verificationGuidance: z.string(),
  imageBase64: z.string().optional(),
  audioTranscript: z.string().optional(),
});

export type VerificationRequest = z.infer<typeof VerificationRequestSchema>;
