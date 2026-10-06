import { initMastra } from '../src/mastra/index.js';

async function main() {
  console.log('--- Testing Live Mastra Quest Generation with Gemma 3:4B ---');
  const { tools, ollama } = initMastra('http://127.0.0.1:11434', 'gemma3:4b');

  const models = await ollama.listModels();
  console.log('Available local models:', models);

  const questInput = {
    setting: 'park' as const,
    timeAvailableMinutes: 20,
    ageBand: 'young_kids' as const,
    difficulty: 'easy' as const,
    seasonAndRegion: 'Autumn / Pacific Northwest',
    accessibility: {
      flatPavedOnly: false,
      lowMobility: false,
      lowVision: false,
    },
  };

  console.log('Invoking Mastra generateQuestTool on Gemma 3:4B...');
  const start = Date.now();
  const questPlan = await tools.generateQuestTool.execute(questInput);
  const totalMs = Date.now() - start;

  console.log('\n--- SUCCESS! Mastra Generated Quest Plan: ---');
  console.log(`Title: "${questPlan.questTitle}"`);
  console.log(`Theme: "${questPlan.themeNarrative}"`);
  console.log(`Setting: "${questPlan.setting}"`);
  console.log(`Items count: ${questPlan.items.length}`);
  questPlan.items.forEach((item: any, idx: number) => {
    console.log(`  [${idx + 1}] [${item.category.toUpperCase()}] ${item.title}`);
    console.log(`      Spoken Prompt: "${item.promptText}"`);
    console.log(`      Target Visual: "${item.targetDescription}"`);
  });

  console.log(`\nInference Latency: ${totalMs}ms on RTX 5070 GPU`);
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
