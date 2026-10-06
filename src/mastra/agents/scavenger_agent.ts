import { Agent } from '@mastra/core/agent';
import { OllamaService } from '../../services/ollama_service.js';
import { createGenerateQuestTool } from '../tools/generate_quest_tool.js';
import { createVerifyFindTool } from '../tools/verify_find_tool.js';
import { createNarrateTool } from '../tools/narrate_tool.js';
import { createSaveJournalTool } from '../tools/save_journal_tool.js';

export function createScavengerAgent(ollama: OllamaService, model = 'gemma3:4b') {
  const generateQuestTool = createGenerateQuestTool(ollama, model);
  const verifyFindTool = createVerifyFindTool(ollama, model);
  const narrateTool = createNarrateTool();
  const saveJournalTool = createSaveJournalTool();

  const agent = new Agent({
    name: 'SidequestScavengerAgent',
    instructions: `You are Sidequest, an offline, audio-first scavenger hunt agent for families on walks.
Your goal is to get people OFF screens and looking up at the world, trees, rocks, sky, and paths.
Always enforce safety: never prompt eating wild plants or fungi, touching unknown mushrooms, approaching wildlife, climbing high, or wading into water/roads.
Always maintain scientific humility: if visual evidence is ambiguous, say you are uncertain and ask a follow-up question.
Never state a species ID with false certainty.`,
    model: {
      provider: 'OPEN_AI_COMPATIBLE',
      name: model,
    },
    tools: {
      generate_quest: generateQuestTool,
      verify_find: verifyFindTool,
      narrate: narrateTool,
      save_journal: saveJournalTool,
    },
  });

  return {
    agent,
    tools: {
      generateQuestTool,
      verifyFindTool,
      narrateTool,
      saveJournalTool,
    },
  };
}
