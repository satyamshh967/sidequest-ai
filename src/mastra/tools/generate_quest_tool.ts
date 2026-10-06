import { createTool } from '@mastra/core/tools';
import {
  QuestSetupInputSchema,
  QuestPlanSchema,
  validateQuestSafety,
  QuestPlan,
} from '../../schemas/quest.js';
import { OllamaService } from '../../services/ollama_service.js';

export function createGenerateQuestTool(ollama: OllamaService, defaultModel = 'gemma3:4b') {
  return createTool({
    id: 'generate_quest',
    description: 'Generates a 5-8 item offline scavenger hunt quest tailored for outdoor family walks.',
    inputSchema: QuestSetupInputSchema,
    outputSchema: QuestPlanSchema,
    execute: async (rawInput: any) => {
      const input = rawInput.context ?? rawInput;

      const systemPrompt = `You are Sidequest, a nature and outdoor scavenger hunt guide for families.
Generate a structured quest of 5 to 7 items for an outdoor walk.
Items must mix different sensory and observational categories:
- "look": visually spotting natural patterns, shapes, colors.
- "listen": cupping ears, noticing birds, wind in trees, water, crunchy gravel.
- "touch_safe": touching safe textures only (rough tree bark, smooth river stones, fallen dry pinecones).
- "count": counting natural objects (e.g. 5 fallen leaves, 4 steps across a shadow).
- "compare": comparing two safe objects (e.g. rough vs smooth stone, sharp vs rounded leaf).

CRITICAL SAFETY RULES (ZERO TOLERANCE):
- NEVER suggest eating, tasting, or nibbling any wild plant, berry, or mushroom.
- NEVER instruct touching or picking wild mushrooms, fungi, stinging nettles, or poison ivy.
- NEVER suggest catching, touching, feeding, or cornering wildlife (insects, snakes, squirrels, birds).
- NEVER suggest climbing trees, walls, fences, or steep cliffs.
- NEVER suggest wading into rivers, lakes, creeks, or crossing active traffic/roads.

ACCESSIBILITY:
${input.accessibility.flatPavedOnly ? '- Walking surface MUST be strictly on flat, paved paths or sidewalks.' : ''}
${input.accessibility.lowMobility ? '- Keep search items accessible from a stationary or seated position (ground level or waist height).' : ''}
${input.accessibility.lowVision ? '- Emphasize tactile bark/stones and auditory listening clues over fine visual distinctions.' : ''}

Output must be strict JSON matching this exact structure:
{
  "questTitle": "Creative Title",
  "themeNarrative": "A warm 1-2 sentence framing story inviting explorers outside.",
  "setting": "${input.setting}",
  "safetyChecked": true,
  "items": [
    {
      "id": "item-1",
      "title": "Short title",
      "category": "look | listen | touch_safe | count | compare",
      "promptText": "Kid-friendly narrator text spoken aloud to walkers.",
      "targetDescription": "What the camera should see for verification.",
      "verificationGuidance": "Clues for what counts as a match vs what to reject.",
      "safetyNotes": "Safe handling advice (e.g. do not disturb wildlife)",
      "points": 50
    }
  ]
}`;

      const userPrompt = `Create a quest for:
- Setting: ${input.setting}
- Time available: ${input.timeAvailableMinutes} minutes
- Age band: ${input.ageBand}
- Difficulty: ${input.difficulty}
- Season and Region: ${input.seasonAndRegion}
`;

      const response = await ollama.generateStructured<QuestPlan>(
        defaultModel,
        systemPrompt,
        userPrompt,
        QuestPlanSchema
      );

      // Validate strict safety guardrails
      const safety = validateQuestSafety(response.data.items);
      if (!safety.isSafe) {
        throw new Error(
          `Generated quest violated safety guardrails: ${safety.violations.join('; ')}`
        );
      }

      return response.data;
    },
  });
}
