import { describe, it, expect } from 'vitest';
import { validateQuestSafety, QuestItem } from '../src/schemas/quest.js';

describe('Safety Guardrails Validator', () => {
  it('passes completely safe, sensory outdoor quest items', () => {
    const safeItems: QuestItem[] = [
      {
        id: 'item-1',
        title: 'Find rough oak bark',
        category: 'touch_safe',
        promptText: 'Feel the craggy bark of an oak tree with your fingertips. How does it compare to smooth birch?',
        targetDescription: 'Close-up texture of mature oak tree bark showing deep grooves.',
        verificationGuidance: 'Match if rough grooved tree bark is visible. Do not accept smooth surfaces.',
        points: 50,
      },
      {
        id: 'item-2',
        title: 'Listen for three bird calls',
        category: 'listen',
        promptText: 'Stop quietly under a tree and cup your ears. Can you hear three distinct chirps?',
        targetDescription: 'Sound of songbirds or photo of bird perched high safely.',
        verificationGuidance: 'Accept songbird photo or user recording bird song.',
        points: 50,
      },
      {
        id: 'item-3',
        title: 'Compare two fallen leaves',
        category: 'compare',
        promptText: 'Find two dry fallen leaves on the ground. Which one has sharper lobes?',
        targetDescription: 'Two dead fallen leaves placed side by side on ground or path.',
        verificationGuidance: 'Check that two distinct leaves are shown in frame.',
        points: 50,
      },
    ];

    const result = validateQuestSafety(safeItems);
    expect(result.isSafe).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('rejects prompts suggesting ingestion or tasting of wild plants or mushrooms', () => {
    const unsafeItems: QuestItem[] = [
      {
        id: 'unsafe-1',
        title: 'Taste wild berries',
        category: 'look',
        promptText: 'Find bright red berries on a bush and nibble one to see if it is sweet!',
        targetDescription: 'Red berries on shrub',
        verificationGuidance: 'Check if berries are red',
        points: 50,
      },
    ];

    const result = validateQuestSafety(unsafeItems);
    expect(result.isSafe).toBe(false);
    expect(result.violations.some((v) => v.includes('Never suggest tasting, eating, or ingesting'))).toBe(true);
  });

  it('rejects prompts instructing players to pick or touch mushrooms/fungi', () => {
    const unsafeItems: QuestItem[] = [
      {
        id: 'unsafe-2',
        title: 'Pick a forest mushroom',
        category: 'touch_safe',
        promptText: 'Find a woodland mushroom and pick the toadstool to examine the gills underneath.',
        targetDescription: 'Mushroom gills',
        verificationGuidance: 'Check mushroom gills',
        points: 50,
      },
    ];

    const result = validateQuestSafety(unsafeItems);
    expect(result.isSafe).toBe(false);
    expect(result.violations.some((v) => v.includes('touch or pick wild mushrooms'))).toBe(true);
  });

  it('rejects prompts directing players to approach or touch wild animals', () => {
    const unsafeItems: QuestItem[] = [
      {
        id: 'unsafe-3',
        title: 'Pet a squirrel',
        category: 'look',
        promptText: 'Sneak up on that squirrel by the trash bin and pet a squirrel gently.',
        targetDescription: 'Squirrel close-up',
        verificationGuidance: 'Squirrel',
        points: 50,
      },
    ];

    const result = validateQuestSafety(unsafeItems);
    expect(result.isSafe).toBe(false);
    expect(result.violations.some((v) => v.includes('Never suggest touching, catching, feeding, or approaching'))).toBe(true);
  });

  it('rejects climbing high trees or structures', () => {
    const unsafeItems: QuestItem[] = [
      {
        id: 'unsafe-4',
        title: 'Climb a high tree',
        category: 'look',
        promptText: 'Climb up the high tree branch to get a view over the canopy.',
        targetDescription: 'View from high branch',
        verificationGuidance: 'View from top',
        points: 50,
      },
    ];

    const result = validateQuestSafety(unsafeItems);
    expect(result.isSafe).toBe(false);
    expect(result.violations.some((v) => v.includes('Never suggest climbing'))).toBe(true);
  });

  it('rejects wading into bodies of water or stepping into traffic', () => {
    const unsafeItems: QuestItem[] = [
      {
        id: 'unsafe-5',
        title: 'Step into the river',
        category: 'look',
        promptText: 'Wade into the river to see what stones are washed by the current.',
        targetDescription: 'Riverbed stones',
        verificationGuidance: 'Stones',
        points: 50,
      },
    ];

    const result = validateQuestSafety(unsafeItems);
    expect(result.isSafe).toBe(false);
    expect(result.violations.some((v) => v.includes('entering water or moving onto active roads'))).toBe(true);
  });
});
