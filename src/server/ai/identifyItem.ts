import { Type, type Schema } from '@google/genai';
import { z } from 'zod';
import {
  CATEGORIES,
  CATEGORY_LIST,
  type CategoryFieldDef,
  type CategorySlug,
} from '../../config/categories.ts';
import type { AIIdentificationResult, ConfidenceLevel } from '../../types/domain.ts';
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

const PhotoInputSchema = z.object({
  base64: z.string().min(16),
  mimeType: z
    .string()
    .regex(/^image\/(jpeg|jpg|png|webp|gif|heic|heif)$/i, 'Unsupported image MIME type'),
  label: z.string().max(40).optional(),
});

export const IdentifyRequestSchema = z
  .object({
    photos: z.array(PhotoInputSchema).min(1).max(4).optional(),
    imageBase64: z.string().min(16).optional(),
    mimeType: z.string().optional(),
    categoryHint: z.enum(CATEGORY_SLUGS).optional(),
    userNotes: z.string().max(600).optional(),
    userId: z.string().max(128).optional(),
  })
  .refine(
    (val) => (val.photos && val.photos.length > 0) || Boolean(val.imageBase64 && val.mimeType),
    { message: 'At least one photo is required to identify a piece.' },
  );

export type IdentifyRequestInput = z.infer<typeof IdentifyRequestSchema>;

const ConfidenceEnum = z.enum(['high', 'medium', 'low']);

const OutputValidationSchema = z.object({
  title: z.string().min(1).max(140),
  category: z.enum(CATEGORY_SLUGS),
  whatYouveGot: z.string().min(1).max(900),
  valueMinGbp: z.number().nonnegative(),
  valueMaxGbp: z.number().nonnegative(),
  valuationReason: z.string().min(1).max(280),
  overallConfidence: ConfidenceEnum,
  fields: z.record(
    z.string(),
    z.object({
      value: z.union([z.string(), z.boolean()]),
      confidence: ConfidenceEnum,
    }),
  ),
  suggestedTags: z.array(z.string()).max(8),
});

function estimateBase64Bytes(b64: string): number {
  const cleaned = b64.includes(',') ? b64.split(',')[1] || '' : b64;
  return Math.floor((cleaned.length * 3) / 4);
}

function stripDataPrefix(b64: string): string {
  return b64.includes(',') ? b64.split(',')[1] || '' : b64.trim();
}

function collectFieldsForSchema(categoryHint?: CategorySlug): CategoryFieldDef[] {
  if (categoryHint && CATEGORIES[categoryHint]) {
    return CATEGORIES[categoryHint].fields;
  }
  const map = new Map<string, CategoryFieldDef>();
  for (const cat of CATEGORY_LIST) {
    for (const field of cat.fields) {
      if (!map.has(field.key)) {
        map.set(field.key, field);
      }
    }
  }
  return Array.from(map.values());
}

function buildDynamicResponseSchema(categoryHint?: CategorySlug): Schema {
  const targetFields = collectFieldsForSchema(categoryHint);
  const fieldProps: Record<string, Schema> = {};
  const requiredFieldKeys: string[] = [];

  for (const f of targetFields) {
    requiredFieldKeys.push(f.key);
    fieldProps[f.key] = {
      type: Type.OBJECT,
      description: `${f.label}: ${f.aiDescription}`,
      properties: {
        value: {
          type: f.type === 'boolean' ? Type.BOOLEAN : Type.STRING,
          description:
            f.type === 'select' && f.options
              ? `${f.aiDescription} Allowed values: ${f.options.join(', ')}`
              : f.aiDescription,
        },
        confidence: {
          type: Type.STRING,
          description: 'Confidence for this specific field: "high", "medium", or "low".',
        },
      },
      required: ['value', 'confidence'],
    };
  }

  return {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description:
          'Collector-grade title for this piece (e.g. "1890 Queen Victoria Jubilee Crown" or "2003-04 Topps Chrome Thierry Henry Refractor #44"). Max 120 chars.',
      },
      category: {
        type: Type.STRING,
        description: `Exact category slug from: ${CATEGORY_SLUGS.join(', ')}.`,
      },
      whatYouveGot: {
        type: Type.STRING,
        description:
          '2 sentences in friendly, knowledgeable British collector English explaining what this piece is, key diagnostics visible in the photo, and what makes it desirable.',
      },
      valueMinGbp: {
        type: Type.NUMBER,
        description: 'Realistic conservative low UK market estimate in GBP (£).',
      },
      valueMaxGbp: {
        type: Type.NUMBER,
        description: 'Realistic high UK market estimate in GBP (£), >= valueMinGbp.',
      },
      valuationReason: {
        type: Type.STRING,
        description:
          'Single concise line explaining the GBP price bracket (e.g. grade, edition, margins, or recent UK sold comps). Max 180 chars.',
      },
      overallConfidence: {
        type: Type.STRING,
        description: 'Overall identification confidence: "high", "medium", or "low".',
      },
      fields: {
        type: Type.OBJECT,
        properties: fieldProps,
        required: categoryHint ? requiredFieldKeys : undefined,
      },
      suggestedTags: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Up to 6 short lowercase collector search tags.',
      },
    },
    required: [
      'title',
      'category',
      'whatYouveGot',
      'valueMinGbp',
      'valueMaxGbp',
      'valuationReason',
      'overallConfidence',
      'fields',
      'suggestedTags',
    ],
  };
}

function safeConfidence(raw: unknown): ConfidenceLevel {
  return raw === 'high' || raw === 'medium' || raw === 'low' ? raw : 'medium';
}

export async function identifyItem(
  rawInput: unknown,
  apiKey?: string,
): Promise<AIIdentificationResult> {
  const parsedInput = IdentifyRequestSchema.parse(rawInput);

  const normalizedPhotos =
    parsedInput.photos && parsedInput.photos.length > 0
      ? parsedInput.photos
      : [
          {
            base64: parsedInput.imageBase64!,
            mimeType: parsedInput.mimeType || 'image/webp',
            label: 'Front',
          },
        ];

  let totalBytes = 0;
  for (const photo of normalizedPhotos) {
    totalBytes += estimateBase64Bytes(photo.base64);
  }
  if (totalBytes > MAX_IMAGE_BYTES) {
    const err = new Error('Photo payload exceeds the 8MB limit. Please try cropping or using a smaller photo.');
    (err as Error & { statusCode?: number }).statusCode = 413;
    throw err;
  }

  const ai = createGeminiClient(apiKey);
  const categoryHint = parsedInput.categoryHint;
  const schema = buildDynamicResponseSchema(categoryHint);

  const promptLines = [
    'You are an experienced British collector, dealer, and specialist across football & trading cards, coins, stamps, comics, vinyl records, vintage toys, and sporting memorabilia.',
    categoryHint
      ? `Selected collector category: ${CATEGORIES[categoryHint].label} (${categoryHint}). Fill every field in the schema accurately for this hobby.`
      : 'Detect the best matching category slug and populate all relevant hobby fields.',
    parsedInput.userNotes ? `Collector notes: ${parsedInput.userNotes}` : '',
    normalizedPhotos.length > 1
      ? `You are viewing ${normalizedPhotos.length} photos of the same piece (e.g. front/obverse and back/reverse). Inspect both sides for mint marks, plate numbers, card numbers, matrix runouts, or slab labels.`
      : 'Inspect the photo closely for dates, legends, catalogue numbers, corners/edges, margins, or grading slab labels.',
    'If a detail (such as exact plate number, matrix runout, or back print) cannot be read clearly from the photo, give your best informed guess or leave empty string and set that field confidence to "low".',
    'Never use stiff museum words like "accession", "curatorial", "archival", "institutional", or "artefact". Write in natural, knowledgeable UK collector English using £ (GBP).',
  ].filter(Boolean);

  const parts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> =
    normalizedPhotos.map((p) => ({
      inlineData: {
        mimeType: p.mimeType,
        data: stripDataPrefix(p.base64),
      },
    }));

  parts.push({ text: promptLines.join('\n') });

  const response = await generateContentWithRetry(ai, {
    model: GEMINI_FLASH_MODEL,
    contents: { parts },
    config: {
      systemInstruction:
        'Return grounded collector identification and realistic UK sold-market £ estimates as structured JSON. Speak like a sharp, helpful British collector friend—never a stuffy museum.',
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  });

  const rawJson = JSON.parse((response.text ?? '{}').trim());

  const resolvedCategory: CategorySlug = CATEGORY_SLUGS.includes(rawJson.category)
    ? rawJson.category
    : categoryHint || 'memorabilia';

  const catConfig = CATEGORIES[resolvedCategory];
  const rawFields = (rawJson.fields && typeof rawJson.fields === 'object' ? rawJson.fields : {}) as Record<
    string,
    { value?: unknown; confidence?: unknown }
  >;

  const normalizedFields: Record<string, { value: string | boolean; confidence: ConfidenceLevel }> =
    {};

  for (const fieldDef of catConfig.fields) {
    const entry = rawFields[fieldDef.key];
    const conf = safeConfidence(entry?.confidence);
    if (fieldDef.type === 'boolean') {
      normalizedFields[fieldDef.key] = {
        value: Boolean(entry?.value),
        confidence: entry ? conf : 'low',
      };
    } else {
      const strVal =
        entry?.value !== undefined && entry?.value !== null ? String(entry.value).trim().slice(0, 160) : '';
      normalizedFields[fieldDef.key] = {
        value: strVal,
        confidence: strVal ? conf : 'low',
      };
    }
  }

  const minVal = Math.max(1, Math.round(Number(rawJson.valueMinGbp) || 5));
  const maxVal = Math.max(minVal, Math.round(Number(rawJson.valueMaxGbp) || Math.round(minVal * 1.35)));

  const tags = Array.isArray(rawJson.suggestedTags)
    ? rawJson.suggestedTags
        .map((t: unknown) => String(t).toLowerCase().trim().slice(0, 32))
        .filter(Boolean)
        .slice(0, 6)
    : [];

  const candidate: AIIdentificationResult = {
    title: String(rawJson.title || 'Unidentified Piece').trim().slice(0, 140),
    category: resolvedCategory,
    whatYouveGot: String(
      rawJson.whatYouveGot ||
        'A genuine collectible piece ready for your showcase. Check the highlighted fields below to confirm exact variety and condition.',
    )
      .trim()
      .slice(0, 900),
    valueMinGbp: minVal,
    valueMaxGbp: maxVal,
    valuationReason: String(
      rawJson.valuationReason || 'Based on typical UK collector condition and recent sold prices.',
    )
      .trim()
      .slice(0, 280),
    overallConfidence: safeConfidence(rawJson.overallConfidence),
    fields: normalizedFields,
    suggestedTags: tags,
  };

  return OutputValidationSchema.parse(candidate);
}
