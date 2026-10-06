import { Mastra } from '@mastra/core';
import { OllamaService } from '../services/ollama_service.js';
import { createScavengerAgent } from './agents/scavenger_agent.js';

export function initMastra(ollamaBaseUrl = 'http://127.0.0.1:11434', model = 'gemma3:4b') {
  const ollama = new OllamaService(ollamaBaseUrl);
  const { agent, tools } = createScavengerAgent(ollama, model);

  const mastra = new Mastra({
    agents: {
      scavengerAgent: agent,
    },
  });

  return { mastra, agent, tools, ollama };
}
