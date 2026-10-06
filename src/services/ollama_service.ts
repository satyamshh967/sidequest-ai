import { z } from 'zod';

export interface OllamaMetrics {
  totalDurationMs: number;
  promptEvalCount: number;
  evalCount: number;
  evalDurationMs: number;
}

export interface OllamaResponse<T> {
  data: T;
  metrics: OllamaMetrics;
  rawText: string;
}

function normalizeRawJson(data: any): any {
  if (!data || typeof data !== 'object') return data;

  // Handle QuestPlan normalization
  if (Array.isArray(data.items) || data.theme || data.questTitle) {
    const rawItems = Array.isArray(data.items) ? data.items : [];
    const normalizedItems = rawItems.map((item: any, idx: number) => {
      const title = item.title || item.task || item.name || `Item ${idx + 1}`;
      let category = item.category;
      if (!['look', 'listen', 'touch_safe', 'count', 'compare'].includes(category)) {
        const text = (title + ' ' + (item.promptText || item.description || '')).toLowerCase();
        if (text.includes('listen') || text.includes('sound') || text.includes('hear')) {
          category = 'listen';
        } else if (text.includes('touch') || text.includes('feel') || text.includes('texture')) {
          category = 'touch_safe';
        } else if (text.includes('count') || text.includes('how many')) {
          category = 'count';
        } else if (text.includes('compare') || text.includes('difference') || text.includes('vs')) {
          category = 'compare';
        } else {
          category = 'look';
        }
      }
      return {
        id: item.id || `item-${idx + 1}`,
        title,
        category,
        promptText: item.promptText || item.description || item.task || item.prompt || title,
        targetDescription: item.targetDescription || item.description || item.target || title,
        verificationGuidance:
          item.verificationGuidance || item.guidance || item.verification || 'Check if present.',
        safetyNotes: item.safetyNotes || 'Stay safe on the path.',
        points: typeof item.points === 'number' ? item.points : 50,
      };
    });

    return {
      questTitle: data.questTitle || data.title || data.theme || 'Outdoor Scavenger Quest',
      themeNarrative:
        data.themeNarrative || data.theme || data.narrative || 'An exciting outdoor discovery walk.',
      setting: ['park', 'street', 'trail', 'backyard'].includes(data.setting) ? data.setting : 'park',
      items: normalizedItems,
      safetyChecked: true,
    };
  }

  // Handle VerificationResult normalization
  if ('found' in data || 'isUncertain' in data || 'confidence' in data) {
    const found = Boolean(data.found);
    return {
      found,
      confidence: typeof data.confidence === 'number' ? data.confidence : found ? 0.9 : 0.2,
      isUncertain: Boolean(data.isUncertain),
      speciesIdentified: data.speciesIdentified || null,
      certaintyCaveat: data.certaintyCaveat || null,
      spokenFeedback:
        data.spokenFeedback ||
        data.feedback ||
        (found ? 'Great job finding this!' : 'Keep searching nearby!'),
      followUpQuestion: data.followUpQuestion || null,
      observationNotes:
        data.observationNotes || data.notes || (found ? 'Natural item observed on walk.' : 'Not observed.'),
    };
  }

  return data;
}

export class OllamaService {
  private baseUrl: string;

  constructor(baseUrl = 'http://127.0.0.1:11434') {
    this.baseUrl = baseUrl;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/version`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      if (!res.ok) return [];
      const json = (await res.json()) as { models?: { name: string }[] };
      return (json.models || []).map((m) => m.name);
    } catch {
      return [];
    }
  }

  /**
   * Generates schema-validated JSON with self-healing retry on parse/schema failure.
   */
  async generateStructured<T>(
    model: string,
    systemPrompt: string,
    userPrompt: string,
    schema: z.ZodSchema<T>,
    images?: string[],
    maxRetries = 2
  ): Promise<OllamaResponse<T>> {
    let attempt = 0;
    let currentPrompt = userPrompt;
    let lastError: Error | null = null;

    while (attempt <= maxRetries) {
      attempt++;
      try {
        const payload: any = {
          model,
          stream: false,
          format: 'json',
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: currentPrompt,
              ...(images && images.length > 0 ? { images } : {}),
            },
          ],
          options: {
            temperature: 0.2,
            top_p: 0.9,
          },
        };

        const startTime = Date.now();
        const res = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Ollama API error (${res.status}): ${errText}`);
        }

        const jsonRes: any = await res.json();
        const rawContent = jsonRes?.message?.content || '{}';

        // Extract JSON block if surrounded by markdown code fences
        let cleanedContent = rawContent.trim();
        if (cleanedContent.startsWith('```json')) {
          cleanedContent = cleanedContent.replace(/^```json/, '').replace(/```$/, '').trim();
        } else if (cleanedContent.startsWith('```')) {
          cleanedContent = cleanedContent.replace(/^```/, '').replace(/```$/, '').trim();
        }

        if (!cleanedContent || cleanedContent === '{}' || cleanedContent === '[]') {
          throw new Error('Ollama returned an empty response.');
        }

        let parsedJson = JSON.parse(cleanedContent);
        parsedJson = normalizeRawJson(parsedJson);
        const validation = schema.safeParse(parsedJson);

        if (!validation.success) {
          console.warn('[Ollama raw response for debug]:', rawContent);
          throw new Error(
            `Schema validation failed: ${JSON.stringify(validation.error.issues)}`
          );
        }

        const totalDurationMs = jsonRes.total_duration
          ? Math.round(jsonRes.total_duration / 1_000_000)
          : Date.now() - startTime;
        const evalDurationMs = jsonRes.eval_duration
          ? Math.round(jsonRes.eval_duration / 1_000_000)
          : 0;

        return {
          data: validation.data,
          metrics: {
            totalDurationMs,
            promptEvalCount: jsonRes.prompt_eval_count || 0,
            evalCount: jsonRes.eval_count || 0,
            evalDurationMs,
          },
          rawText: rawContent,
        };
      } catch (err: any) {
        lastError = err;
        // Self-healing retry prompt
        currentPrompt = `${userPrompt}\n\n[ATTENTION: Previous response failed with: ${err.message}. Please respond ONLY with valid, strict JSON matching the schema requirements without extra commentary.]`;
      }
    }

    throw new Error(
      `Failed to generate valid structured output after ${maxRetries} retries. Last error: ${lastError?.message}`
    );
  }
}
