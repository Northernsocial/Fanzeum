/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CategorySlug } from '../../types/domain';
import { createGeminiClient, generateContentWithRetry } from './client';
import { GEMINI_FLASH_MODEL } from './constants';

export async function handleListingWriterApi(req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const title = String(body.title || 'Collectible Piece');
    const category = (body.category as CategorySlug) || 'memorabilia';
    const condition = String(body.condition || 'Good');
    const valueEstGbp = Number(body.valueEstGbp) || 50;
    const userNotes = String(body.userNotes || '');

    const ai = createGeminiClient(process.env.GEMINI_API_KEY);

    const prompt = `You are an expert collectibles marketplace writer for Fanzeum in the UK.
Write an engaging, clear fixed-price listing description for a collector piece.
Title: ${title}
Category: ${category}
Condition: ${condition}
Estimated Value: £${valueEstGbp}
Collector Notes: ${userNotes}

Return ONLY clean valid JSON with:
{
  "title": "Polished listing title",
  "description": "Engaging description highlighting the condition, history and appeal for UK collectors (max 300 words)",
  "suggestedPriceGbp": ${valueEstGbp}
}`;

    const resp = await generateContentWithRetry(ai, {
      model: GEMINI_FLASH_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      },
    });

    const text = resp.text || '{}';
    const parsed = JSON.parse(text);
    return Response.json(parsed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI Listing Writer error';
    return Response.json({ error: msg }, { status: 500 });
  }
}
