import { Type } from '@google/genai';
import { z } from 'zod';
import type { AIOnboardingResponse } from '../../types/domain.ts';
import { createGeminiClient, generateContentWithRetry } from './client.ts';
import { GEMINI_FLASH_MODEL } from './constants.ts';

export const OnboardingInputSchema = z.object({
  displayName: z.string().max(80).optional(),
  specialties: z.array(z.string().max(32)).max(8).optional(),
  goal: z.string().max(32).optional(),
  location: z.string().max(80).optional(),
});

const OnboardingOutputSchema = z.object({
  welcomeNote: z.string().min(1).max(500),
  suggestedCollectionTitle: z.string().min(2).max(110),
  suggestedCollectionStory: z.string().max(1200),
  suggestedBio: z.string().max(500),
  photoTip: z.string().max(400),
});

export async function onboardingSuggest(
  rawInput: unknown,
  apiKey?: string,
): Promise<AIOnboardingResponse> {
  const input = OnboardingInputSchema.parse(rawInput);
  const ai = createGeminiClient(apiKey);

  const hobbies =
    input.specialties && input.specialties.length > 0
      ? input.specialties.join(', ')
      : 'football cards, coins, stamps';

  const prompt = [
    `Collector name: ${input.displayName || 'Mate'}`,
    `Collects: ${hobbies}`,
    `Main goal: ${input.goal || 'exhibit'}`,
    input.location ? `Town/County: ${input.location}` : '',
    'Give a warm, grounded 2-sentence British collector welcome, suggest a punchy first collection title and 2-sentence intro story, a 1-sentence collector bio, and one practical phone-camera tip for shooting their pieces cleanly without glare.',
    'Never use museum jargon like "accession", "curatorial", "archival", "institutional", or "artefact".',
  ]
    .filter(Boolean)
    .join('\n');

  const response = await generateContentWithRetry(ai, {
    model: GEMINI_FLASH_MODEL,
    contents: prompt,
    config: {
      systemInstruction:
        'You are a knowledgeable British collector welcoming a fellow enthusiast to Fanzeum. Keep copy natural, warm, and collector-authentic.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          welcomeNote: { type: Type.STRING },
          suggestedCollectionTitle: { type: Type.STRING },
          suggestedCollectionStory: { type: Type.STRING },
          suggestedBio: { type: Type.STRING },
          photoTip: { type: Type.STRING },
        },
        required: [
          'welcomeNote',
          'suggestedCollectionTitle',
          'suggestedCollectionStory',
          'suggestedBio',
          'photoTip',
        ],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim());
  return OnboardingOutputSchema.parse({
    welcomeNote: String(parsed.welcomeNote || 'Good to have you here — let’s get your first piece on display.').slice(0, 500),
    suggestedCollectionTitle: String(parsed.suggestedCollectionTitle || 'Personal Grails & Favourites').slice(0, 110),
    suggestedCollectionStory: String(parsed.suggestedCollectionStory || '').slice(0, 1200),
    suggestedBio: String(parsed.suggestedBio || '').slice(0, 500),
    photoTip: String(parsed.photoTip || 'Shoot near a window in indirect daylight and tilt slabs slightly to dodge ceiling reflections.').slice(0, 400),
  });
}
