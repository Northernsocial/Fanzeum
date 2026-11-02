import crypto from 'node:crypto';
import { Type, type Schema } from '@google/genai';
import { z } from 'zod';
import {
  CATEGORIES,
  CATEGORY_LIST,
  type CategoryFieldDef,
  type CategorySlug,
} from '../../config/categories.ts';
import {
  getPersonaById,
  getSpecialistForCategory,
  LEAD_APPRAISER_PERSONA,
  SPECIALIST_PERSONAS,
  type PersonaId,
} from '../../config/panel.ts';
import type { ConfidenceLevel, PanelCard, PanelChatMessage } from '../../types/domain.ts';
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

export const PanelPhotoInputSchema = z.object({
  base64: z.string().min(16),
  mimeType: z
    .string()
    .regex(/^image\/(jpeg|jpg|png|webp|gif|heic|heif)$/i, 'Unsupported image MIME type'),
  label: z.string().max(40).optional(),
});

export const PanelChatTurnRequestSchema = z.object({
  itemId: z.string().min(1).max(128),
  userId: z.string().min(1).max(128).optional(),
  userMessage: z.string().max(1000).optional(),
  photos: z.array(PanelPhotoInputSchema).max(4).optional(),
  historySummary: z.string().max(3000).optional(),
  currentCard: z
    .object({
      title: z.string().max(140),
      category: z.enum(CATEGORY_SLUGS),
      fields: z.record(
        z.string(),
        z.object({
          value: z.union([z.string(), z.boolean()]),
          confidence: z.enum(['high', 'medium', 'low']),
        }),
      ),
      conditionGuess: z.string().max(80),
      valueMinGbp: z.number().nonnegative(),
      valueMaxGbp: z.number().nonnegative(),
      valuationReason: z.string().max(300),
      overallConfidence: z.enum(['high', 'medium', 'low']),
    })
    .optional(),
  personaId: z.string().max(64).optional(),
});

export type PanelChatTurnRequest = z.infer<typeof PanelChatTurnRequestSchema>;

export interface PanelChatTurnResponse {
  leadMessage?: {
    text: string;
    personaId: string;
  };
  specialistMessage: {
    text: string;
    personaId: string;
  };
  card: PanelCard;
  summary: string;
  confidence: ConfidenceLevel;
  disclaimer: string;
  cached?: boolean;
}

const MANDATORY_DISCLAIMER = 'AI estimate, not a professional valuation or authentication.';

// Memory cache for first identification by SHA-256 hash of photos
interface CachedCardResult {
  leadText: string;
  specialistText: string;
  personaId: string;
  card: PanelCard;
  summary: string;
}

const initialTurnCache = new Map<string, CachedCardResult>();

function computePhotosHash(photos: Array<{ base64: string; mimeType: string }>): string {
  const hash = crypto.createHash('sha256');
  for (const p of photos) {
    const cleaned = p.base64.includes(',') ? p.base64.split(',')[1] || '' : p.base64;
    hash.update(cleaned);
  }
  return hash.digest('hex');
}

function estimateBase64Bytes(b64: string): number {
  const cleaned = b64.includes(',') ? b64.split(',')[1] || '' : b64;
  return Math.floor((cleaned.length * 3) / 4);
}

function stripDataPrefix(b64: string): string {
  return b64.includes(',') ? b64.split(',')[1] || '' : b64.trim();
}

function collectFieldsForCategory(catSlug?: CategorySlug): CategoryFieldDef[] {
  if (catSlug && CATEGORIES[catSlug]) {
    return CATEGORIES[catSlug].fields;
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

function buildTurnResponseSchema(targetCategory?: CategorySlug, isFirstTurn = false): Schema {
  const targetFields = collectFieldsForCategory(targetCategory);
  const fieldProps: Record<string, Schema> = {};

  for (const f of targetFields) {
    fieldProps[f.key] = {
      type: Type.OBJECT,
      description: `${f.label}: ${f.aiDescription}`,
      properties: {
        value: {
          type: f.type === 'boolean' ? Type.BOOLEAN : Type.STRING,
          description:
            f.type === 'select' && f.options
              ? `${f.aiDescription} (Allowed: ${f.options.join(', ')})`
              : f.aiDescription,
        },
        confidence: {
          type: Type.STRING,
          description: 'Confidence for this field: "high", "medium", or "low".',
        },
      },
      required: ['value', 'confidence'],
    };
  }

  const cardProperties: Record<string, Schema> = {
    title: {
      type: Type.STRING,
      description: 'Collector-grade title for the piece (max 120 chars).',
    },
    category: {
      type: Type.STRING,
      description: `Target category slug from: ${CATEGORY_SLUGS.join(', ')}.`,
    },
    conditionGuess: {
      type: Type.STRING,
      description: 'Condition estimate according to the category standard scale (e.g. Near Mint, VF-30, MNH, VG+).',
    },
    valueMinGbp: {
      type: Type.NUMBER,
      description: 'Conservative low UK market sold estimate in £ GBP.',
    },
    valueMaxGbp: {
      type: Type.NUMBER,
      description: 'Realistic high UK market sold estimate in £ GBP (>= valueMinGbp).',
    },
    valuationReason: {
      type: Type.STRING,
      description: 'One concise line explaining the £ valuation reason and sold comparables (max 180 chars).',
    },
    overallConfidence: {
      type: Type.STRING,
      description: 'Overall identification confidence: "high", "medium", or "low".',
    },
    fields: {
      type: Type.OBJECT,
      properties: fieldProps,
    },
  };

  const rootProps: Record<string, Schema> = {
    categoryDetected: {
      type: Type.STRING,
      description: `Exact category slug: ${CATEGORY_SLUGS.join(', ')}.`,
    },
    specialistMessage: {
      type: Type.STRING,
      description:
        'The specialist persona response in British English. Explain what the item is, condition and diagnostics, and if confidence is low, ask for the exact close-up photo or detail needed. Never claim item is genuine.',
    },
    card: {
      type: Type.OBJECT,
      properties: cardProperties,
      required: [
        'title',
        'category',
        'conditionGuess',
        'valueMinGbp',
        'valueMaxGbp',
        'valuationReason',
        'overallConfidence',
        'fields',
      ],
    },
    rollingSummary: {
      type: Type.STRING,
      description:
        'Concise running summary (max 300 words) capturing key identified attributes, user confirmations, missing checks, and current consensus.',
    },
  };

  if (isFirstTurn) {
    rootProps.leadIntro = {
      type: Type.STRING,
      description:
        'Lead Appraiser Arthur Vance intro (1-2 sentences) welcoming the collector, identifying the category, and introducing the specialist colleague.',
    };
  }

  return {
    type: Type.OBJECT,
    properties: rootProps,
    required: isFirstTurn
      ? ['categoryDetected', 'leadIntro', 'specialistMessage', 'card', 'rollingSummary']
      : ['categoryDetected', 'specialistMessage', 'card', 'rollingSummary'],
  };
}

function safeConfidence(raw: unknown): ConfidenceLevel {
  return raw === 'high' || raw === 'medium' || raw === 'low' ? raw : 'medium';
}

export async function processPanelChatTurn(
  rawInput: unknown,
  apiKey?: string,
): Promise<PanelChatTurnResponse> {
  const parsed = PanelChatTurnRequestSchema.parse(rawInput);
  const isFirstTurn = !parsed.currentCard && Boolean(parsed.photos && parsed.photos.length > 0);

  // Payload byte check
  if (parsed.photos && parsed.photos.length > 0) {
    let totalBytes = 0;
    for (const p of parsed.photos) {
      totalBytes += estimateBase64Bytes(p.base64);
    }
    if (totalBytes > MAX_IMAGE_BYTES) {
      const err = new Error('Photo payload exceeds 8MB. Please crop or reduce file size.');
      (err as Error & { statusCode?: number }).statusCode = 413;
      throw err;
    }
  }

  // Check cache for initial turn by photo hash
  if (isFirstTurn && parsed.photos && parsed.photos.length > 0 && !parsed.userMessage) {
    const photoHash = computePhotosHash(parsed.photos);
    const cached = initialTurnCache.get(photoHash);
    if (cached) {
      return {
        leadMessage: {
          text: cached.leadText,
          personaId: 'lead',
        },
        specialistMessage: {
          text: cached.specialistText,
          personaId: cached.personaId,
        },
        card: cached.card,
        summary: cached.summary,
        confidence: cached.card.overallConfidence,
        disclaimer: MANDATORY_DISCLAIMER,
        cached: true,
      };
    }
  }

  const ai = createGeminiClient(apiKey);

  // Determine which specialist persona to anchor on
  let targetCategory: CategorySlug = parsed.currentCard?.category || 'memorabilia';
  let specialistPersona = getSpecialistForCategory(targetCategory);

  if (parsed.personaId && parsed.personaId !== 'lead') {
    specialistPersona = getPersonaById(parsed.personaId);
    if (specialistPersona.categorySlug) {
      targetCategory = specialistPersona.categorySlug;
    }
  }

  const responseSchema = buildTurnResponseSchema(targetCategory, isFirstTurn);

  // Construct single turn prompt
  const systemLines = [
    'You are the Fanzeum AI Expert Panel operating as a synchronized team in a single model call.',
    `Lead Appraiser: ${LEAD_APPRAISER_PERSONA.name} (${LEAD_APPRAISER_PERSONA.voice}). ${LEAD_APPRAISER_PERSONA.specialistInstructions}`,
    'Panel Specialists:',
    Object.values(SPECIALIST_PERSONAS)
      .map(
        (sp) =>
          `- [${sp.specialistTitle} / ${sp.name} (${sp.id})]: Category: ${sp.categorySlug || 'various'}. Bio: ${sp.oneLineBio}. Instructions: ${sp.specialistInstructions}`,
      )
      .join('\n'),
    'Operating Rules:',
    '1. Use British English (colour, catalogue, centre, organise, £ GBP).',
    '2. Every answer must adhere to the rule: "AI estimate, not a professional valuation or authentication." NEVER claim an item is unequivocally genuine.',
    '3. Output valid JSON adhering strictly to the structured schema.',
    '4. When confidence on any detail is low, the specialist must explicitly point it out and state the exact photo or physical detail that would settle it.',
    '5. Update the structured card and the rolling summary cleanly with each turn.',
  ];

  const contentsParts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> =
    [];

  // Attach any photos provided in this turn
  if (parsed.photos && parsed.photos.length > 0) {
    for (const photo of parsed.photos) {
      contentsParts.push({
        inlineData: {
          mimeType: photo.mimeType,
          data: stripDataPrefix(photo.base64),
        },
      });
    }
  }

  const promptTurnLines = [
    isFirstTurn
      ? 'Turn Type: INITIAL IDENTIFICATION BY PHOTO.'
      : 'Turn Type: ONGOING EXPERT PANEL CHAT TURN.',
    parsed.historySummary
      ? `Rolling chat summary so far:\n${parsed.historySummary}`
      : 'No previous chat summary.',
    parsed.currentCard
      ? `Current Card State:\n${JSON.stringify(parsed.currentCard, null, 2)}`
      : 'Current Card State: None (first photo inspection).',
    parsed.userMessage ? `User's question / message: "${parsed.userMessage}"` : '',
    parsed.photos && parsed.photos.length > 0
      ? `User provided ${parsed.photos.length} photo(s) in this turn. Inspect closely.`
      : 'No new photos attached in this turn.',
    isFirstTurn
      ? 'Arthur Vance must first introduce the category and hand over to the specialist in "leadIntro". The specialist must fill "specialistMessage", produce the complete "card", and initiate the "rollingSummary".'
      : `The active specialist (${specialistPersona.name}) should directly answer the user's message, update the card fields if new info came to light, and update the rolling summary.`,
  ].filter(Boolean);

  contentsParts.push({ text: promptTurnLines.join('\n\n') });

  const geminiResponse = await generateContentWithRetry(ai, {
    model: GEMINI_FLASH_MODEL,
    contents: { parts: contentsParts },
    config: {
      systemInstruction: systemLines.join('\n\n'),
      responseMimeType: 'application/json',
      responseSchema,
    },
  });

  const rawJson = JSON.parse((geminiResponse.text ?? '{}').trim());

  const detectedCat: CategorySlug = CATEGORY_SLUGS.includes(rawJson.categoryDetected)
    ? rawJson.categoryDetected
    : CATEGORY_SLUGS.includes(rawJson.card?.category)
      ? rawJson.card.category
      : targetCategory;

  const resolvedSpecialist = getSpecialistForCategory(detectedCat);
  const catConfig = CATEGORIES[detectedCat];

  // Process Card Fields
  const rawFields =
    rawJson.card?.fields && typeof rawJson.card.fields === 'object'
      ? (rawJson.card.fields as Record<string, { value?: unknown; confidence?: unknown }>)
      : {};

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
        entry?.value !== undefined && entry?.value !== null
          ? String(entry.value).trim().slice(0, 160)
          : '';
      normalizedFields[fieldDef.key] = {
        value: strVal,
        confidence: strVal ? conf : 'low',
      };
    }
  }

  const minVal = Math.max(1, Math.round(Number(rawJson.card?.valueMinGbp) || 5));
  const maxVal = Math.max(
    minVal,
    Math.round(Number(rawJson.card?.valueMaxGbp) || Math.round(minVal * 1.35)),
  );

  const card: PanelCard = {
    title: String(rawJson.card?.title || 'Unidentified Piece').trim().slice(0, 140),
    category: detectedCat,
    fields: normalizedFields,
    conditionGuess: String(rawJson.card?.conditionGuess || 'Raw / Fair').trim().slice(0, 80),
    valueMinGbp: minVal,
    valueMaxGbp: maxVal,
    valuationReason: String(
      rawJson.card?.valuationReason || 'Based on recent UK collector sold market comparables.',
    )
      .trim()
      .slice(0, 280),
    overallConfidence: safeConfidence(rawJson.card?.overallConfidence),
  };

  const rollingSummary = String(
    rawJson.rollingSummary || `Identified as ${card.title}. Category: ${detectedCat}.`,
  )
    .trim()
    .slice(0, 3000);

  const leadText = rawJson.leadIntro ? String(rawJson.leadIntro).trim() : undefined;
  const specialistText = String(
    rawJson.specialistMessage ||
      'I have reviewed the piece and highlighted the key diagnostic features in the panel card beside our chat.',
  ).trim();

  // Cache initial turn if applicable
  if (isFirstTurn && parsed.photos && parsed.photos.length > 0 && leadText) {
    const photoHash = computePhotosHash(parsed.photos);
    initialTurnCache.set(photoHash, {
      leadText,
      specialistText,
      personaId: resolvedSpecialist.id,
      card,
      summary: rollingSummary,
    });
  }

  return {
    leadMessage: leadText
      ? {
          text: leadText,
          personaId: 'lead',
        }
      : undefined,
    specialistMessage: {
      text: specialistText,
      personaId: resolvedSpecialist.id,
    },
    card,
    summary: rollingSummary,
    confidence: card.overallConfidence,
    disclaimer: MANDATORY_DISCLAIMER,
  };
}
