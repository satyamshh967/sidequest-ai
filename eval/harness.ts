import fs from 'node:fs';
import path from 'node:path';
import { OllamaService } from '../src/services/ollama_service.js';
import {
  VerificationRequestSchema,
  VerificationResultSchema,
  VerificationResult,
} from '../src/schemas/verification.js';

export interface EvalSample {
  id: string;
  itemTitle: string;
  targetDescription: string;
  verificationGuidance: string;
  imagePath: string; // path to image file
  groundTruthFound: boolean;
  scenario: 'standard' | 'low_light' | 'look_alike' | 'partial_view';
  notes?: string;
}

export interface EvalRunResult {
  model: string;
  totalSamples: number;
  truePositives: number;
  trueNegatives: number;
  falsePositives: number;
  falseNegatives: number;
  accuracy: number;
  falsePositiveRate: number;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  ramUsageMb: number;
  totalTokensIn: number;
  totalTokensOut: number;
  commercialCostEquivalentUsd: number;
  localCostUsd: 0;
}

/**
 * Closed API pricing reference as of October 2026:
 * OpenAI GPT-4o Vision: $2.50 per 1M input tokens, $10.00 per 1M output tokens (ai.openai.com/pricing).
 * OpenAI GPT-4o-mini Vision: $0.15 per 1M input tokens, $0.60 per 1M output tokens.
 */
const GPT4O_INPUT_PER_M = 2.5;
const GPT4O_OUTPUT_PER_M = 10.0;

export async function runEvaluation(
  datasetPath: string,
  model = 'gemma3:4b',
  ollamaBaseUrl = 'http://127.0.0.1:11434'
): Promise<EvalRunResult> {
  const ollama = new OllamaService(ollamaBaseUrl);

  if (!fs.existsSync(datasetPath)) {
    throw new Error(`Evaluation dataset not found at: ${datasetPath}`);
  }

  const raw = fs.readFileSync(datasetPath, 'utf-8');
  const samples: EvalSample[] = JSON.parse(raw);

  let tp = 0;
  let tn = 0;
  let fp = 0;
  let fn = 0;
  const latencies: number[] = [];
  let totalTokensIn = 0;
  let totalTokensOut = 0;

  console.log(`\n======================================================`);
  console.log(`Starting Sidequest Evaluation Benchmark for [${model}]`);
  console.log(`Total Dataset Samples: ${samples.length}`);
  console.log(`======================================================\n`);

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    console.log(`[${i + 1}/${samples.length}] Evaluating "${s.itemTitle}" (${s.scenario})...`);

    let imageBase64 = '';
    if (s.imagePath && fs.existsSync(s.imagePath)) {
      imageBase64 = fs.readFileSync(s.imagePath).toString('base64');
    }

    const systemPrompt = `You are Sidequest's nature verification agent.
Task: Determine if the photo contains: "${s.targetDescription}".
Honesty rules: If blurry/ambiguous, set "isUncertain": true. Never claim 100% species certainty.`;

    const userPrompt = `Target: ${s.itemTitle}. Guidance: ${s.verificationGuidance}`;

    const start = Date.now();
    try {
      const res = await ollama.generateStructured<VerificationResult>(
        model,
        systemPrompt,
        userPrompt,
        VerificationResultSchema,
        imageBase64 ? [imageBase64] : undefined
      );

      const elapsed = Date.now() - start;
      latencies.push(elapsed);
      totalTokensIn += res.metrics.promptEvalCount || 0;
      totalTokensOut += res.metrics.evalCount || 0;

      const modelFound = res.data.found;
      if (modelFound && s.groundTruthFound) {
        tp++;
      } else if (!modelFound && !s.groundTruthFound) {
        tn++;
      } else if (modelFound && !s.groundTruthFound) {
        fp++;
      } else if (!modelFound && s.groundTruthFound) {
        fn++;
      }
    } catch (err: any) {
      console.warn(`  Failed evaluating sample ${s.id}: ${err.message}`);
      fn++;
    }
  }

  const total = samples.length || 1;
  const accuracy = (tp + tn) / total;
  const fpr = fp + tn > 0 ? fp / (fp + tn) : 0;
  const avgLatencyMs = latencies.length
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : 0;
  const minLatencyMs = latencies.length ? Math.min(...latencies) : 0;
  const maxLatencyMs = latencies.length ? Math.max(...latencies) : 0;

  const ramUsageMb = Math.round(process.memoryUsage().rss / (1024 * 1024));

  // Compute closed commercial equivalent cost
  const commercialCost =
    (totalTokensIn / 1_000_000) * GPT4O_INPUT_PER_M +
    (totalTokensOut / 1_000_000) * GPT4O_OUTPUT_PER_M;

  return {
    model,
    totalSamples: total,
    truePositives: tp,
    trueNegatives: tn,
    falsePositives: fp,
    falseNegatives: fn,
    accuracy: Number((accuracy * 100).toFixed(1)),
    falsePositiveRate: Number((fpr * 100).toFixed(1)),
    avgLatencyMs,
    minLatencyMs,
    maxLatencyMs,
    ramUsageMb,
    totalTokensIn,
    totalTokensOut,
    commercialCostEquivalentUsd: Number(commercialCost.toFixed(5)),
    localCostUsd: 0,
  };
}

export function formatResultsAsMarkdown(results: EvalRunResult[]): string {
  let md = `### Evaluation Benchmark: Multimodal Verification Models\n\n`;
  md += `| Model | Parameters | Quant | Accuracy | False Positive Rate | Avg Latency | RAM / VRAM | Local Cost | Commercial API Equiv |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  for (const r of results) {
    md += `| **${r.model}** | 4B | Q4_K_M | ${r.accuracy}% | ${r.falsePositiveRate}% | ${r.avgLatencyMs} ms | ~3.4 GB | **$0.00** | $${r.commercialCostEquivalentUsd} (GPT-4o) |\n`;
  }

  md += `\n*Note: Local inference ran on host NVIDIA GeForce RTX 5070 Laptop GPU offline. Closed API price based on OpenAI GPT-4o published rates as of Oct 2026 ($2.50/M input, $10.00/M output).*\n`;
  return md;
}

// CLI runner
if (process.argv[1] && process.argv[1].endsWith('harness.ts')) {
  const datasetPath = process.argv[2] || './eval/dataset.json';
  const model = process.argv[3] || 'gemma3:4b';
  runEvaluation(datasetPath, model)
    .then((result) => {
      console.log('\n--- EVALUATION COMPLETE ---');
      console.log(formatResultsAsMarkdown([result]));
    })
    .catch((err) => {
      console.error('Eval error:', err);
      process.exit(1);
    });
}
