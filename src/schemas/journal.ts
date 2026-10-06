import { z } from 'zod';

export const JournalItemSchema = z.object({
  itemId: z.string(),
  itemTitle: z.string(),
  category: z.string(),
  timestamp: z.string(),
  photoFilename: z.string().optional(),
  speciesHint: z.string().nullable().optional(),
  observationNotes: z.string(),
  kidFriendlyQuote: z.string(),
});
export type JournalItem = z.infer<typeof JournalItemSchema>;

export const WalkJournalSchema = z.object({
  sessionId: z.string(),
  questTitle: z.string(),
  themeNarrative: z.string(),
  setting: z.string(),
  seasonAndRegion: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  totalDurationSeconds: z.number().nonnegative(),
  screenActiveSeconds: z.number().nonnegative(),
  screenToSkyRatio: z.number().min(0).max(1),
  itemsFound: z.array(JournalItemSchema),
  totalItemsCount: z.number(),
  reflectionSummary: z.string(),
});
export type WalkJournal = z.infer<typeof WalkJournalSchema>;
