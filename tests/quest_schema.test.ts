import { describe, it, expect } from 'vitest';
import {
  QuestSetupInputSchema,
  QuestPlanSchema,
  QuestItemSchema,
} from '../src/schemas/quest.js';

describe('Quest Schema Validation', () => {
  it('validates a complete, compliant quest setup input', () => {
    const rawInput = {
      setting: 'park',
      timeAvailableMinutes: 25,
      ageBand: 'young_kids',
      difficulty: 'easy',
      accessibility: {
        lowMobility: true,
        lowVision: false,
        flatPavedOnly: true,
      },
      seasonAndRegion: 'Autumn / Pacific Northwest',
    };

    const parsed = QuestSetupInputSchema.safeParse(rawInput);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.setting).toBe('park');
      expect(parsed.data.accessibility.flatPavedOnly).toBe(true);
    }
  });

  it('rejects invalid settings or out-of-range duration', () => {
    const invalidInput = {
      setting: 'volcano', // invalid enum
      timeAvailableMinutes: 999, // over max
      seasonAndRegion: '', // too short
    };

    const parsed = QuestSetupInputSchema.safeParse(invalidInput);
    expect(parsed.success).toBe(false);
  });

  it('validates a structured QuestPlan schema with 5 items', () => {
    const rawPlan = {
      questTitle: 'Autumn Oak & Lichen Explorer',
      themeNarrative:
        'Walk through the damp woods and uncover textures that only show up after the first autumn rains.',
      setting: 'trail',
      safetyChecked: true,
      items: [
        {
          id: 'item-1',
          title: 'Find Yellow Foliage',
          category: 'look',
          promptText: 'Spot a deciduous tree whose leaves have turned golden-yellow.',
          targetDescription: 'Tree branches with bright yellow autumn leaves.',
          verificationGuidance: 'Check if bright yellow leaf canopy or branch is in view.',
          safetyNotes: 'Stay on trail; do not step into deep mud.',
          points: 50,
        },
        {
          id: 'item-2',
          title: 'Crinkly Leaf Crunch',
          category: 'listen',
          promptText: 'Step on dry fallen leaves on the path and listen for the crisp crunch.',
          targetDescription: 'Audio of crunching leaves or photo of boots on dry leaf bed.',
          verificationGuidance: 'Accept boot stepping on leaf litter.',
          points: 50,
        },
        {
          id: 'item-3',
          title: 'Grey Lichen Crust',
          category: 'touch_safe',
          promptText: 'Look for pale minty-green or grey lichen growing on a tree trunk or stone.',
          targetDescription: 'Crustose or foliose lichen on bark or rock surface.',
          verificationGuidance: 'Confirm lichen patches are distinct from green moss.',
          points: 60,
        },
        {
          id: 'item-4',
          title: 'Count Five Acorns',
          category: 'count',
          promptText: 'Look at the ground beneath an oak tree and count 5 fallen acorns or caps.',
          targetDescription: 'Group of acorns or acorn caps on soil.',
          verificationGuidance: 'Count at least 3-5 acorns in view.',
          points: 70,
        },
        {
          id: 'item-5',
          title: 'Contrast Rough vs Smooth',
          category: 'compare',
          promptText: 'Find one stone that feels smooth and one stick that feels rough.',
          targetDescription: 'Two objects side-by-side: a river stone and weathered stick.',
          verificationGuidance: 'Look for contrast in surface roughness.',
          points: 60,
        },
      ],
    };

    const parsed = QuestPlanSchema.safeParse(rawPlan);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.items).toHaveLength(5);
    }
  });

  it('rejects a quest plan with fewer than 3 items', () => {
    const deficientPlan = {
      questTitle: 'Too Short',
      themeNarrative: 'A short quest that is under the required length.',
      setting: 'street',
      items: [
        {
          id: 'item-1',
          title: 'A mailbox',
          category: 'look',
          promptText: 'Find a blue postal mailbox.',
          targetDescription: 'Blue USPS mailbox.',
          verificationGuidance: 'Mailbox',
          points: 50,
        },
      ],
    };

    const parsed = QuestPlanSchema.safeParse(deficientPlan);
    expect(parsed.success).toBe(false);
  });
});
