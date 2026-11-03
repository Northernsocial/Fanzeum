import { Type, type Schema } from '@google/genai';
import { z } from 'zod';
import { createGeminiClient, generateContentWithRetry } from './client.ts';
import { GEMINI_FLASH_MODEL } from './constants.ts';

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

export const ParseImportTextRequestSchema = z.object({
  text: z.string().min(3).max(4000),
  userId: z.string().max(128).optional(),
});

const OutputSchema = z.object({
  title: z.string().min(1).max(140),
  category: z.enum(CATEGORY_SLUGS),
  pricePaidGbp: z.number().nonnegative(),
  acquiredDate: z.string().max(40),
  sellerOrSource: z.string().max(120),
  summary: z.string().max(500),
});

const GeminiResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'Collector-grade title of the purchased or listed piece (max 120 chars).',
    },
    category: {
      type: Type.STRING,
      description: `Exact category slug from: ${CATEGORY_SLUGS.join(', ')}.`,
    },
    pricePaidGbp: {
      type: Type.NUMBER,
      description: 'Price paid in GBP (£) extracted from text (0 if not specified).',
    },
    acquiredDate: {
      type: Type.STRING,
      description: 'Acquisition date or approximate month/year extracted (e.g. "Oct 2024" or "12 May 2024").',
    },
    sellerOrSource: {
      type: Type.STRING,
      description: 'Seller, auction house, platform, or shop name if mentioned (e.g. "eBay - @collector99" or "Spink Auction").',
    },
    summary: {
      type: Type.STRING,
      description: 'Brief summary of the purchase or item in British collector English.',
    },
  },
  required: ['title', 'category', 'pricePaidGbp', 'acquiredDate', 'sellerOrSource', 'summary'],
};

export async function parseImportText(
  rawInput: unknown,
  apiKey?: string,
): Promise<{
  title: string;
  category: (typeof CATEGORY_SLUGS)[number];
  pricePaidGbp: number;
  acquiredDate: string;
  sellerOrSource: string;
  summary: string;
}> {
  const parsed = ParseImportTextRequestSchema.parse(rawInput);
  const ai = createGeminiClient(apiKey);

  const response = await generateContentWithRetry(ai, {
    model: GEMINI_FLASH_MODEL,
    contents: [
      `Text/URL/Order confirmation to parse:\n${parsed.text}`,
      'Extract collector item details, price paid in GBP (£), date, seller, and category from this order confirmation, invoice, or listing URL text. Use British collector English. Return JSON.',
    ].join('\n'),
    config: {
      systemInstruction: 'Extract collectible purchase or listing details into structured JSON. Always use £ (GBP) for prices.',
      responseMimeType: 'application/json',
      responseSchema: GeminiResponseSchema,
    },
  });

  const rawJson = JSON.parse((response.text ?? '{}').trim());
  const resolvedCategory = CATEGORY_SLUGS.includes(rawJson.category) ? rawJson.category : 'memorabilia';

  return OutputSchema.parse({
    title: String(rawJson.title || 'Imported Collectible').trim().slice(0, 140),
    category: resolvedCategory,
    pricePaidGbp: Math.max(0, Number(rawJson.pricePaidGbp) || 0),
    acquiredDate: String(rawJson.acquiredDate || 'Recent').trim().slice(0, 40),
    sellerOrSource: String(rawJson.sellerOrSource || '').trim().slice(0, 120),
    summary: String(rawJson.summary || 'Imported via Fanzeum Add From Anywhere.').trim().slice(0, 500),
  });
}
