import {
  GoogleGenAI,
  type GenerateContentParameters,
  type GenerateContentResponse,
} from '@google/genai';
import { GEMINI_FLASH_FALLBACK_MODEL } from './constants.ts';

export function createGeminiClient(apiKey?: string): GoogleGenAI {
  const resolvedKey = apiKey?.trim();
  if (!resolvedKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets or your Cloudflare environment.',
    );
  }
  return new GoogleGenAI({
    apiKey: resolvedKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('ECONNRESET') ||
    msg.includes('fetch failed')
  );
}

export async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: GenerateContentParameters,
  maxAttempts = 4,
): Promise<GenerateContentResponse> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const modelForAttempt =
      attempt === maxAttempts ? GEMINI_FLASH_FALLBACK_MODEL : params.model;
    try {
      return await ai.models.generateContent({
        ...params,
        model: modelForAttempt,
      });
    } catch (err) {
      lastError = err;
      if (!isTransientError(err) || attempt === maxAttempts) {
        throw err;
      }
      const delayMs = 700 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 250);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}
