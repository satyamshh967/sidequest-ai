import { createTool } from '@mastra/core/tools';
import {
  VerificationRequestSchema,
  VerificationResultSchema,
  VerificationResult,
} from '../../schemas/verification.js';
import { OllamaService } from '../../services/ollama_service.js';

export function createVerifyFindTool(ollama: OllamaService, defaultModel = 'gemma3:4b') {
  return createTool({
    id: 'verify_find',
    description: 'Verifies an outdoor scavenger hunt find photo using local multimodal vision.',
    inputSchema: VerificationRequestSchema,
    outputSchema: VerificationResultSchema,
    execute: async (rawInput: any) => {
      const input = rawInput.context ?? rawInput;

      const systemPrompt = `You are Sidequest's honest nature verification agent.
You are evaluating a photo taken by a family or walker during a scavenger hunt.

TASK:
Verify whether the photo satisfies the scavenger hunt target:
Target item: "${input.itemTitle}"
Target description: "${input.targetDescription}"
Verification guidance: "${input.verificationGuidance}"

HONESTY & SCIENTIFIC HUMILITY RULES (CRITICAL):
1. If the photo is blurry, ambiguous, or only partially visible, do NOT guess. Set "isUncertain": true, confidence between 0.35 and 0.65, and provide a polite follow-up question.
2. If identifying a plant, tree, or bird species: NEVER state the species with 100% certainty. Always frame it as "Looks likely to be..." or "Appears similar to...". Always include a "certaintyCaveat" reminding walkers that wild visual IDs require botanical caution.
3. If the item clearly matches, set "found": true and provide an enthusiastic, kid-friendly spoken feedback (under 40 words) praising their observation skills.
4. If the item does not match, set "found": false and offer warm guidance on what to look for instead.

Output must be strict JSON matching this exact structure:
{
  "found": boolean,
  "confidence": number (between 0.0 and 1.0),
  "isUncertain": boolean,
  "speciesIdentified": string or null,
  "certaintyCaveat": string or null,
  "spokenFeedback": "Short, warm, kid-friendly spoken praise or gentle nudge.",
  "followUpQuestion": "If uncertain or curious, a question prompting closer look, else null.",
  "observationNotes": "Detailed 1-2 sentence notes for the field journal recording colors and textures."
}`;

      const userPrompt = `Scavenger hunt target: "${input.itemTitle}"
User's photo is attached. Does this image meet the criteria?`;

      const images = input.imageBase64 ? [input.imageBase64] : [];

      const response = await ollama.generateStructured<VerificationResult>(
        defaultModel,
        systemPrompt,
        userPrompt,
        VerificationResultSchema,
        images
      );

      return response.data;
    },
  });
}
