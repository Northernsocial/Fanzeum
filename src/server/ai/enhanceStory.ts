import { z } from 'zod';
import { createGeminiClient, generateContentWithRetry } from './client';
import { GEMINI_FLASH_MODEL } from './constants';

export const EnhanceStoryInputSchema = z.object({
  title: z.string().max(140).optional(),
  category: z.string().max(32).optional(),
  draftStory: z.string().max(2400).optional(),
});

export async function enhanceStory(
  rawInput: unknown,
  apiKey?: string,
): Promise<{ story: string }> {
  const input = EnhanceStoryInputSchema.parse(rawInput);
  const ai = createGeminiClient(apiKey);

  const response = await generateContentWithRetry(ai, {
    model: GEMINI_FLASH_MODEL,
    contents: [
      `Title: ${input.title || 'My Collection'}`,
      `Category: ${input.category || 'collectibles'}`,
      `Rough notes: ${input.draftStory || 'Pieces picked up at fairs and shows over the years.'}`,
      'Tighten this into a natural, engaging 2–3 sentence collector story (under 650 characters) in British English. Never use stiff words like "accession", "curatorial", "archival", "institutional", or "artefact".',
    ].join('\n'),
    config: {
      systemInstruction:
        'Write authentic, readable British collector prose. Return plain text only with no markdown or quotes.',
    },
  });

  const story = String(response.text || input.draftStory || '')
    .trim()
    .slice(0, 2000);
  return { story };
}
