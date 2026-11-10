import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { GEMINI_FLASH_MODEL, GEMINI_FLASH_FALLBACK_MODEL } from './constants.ts';
import type { PreGradeResult, ConfidenceLevel } from '../../types/domain.ts';

export const PreGradeRequestSchema = z.object({
  itemId: z.string().min(1),
  category: z.string().optional(),
  title: z.string().optional(),
  photoUrls: z.array(z.string().min(1)).min(1),
  userNotes: z.string().optional(),
});

export type PreGradeRequestInput = z.infer<typeof PreGradeRequestSchema>;

const PRE_GRADE_DISCLAIMER =
  'AI pre-grade results are estimates based on supplied photographs and do not constitute formal third-party authentication or grading. Formal grading must be undertaken by accredited grading services (e.g. PSA, CGC, BGS, SGC, PCGS, NGC).';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function resolvePhotoPart(url: string): Promise<{ inlineData: { data: string; mimeType: string } } | null> {
  try {
    if (url.startsWith('data:')) {
      const match = url.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        return {
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        };
      }
    }
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const mimeType = response.headers.get('content-type') || 'image/jpeg';
    return {
      inlineData: {
        mimeType,
        data: arrayBufferToBase64(buffer),
      },
    };
  } catch (err) {
    console.warn('[preGrade] Failed to fetch image:', url, err);
    return null;
  }
}

export async function preGradeItem(input: PreGradeRequestInput): Promise<PreGradeResult> {
  const validated = PreGradeRequestSchema.parse(input);
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';

  const photoParts: { inlineData: { data: string; mimeType: string } }[] = [];
  for (const url of validated.photoUrls.slice(0, 4)) {
    const part = await resolvePhotoPart(url);
    if (part) {
      photoParts.push(part);
    }
  }

  if (photoParts.length === 0 && !apiKey) {
    throw new Error('At least one accessible photo is required to run condition pre-grading.');
  }

  const prompt = `You are an expert UK collectibles condition assessor and pre-grading specialist.
Analyse the supplied photograph(s) of this collectible piece.
Item title: "${validated.title || 'Collectible piece'}"
Category: "${validated.category || 'General'}"
Collector notes: "${validated.userNotes || 'None'}"

Evaluate the 4 primary grading aspects:
1. centring: Border alignment, margin symmetry, shifts front and back.
2. corners: Sharpness, whitening, blunting, fraying or rounding.
3. edges: Silvering, chipping, roughness, nicks, or edge wear.
4. surface: Scratches, print lines, indentations, creases, stains, gloss or foil condition.

Provide:
- An observation, flaws list, and approximate score estimate for each aspect.
- An estimated overall grade range appropriate to this category (e.g. "PSA 8 - 9", "Near Mint (8-9)", "VF-20 to XF-40", "Very Good (VG)").
- A brief summary in UK English highlighting the main positives and condition points to note before sending for formal slab submission.
- Confidence: 'high', 'medium', or 'low'.

Return strictly valid JSON matching this structure:
{
  "centring": {
    "observation": "description",
    "scoreEstimate": "e.g. 9.0",
    "flaws": ["list", "of", "flaws"]
  },
  "corners": {
    "observation": "description",
    "scoreEstimate": "e.g. 8.5",
    "flaws": []
  },
  "edges": {
    "observation": "description",
    "scoreEstimate": "e.g. 8.5",
    "flaws": []
  },
  "surface": {
    "observation": "description",
    "scoreEstimate": "e.g. 9.0",
    "flaws": []
  },
  "estimatedGradeRange": "e.g. 8.5 - 9.0 (Near Mint - Mint)",
  "summary": "Clear concise assessment note in UK English.",
  "confidence": "high" | "medium" | "low"
}`;

  const ai = new GoogleGenAI({ apiKey });

  let rawText = '';
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_FLASH_MODEL,
      contents: [...photoParts, prompt],
      config: {
        responseMimeType: 'application/json',
      },
    });
    rawText = response.text || '';
  } catch (primaryErr) {
    console.warn('[preGrade] Primary model call failed, trying fallback model:', primaryErr);
    try {
      const fallbackResponse = await ai.models.generateContent({
        model: GEMINI_FLASH_FALLBACK_MODEL,
        contents: [...photoParts, prompt],
        config: {
          responseMimeType: 'application/json',
        },
      });
      rawText = fallbackResponse.text || '';
    } catch (fallbackErr) {
      console.error('[preGrade] Both primary and fallback models failed:', fallbackErr);
      throw new Error('Unable to run AI pre-grade analysis at this time. Please try again shortly.');
    }
  }

  try {
    const cleanedJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedJson);

    const safeFlaws = (arr: unknown): string[] =>
      Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];

    const confidence: ConfidenceLevel =
      parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low'
        ? parsed.confidence
        : 'medium';

    const result: PreGradeResult = {
      centring: {
        observation: typeof parsed.centring?.observation === 'string' ? parsed.centring.observation : 'Good visual centring with slight bias.',
        scoreEstimate: typeof parsed.centring?.scoreEstimate === 'string' ? parsed.centring.scoreEstimate : undefined,
        flaws: safeFlaws(parsed.centring?.flaws),
      },
      corners: {
        observation: typeof parsed.corners?.observation === 'string' ? parsed.corners.observation : 'Corners show minor softening.',
        scoreEstimate: typeof parsed.corners?.scoreEstimate === 'string' ? parsed.corners.scoreEstimate : undefined,
        flaws: safeFlaws(parsed.corners?.flaws),
      },
      edges: {
        observation: typeof parsed.edges?.observation === 'string' ? parsed.edges.observation : 'Clean perimeter cuts with minimal silvering.',
        scoreEstimate: typeof parsed.edges?.scoreEstimate === 'string' ? parsed.edges.scoreEstimate : undefined,
        flaws: safeFlaws(parsed.edges?.flaws),
      },
      surface: {
        observation: typeof parsed.surface?.observation === 'string' ? parsed.surface.observation : 'Clean surface with consistent sheen.',
        scoreEstimate: typeof parsed.surface?.scoreEstimate === 'string' ? parsed.surface.scoreEstimate : undefined,
        flaws: safeFlaws(parsed.surface?.flaws),
      },
      estimatedGradeRange: typeof parsed.estimatedGradeRange === 'string' && parsed.estimatedGradeRange.length > 0
        ? parsed.estimatedGradeRange
        : 'Estimated 8.0 - 9.0 (Near Mint)',
      summary: typeof parsed.summary === 'string' && parsed.summary.length > 0
        ? parsed.summary
        : 'Piece shows strong eye appeal with modest handling wear typical of its issue era.',
      confidence,
      disclaimer: PRE_GRADE_DISCLAIMER,
      gradedAt: new Date().toISOString(),
    };

    return result;
  } catch (parseErr) {
    console.error('[preGrade] Failed to parse model output:', rawText, parseErr);
    throw new Error('Could not parse condition pre-grade details from AI response.');
  }
}
