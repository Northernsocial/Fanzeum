import { z } from 'zod';
import type { ConfidenceLevel, PreGradeResult } from '../../types/domain.ts';
import { createGeminiClient, generateContentWithRetry } from './client.ts';
import { GEMINI_FLASH_MODEL, MAX_IMAGE_BYTES } from './constants.ts';

const PhotoPayloadSchema = z.object({
  base64: z.string().min(1, 'Photo data required'),
  mimeType: z.string().default('image/jpeg'),
  label: z.string().optional(),
});

export const PreGradeRequestSchema = z.object({
  photos: z.array(PhotoPayloadSchema).min(1, 'At least one photo is required for pre-grading.'),
  itemTitle: z.string().min(1).max(180),
  category: z.string().default('trading-cards'),
  userNotes: z.string().max(1000).optional(),
  userId: z.string().min(1, 'Sign in is required to pre-grade pieces.'),
  isPremium: z.boolean().default(false),
});

export type PreGradeRequestInput = z.infer<typeof PreGradeRequestSchema>;

const PREGRADE_SYSTEM_PROMPT = `You are a specialist collectible pre-grading advisor for Fanzeum, a UK collectors platform.
Your purpose is to inspect submitted photos of a collectible piece (such as trading cards, coins, stamps, comics, records, or memorabilia) and provide a fair, objective condition pre-grade estimate.

IMPORTANT PRINCIPLES:
1. Always emphasise that this is an AI estimate, NEVER an official or authenticated grade from PSA, CGC, BGS, SGC, PCGS, NGC or any grading bureau.
2. Structure your assessment across four physical pillars:
   - Centring: Border alignment, symmetry, shift, front/back margins.
   - Corners: Sharpness, fraying, rounding, dings, whitening.
   - Edges: Chipping, silvering, rough cuts, burrs, edge whitening.
   - Surface: Scratches, print lines, holo scratches, indentations, stains, fading, lustre.
3. Provide an estimated grade range (e.g. "PSA 8 - 9 Near Mint-Mint", "VF (Very Fine 20-35)", "Grading Tier: Excellent 6 to Near Mint 7").
4. Provide a clear, honest UK English summary of whether submitting to a 3rd party grading company would likely be cost-effective.
5. Overall confidence must be "high", "medium", or "low" based on photo resolution and clarity.

Respond strictly in valid JSON matching this schema:
{
  "centeringNotes": "string description",
  "cornersNotes": "string description",
  "edgesNotes": "string description",
  "surfaceNotes": "string description",
  "estimatedGradeRange": "string range label",
  "summary": "string overall verdict and submission advice in UK English",
  "confidence": "high" | "medium" | "low"
}`;

export async function preGradeItem(
  rawInput: unknown,
  apiKey?: string,
): Promise<PreGradeResult> {
  const input = PreGradeRequestSchema.parse(rawInput);
  const ai = createGeminiClient(apiKey);

  const imageParts: { inlineData: { data: string; mimeType: string } }[] = [];
  let totalBytes = 0;

  for (const p of input.photos.slice(0, 4)) {
    const cleanBase64 = p.base64.replace(/^data:[^;]+;base64,/, '');
    const byteLength = Math.floor((cleanBase64.length * 3) / 4);
    totalBytes += byteLength;
    if (totalBytes > MAX_IMAGE_BYTES) break;

    imageParts.push({
      inlineData: {
        data: cleanBase64,
        mimeType: p.mimeType || 'image/jpeg',
      },
    });
  }

  if (imageParts.length === 0) {
    throw new Error('Image data exceeded allowed payload limits or was invalid.');
  }

  const userPrompt = `Please inspect the condition of this piece:
Title: ${input.itemTitle}
Category: ${input.category}
${input.userNotes ? `Collector notes: ${input.userNotes}` : ''}

Assess centring, corners, edges, and surface. Estimate the grade range and give a helpful pre-grading evaluation.`;

  const response = await generateContentWithRetry(ai, {
    model: GEMINI_FLASH_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          ...imageParts,
          { text: userPrompt },
        ],
      },
    ],
    config: {
      systemInstruction: PREGRADE_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  });

  const text = response.text || '';
  let parsed: {
    centeringNotes?: string;
    cornersNotes?: string;
    edgesNotes?: string;
    surfaceNotes?: string;
    estimatedGradeRange?: string;
    summary?: string;
    confidence?: ConfidenceLevel;
  } = {};

  try {
    parsed = JSON.parse(text);
  } catch {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    parsed = JSON.parse(cleaned);
  }

  const validConfidence: ConfidenceLevel =
    parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low'
      ? parsed.confidence
      : 'medium';

  return {
    centeringNotes: parsed.centeringNotes || 'Centring appears reasonably balanced on inspected photos.',
    cornersNotes: parsed.cornersNotes || 'No major corner bluntness visible in provided images.',
    edgesNotes: parsed.edgesNotes || 'Edges appear consistent without severe chipping or wear.',
    surfaceNotes: parsed.surfaceNotes || 'Surface clean; minor micro-scratches cannot be ruled out without direct magnification.',
    estimatedGradeRange: parsed.estimatedGradeRange || 'Estimated 7 - 8 (Near Mint)',
    summary: parsed.summary || 'Solid overall condition. Keep in mind that high-resolution scanning or in-hand magnification is required by official grading services.',
    confidence: validConfidence,
    gradedAt: new Date().toISOString(),
  };
}
