import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const NarrateInputSchema = z.object({
  text: z.string().min(1),
  ageBand: z.enum(['young_kids', 'older_kids', 'adults']).default('young_kids'),
  urgency: z.enum(['calm', 'celebration', 'curious']).default('calm'),
});

export const NarrateOutputSchema = z.object({
  spokenText: z.string(),
  suggestedRate: z.number(),
  suggestedPitch: z.number(),
});

export function createNarrateTool() {
  return createTool({
    id: 'narrate',
    description: 'Formats and tunes spoken prompts for offline local voice synthesis.',
    inputSchema: NarrateInputSchema,
    outputSchema: NarrateOutputSchema,
    execute: async (rawInput: any) => {
      const { text, ageBand, urgency } = rawInput.context ?? rawInput;

      let rate = 0.95; // slightly slower for outdoor clarity
      let pitch = 1.0;

      if (ageBand === 'young_kids') {
        rate = 0.9;
        pitch = 1.05;
      } else if (ageBand === 'adults') {
        rate = 1.0;
        pitch = 0.98;
      }

      if (urgency === 'celebration') {
        pitch += 0.08;
      }

      return {
        spokenText: text.trim(),
        suggestedRate: Number(rate.toFixed(2)),
        suggestedPitch: Number(pitch.toFixed(2)),
      };
    },
  });
}
