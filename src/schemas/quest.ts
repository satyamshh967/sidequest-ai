import { z } from 'zod';

export const QuestSettingEnum = z.enum(['park', 'street', 'trail', 'backyard']);
export type QuestSetting = z.infer<typeof QuestSettingEnum>;

export const AgeBandEnum = z.enum(['young_kids', 'older_kids', 'adults']);
export type AgeBand = z.infer<typeof AgeBandEnum>;

export const DifficultyEnum = z.enum(['easy', 'medium', 'curious']);
export type Difficulty = z.infer<typeof DifficultyEnum>;

export const QuestCategoryEnum = z.enum([
  'look',
  'listen',
  'touch_safe',
  'count',
  'compare',
]);
export type QuestCategory = z.infer<typeof QuestCategoryEnum>;

export const AccessibilityOptionsSchema = z.object({
  lowMobility: z.boolean().default(false),
  lowVision: z.boolean().default(false),
  flatPavedOnly: z.boolean().default(false),
});
export type AccessibilityOptions = z.infer<typeof AccessibilityOptionsSchema>;

export const QuestSetupInputSchema = z.object({
  setting: QuestSettingEnum,
  timeAvailableMinutes: z.number().int().min(5).max(180).default(30),
  ageBand: AgeBandEnum.default('young_kids'),
  difficulty: DifficultyEnum.default('easy'),
  accessibility: AccessibilityOptionsSchema.default({}),
  seasonAndRegion: z.string().min(2).max(120),
});
export type QuestSetupInput = z.infer<typeof QuestSetupInputSchema>;

export const QuestItemSchema = z.object({
  id: z.string(),
  title: z.string().min(3).max(80),
  category: QuestCategoryEnum,
  promptText: z.string().min(10).max(250),
  targetDescription: z.string().min(10).max(300),
  verificationGuidance: z.string().min(10).max(300),
  safetyNotes: z.string().max(200).optional(),
  points: z.number().int().min(10).max(100).default(50),
});
export type QuestItem = z.infer<typeof QuestItemSchema>;

export const QuestPlanSchema = z.object({
  questTitle: z.string().min(3).max(100),
  themeNarrative: z.string().min(15).max(300),
  setting: QuestSettingEnum,
  items: z.array(QuestItemSchema).min(3).max(10),
  safetyChecked: z.boolean().default(true),
});
export type QuestPlan = z.infer<typeof QuestPlanSchema>;

/**
 * Strict safety violation keywords and patterns.
 * Quests must NEVER suggest:
 * 1. Eating or ingesting any wild plants, berries, leaves, or mushrooms.
 * 2. Touching unverified wild mushrooms, fungi, or stinging plants.
 * 3. Approaching, cornering, or touching live wild animals (raccoons, snakes, wasps, etc.).
 * 4. Climbing high branches, fences, walls, or steep dangerous cliffs.
 * 5. Entering deep water, ponds, or walking into traffic/roadways.
 */
const UNSAFE_PATTERNS: { regex: RegExp; rule: string }[] = [
  {
    regex: /\b(taste|eat|ingest|chew|bite|consume|swallow|snack on|edible|nibble)\b/i,
    rule: 'Never suggest tasting, eating, or ingesting wild plants or fungi.',
  },
  {
    regex: /\b(touch|pick|gather|handle|pluck|harvest|kick)\s+(a\s+|the\s+|this\s+|that\s+|any\s+|some\s+)?(mushroom|toadstool|fungus|fungi|poison\s+ivy|poison\s+oak|nettle)\b/i,
    rule: 'Never instruct players to touch or pick wild mushrooms or stinging plants.',
  },
  {
    regex: /\b(catch|pet|chase|corner|grab|feed|touch|hold|trap)\s+(a\s+|the\s+|this\s+|that\s+|any\s+|some\s+)?(wild\s+animal|snake|wasp|bee|hornet|squirrel|raccoon|goose|geese|duck|bat|skunk|rodent)\b/i,
    rule: 'Never suggest touching, catching, feeding, or approaching live wildlife.',
  },
  {
    regex: /\b(climb\s+(up\s+)?(the\s+|a\s+|that\s+)?(high\s+tree|fence|wall|roof|cliff|rock\s+face)|jump\s+down)\b/i,
    rule: 'Never suggest climbing trees, walls, cliffs, or high structures.',
  },
  {
    regex: /\b(wade|swim|jump|dive|step)\s+(in|into|across|onto|through)\s+(a\s+|the\s+|this\s+|that\s+)?(water|river|lake|pond|creek|stream|traffic|road|highway|marsh)\b/i,
    rule: 'Never suggest entering water or moving onto active roads/traffic.',
  },
];

export interface SafetyCheckResult {
  isSafe: boolean;
  violations: string[];
}

export function validateQuestSafety(items: QuestItem[]): SafetyCheckResult {
  const violations: string[] = [];

  for (const item of items) {
    const textToCheck = `${item.title} ${item.promptText} ${item.targetDescription} ${item.verificationGuidance}`;
    for (const pattern of UNSAFE_PATTERNS) {
      if (pattern.regex.test(textToCheck)) {
        violations.push(`Item "${item.title}": ${pattern.rule}`);
      }
    }
  }

  return {
    isSafe: violations.length === 0,
    violations,
  };
}
