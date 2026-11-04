import { Type, type Schema } from '@google/genai';
import { z } from 'zod';
import { CATEGORIES, type CategorySlug } from '../../config/categories.ts';
import { createGeminiClient, generateContentWithRetry } from './client.ts';
import { GEMINI_FLASH_MODEL, MAX_IMAGE_BYTES } from './constants.ts';

const CATEGORY_SLUGS = [
  'football_cards',
  'trading_cards',
  'coins',
  'stamps',
  'comics',
  'vinyl',
  'toys',
  'memorabilia',
] as const;

export const SearchByPhotoRequestSchema = z.object({
  base64: z.string().min(16),
  mimeType: z
    .string()
    .regex(/^image\/(jpeg|jpg|png|webp|gif|heic|heif)$/i, 'Unsupported image MIME type'),
  categoryHint: z.enum(CATEGORY_SLUGS).optional(),
  userId: z.string().max(128).optional(),
});

export type SearchByPhotoInput = z.infer<typeof SearchByPhotoRequestSchema>;

const SearchByPhotoOutputSchema = z.object({
  title: z.string().min(1).max(140),
  category: z.enum(CATEGORY_SLUGS),
  description: z.string().min(1).max(500),
  keywords: z.array(z.string()).max(10),
  valueMinGbp: z.number().nonnegative(),
  valueMaxGbp: z.number().nonnegative(),
});

function estimateBase64Bytes(b64: string): number {
  const cleaned = b64.includes(',') ? b64.split(',')[1] || '' : b64;
  return Math.floor((cleaned.length * 3) / 4);
}

function stripDataPrefix(b64: string): string {
  return b64.includes(',') ? b64.split(',')[1] || '' : b64.trim();
}

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'Identified title or subject of the photographed piece.',
    },
    category: {
      type: Type.STRING,
      description: `Exact category slug from: ${CATEGORY_SLUGS.join(', ')}.`,
    },
    description: {
      type: Type.STRING,
      description: 'Short knowledgeable UK collector summary of what is seen in the photo.',
    },
    keywords: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Up to 8 specific search keywords extracted from the piece (player, maker, year, set, brand).',
    },
    valueMinGbp: {
      type: Type.NUMBER,
      description: 'Realistic conservative low UK market estimate in GBP (£).',
    },
    valueMaxGbp: {
      type: Type.NUMBER,
      description: 'Realistic high UK market estimate in GBP (£).',
    },
  },
  required: ['title', 'category', 'description', 'keywords', 'valueMinGbp', 'valueMaxGbp'],
};

export async function searchByPhoto(rawInput: unknown, apiKey?: string) {
  const parsed = SearchByPhotoRequestSchema.parse(rawInput);
  if (estimateBase64Bytes(parsed.base64) > MAX_IMAGE_BYTES) {
    const err = new Error('Photo payload exceeds the 8MB limit.');
    (err as Error & { statusCode?: number }).statusCode = 413;
    throw err;
  }

  const ai = createGeminiClient(apiKey);
  const parts = [
    {
      inlineData: {
        mimeType: parsed.mimeType,
        data: stripDataPrefix(parsed.base64),
      },
    },
    {
      text: 'Examine this collectible photo. Provide a concise identification, realistic UK market price estimates in GBP (£), and a list of specific search keywords (names, brands, sets, years) to find similar pieces. Never use museum jargon like accession or artefact. Speak as a knowledgeable UK collector.',
    },
  ];

  const response = await generateContentWithRetry(ai, {
    model: GEMINI_FLASH_MODEL,
    contents: { parts },
    config: {
      systemInstruction: 'Return visual search analysis as structured JSON in UK English.',
      responseMimeType: 'application/json',
      responseSchema,
    },
  });

  const json = JSON.parse((response.text ?? '{}').trim());
  return SearchByPhotoOutputSchema.parse({
    title: String(json.title || 'Collectible Piece').trim().slice(0, 140),
    category: CATEGORY_SLUGS.includes(json.category) ? json.category : parsed.categoryHint || 'memorabilia',
    description: String(json.description || 'Identified by visual analysis.').trim().slice(0, 500),
    keywords: Array.isArray(json.keywords) ? json.keywords.map((k: unknown) => String(k).trim()).filter(Boolean).slice(0, 8) : [],
    valueMinGbp: Math.max(1, Math.round(Number(json.valueMinGbp) || 5)),
    valueMaxGbp: Math.max(1, Math.round(Number(json.valueMaxGbp) || 15)),
  });
}
