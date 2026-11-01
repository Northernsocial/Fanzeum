import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please verify your API key in Settings > Secrets.',
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '12mb' }));

  app.get('/healthz', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  // 1. AI Photo Identification & UK Valuation Endpoint
  app.post('/api/ai/identify-item', async (req: Request, res: Response) => {
    try {
      const { imageBase64, mimeType, categoryHint, userNotes } = req.body as {
        imageBase64?: string;
        mimeType?: string;
        categoryHint?: string;
        userNotes?: string;
      };

      if (!imageBase64 || !mimeType) {
        res.status(400).json({ error: 'Photo data and MIME type are required for identification.' });
        return;
      }

      const ai = getGenAIClient();

      const prompt = [
        'You are a senior UK museum curator, philatelist, numismatist, and sports memorabilia appraiser at Fanzeum.',
        `Category hint: ${categoryHint || 'general collectibles'}.`,
        userNotes ? `Collector context notes: ${userNotes}` : '',
        'Inspect this photograph carefully and return accurate catalogue identification, realistic preservation grade (using British/international hobby grading standards), and a conservative, realistic UK market valuation range in Pound Sterling (GBP £).',
        'If exact plate, mintmark, or print year cannot be read with certainty from the image, state the closest accurate variety and reflect that in confidence ("medium" or "low") and in curatorialNote.',
      ]
        .filter(Boolean)
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          systemInstruction:
            'Always respond with accurate, grounded curatorial metadata in GBP (£). Keep curatorialNote concise (2 sentences maximum, under 320 characters). Never fabricate impossible valuations.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: {
                type: Type.STRING,
                description: 'Full catalogue name of the item (max 120 chars).',
              },
              category: {
                type: Type.STRING,
                description:
                  'One of: stamps, football_cards, trading_cards, coins, comics, vinyl, toys, memorabilia.',
              },
              year: {
                type: Type.STRING,
                description: 'Year or approximate era of issue, e.g. "1840" or "1966".',
              },
              maker: {
                type: Type.STRING,
                description: 'Printer, mint, publisher, or manufacturer, e.g. "Royal Mint" or "A&BC Gum".',
              },
              series: {
                type: Type.STRING,
                description: 'Set name, reign, or album series.',
              },
              setNumber: {
                type: Type.STRING,
                description: 'Catalogue or card number, e.g. "SG 2", "Spink 3866", or "#42".',
              },
              conditionGuess: {
                type: Type.STRING,
                description: 'Estimated hobby condition grade, e.g. "Fine Used (4 Margins)" or "Good Very Fine (GVF)".',
              },
              valueMinGbp: {
                type: Type.NUMBER,
                description: 'Realistic low market estimate in GBP (£).',
              },
              valueMaxGbp: {
                type: Type.NUMBER,
                description: 'Realistic high market estimate in GBP (£), greater than or equal to valueMinGbp.',
              },
              confidence: {
                type: Type.STRING,
                description: 'One of: high, medium, low.',
              },
              curatorialNote: {
                type: Type.STRING,
                description: 'Two-sentence curatorial observation on key diagnostic features and preservation.',
              },
            },
            required: [
              'name',
              'category',
              'year',
              'maker',
              'series',
              'setNumber',
              'conditionGuess',
              'valueMinGbp',
              'valueMaxGbp',
              'confidence',
              'curatorialNote',
            ],
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText);

      const allowedCategories = [
        'stamps',
        'football_cards',
        'trading_cards',
        'coins',
        'comics',
        'vinyl',
        'toys',
        'memorabilia',
      ];
      const safeCategory = allowedCategories.includes(parsed.category)
        ? parsed.category
        : allowedCategories.includes(categoryHint || '')
          ? categoryHint
          : 'memorabilia';

      const minVal = Math.max(1, Math.round(Number(parsed.valueMinGbp) || 5));
      const maxVal = Math.max(minVal, Math.round(Number(parsed.valueMaxGbp) || minVal * 1.4));
      const safeConfidence = ['high', 'medium', 'low'].includes(parsed.confidence)
        ? parsed.confidence
        : 'medium';

      res.json({
        name: String(parsed.name || 'Unidentified Collectible').slice(0, 140),
        category: safeCategory,
        year: String(parsed.year || 'Unknown').slice(0, 32),
        maker: String(parsed.maker || 'Unknown Maker').slice(0, 100),
        series: String(parsed.series || 'General Issue').slice(0, 100),
        setNumber: String(parsed.setNumber || 'Unlisted').slice(0, 60),
        conditionGuess: String(parsed.conditionGuess || 'Good / Circulated').slice(0, 80),
        valueMinGbp: minVal,
        valueMaxGbp: maxVal,
        confidence: safeConfidence,
        curatorialNote: String(parsed.curatorialNote || '').slice(0, 1000),
      });
    } catch (error) {
      console.error('Gemini identify-item error:', error);
      const message =
        error instanceof Error ? error.message : 'Unable to identify photograph right now.';
      res.status(500).json({ error: message });
    }
  });

  // 2. AI Curatorial Onboarding Guide Endpoint
  app.post('/api/ai/onboarding', async (req: Request, res: Response) => {
    try {
      const { displayName, specialties, goal, personalNote } = req.body as {
        displayName?: string;
        specialties?: string[];
        goal?: string;
        personalNote?: string;
      };

      const ai = getGenAIClient();
      const chosenSpecialties =
        Array.isArray(specialties) && specialties.length > 0 ? specialties : ['stamps'];

      const prompt = [
        `Collector name: ${displayName || 'Collector'}`,
        `Collecting interests: ${chosenSpecialties.join(', ')}`,
        `Primary goal: ${goal || 'exhibit'} (options: exhibit = show off & curate, complete_set = complete a set, sell = value & sell, learn = study & discover)`,
        personalNote ? `Collector's note: ${personalNote}` : '',
        'Create a warm, knowledgeable UK gallery welcome note, propose a fitting first exhibition title and curatorial story (2–3 sentences) tailored to their interests and goal, and give one practical curatorial lighting/archival photography tip.',
      ]
        .filter(Boolean)
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction:
            'You are Fanzeum’s Chief Curator welcoming a collector in friendly, authoritative British English. Avoid clichés and hype; write like a passionate museum curator.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              welcomeNote: {
                type: Type.STRING,
                description: 'Warm 2-sentence welcome addressed to the collector.',
              },
              suggestedCollectionTitle: {
                type: Type.STRING,
                description: 'Evocative museum-worthy title for their first collection (max 90 chars).',
              },
              suggestedCollectionStory: {
                type: Type.STRING,
                description: '2-3 sentence curatorial introduction for their first exhibition (max 500 chars).',
              },
              suggestedBio: {
                type: Type.STRING,
                description: 'Concise 1-2 sentence public collector bio (max 240 chars).',
              },
              photographyTip: {
                type: Type.STRING,
                description: 'Practical tip for photographing their specific collectibles clearly.',
              },
            },
            required: [
              'welcomeNote',
              'suggestedCollectionTitle',
              'suggestedCollectionStory',
              'suggestedBio',
              'photographyTip',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({
        welcomeNote: String(parsed.welcomeNote || 'Welcome to Fanzeum.').slice(0, 500),
        suggestedCollectionTitle: String(
          parsed.suggestedCollectionTitle || 'Selected Cabinet Archive',
        ).slice(0, 110),
        suggestedCollectionStory: String(parsed.suggestedCollectionStory || '').slice(0, 1200),
        suggestedBio: String(parsed.suggestedBio || '').slice(0, 500),
        photographyTip: String(parsed.photographyTip || '').slice(0, 400),
      });
    } catch (error) {
      console.error('Gemini onboarding error:', error);
      const message =
        error instanceof Error ? error.message : 'Unable to generate onboarding guide right now.';
      res.status(500).json({ error: message });
    }
  });

  // 3. AI Curatorial Story Polish Endpoint
  app.post('/api/ai/enhance-story', async (req: Request, res: Response) => {
    try {
      const { title, category, draftStory } = req.body as {
        title?: string;
        category?: string;
        draftStory?: string;
      };

      const ai = getGenAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Collection Title: ${title || 'Untitled Exhibition'}\nCategory: ${category || 'collectibles'}\nDraft notes: ${draftStory || 'A personal archive of cherished pieces.'}\n\nRefine this into an engaging, gallery-grade 2-paragraph curatorial introduction (under 900 characters) in British English.`,
        config: {
          systemInstruction:
            'Write clean, evocative curatorial prose in British English. Return plain text only, with no markdown headings or bullet points.',
        },
      });

      res.json({
        story: String(response.text || draftStory || '').trim().slice(0, 2400),
      });
    } catch (error) {
      console.error('Gemini enhance-story error:', error);
      const message =
        error instanceof Error ? error.message : 'Unable to refine curatorial note right now.';
      res.status(500).json({ error: message });
    }
  });

  // Vite middleware in development; static SPA serving in production / Cloud Run
  const isProduction =
    process.env.NODE_ENV === 'production' || Boolean(process.env.K_SERVICE);

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Fanzeum server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
