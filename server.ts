import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZodError } from 'zod';
import {
  checkIdentifyRateLimit,
  checkPanelDailyRateLimit,
  enhanceStory,
  handleListingWriterApi,
  identifyItem,
  onboardingSuggest,
  processPanelChatTurn,
} from './src/server/ai/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function extractClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim() || 'anon-ip';
  }
  return req.ip || req.socket.remoteAddress || 'anon-ip';
}

function formatApiError(error: unknown): { status: number; message: string } {
  if (error instanceof ZodError) {
    const first = error.issues[0];
    return {
      status: 400,
      message: first?.message || 'Invalid request payload.',
    };
  }
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const code = Number((error as { statusCode?: number }).statusCode) || 500;
    return {
      status: code,
      message: error instanceof Error ? error.message : 'Request failed.',
    };
  }
  return {
    status: 500,
    message:
      error instanceof Error
        ? error.message
        : 'AI service unavailable right now. You can fill in the details manually.',
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '12mb' }));

  app.get('/healthz', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  app.post('/api/ai/panel-chat', async (req: Request, res: Response) => {
    try {
      const ip = extractClientIp(req);
      const userId =
        req.body && typeof req.body.userId === 'string' ? req.body.userId : undefined;
      const limit = checkPanelDailyRateLimit({ ip, userId });

      res.setHeader('X-RateLimit-Remaining', String(limit.remaining));
      if (!limit.allowed) {
        res.setHeader('Retry-After', String(limit.retryAfterSeconds));
        const hoursLeft = Math.ceil(limit.retryAfterSeconds / 3600);
        res.status(429).json({
          error: `You've used your 15 expert panel messages for today on the free plan. Your questions will refresh in ${hoursLeft} hours, or you can save this piece right now to your cabinet.`,
        });
        return;
      }

      const result = await processPanelChatTurn(req.body, process.env.GEMINI_API_KEY);
      res.status(200).json(result);
    } catch (error) {
      console.error('panel-chat error:', error);
      const { status, message } = formatApiError(error);
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/ai/identify-item', async (req: Request, res: Response) => {
    try {
      const ip = extractClientIp(req);
      const userId =
        req.body && typeof req.body.userId === 'string' ? req.body.userId : undefined;
      const limit = checkIdentifyRateLimit({ ip, userId });

      res.setHeader('X-RateLimit-Remaining', String(limit.remaining));
      if (!limit.allowed) {
        res.setHeader('Retry-After', String(limit.retryAfterSeconds));
        res.status(429).json({
          error: `You've used your 20 photo identifications for this hour. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes, or enter the piece manually.`,
        });
        return;
      }

      const result = await identifyItem(req.body, process.env.GEMINI_API_KEY);
      res.status(200).json(result);
    } catch (error) {
      console.error('identify-item error:', error);
      const { status, message } = formatApiError(error);
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/ai/onboarding', async (req: Request, res: Response) => {
    try {
      const result = await onboardingSuggest(req.body, process.env.GEMINI_API_KEY);
      res.status(200).json(result);
    } catch (error) {
      console.error('onboarding error:', error);
      const { status, message } = formatApiError(error);
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/ai/enhance-story', async (req: Request, res: Response) => {
    try {
      const result = await enhanceStory(req.body, process.env.GEMINI_API_KEY);
      res.status(200).json(result);
    } catch (error) {
      console.error('enhance-story error:', error);
      const { status, message } = formatApiError(error);
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/ai/listing-writer', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Please sign in to use the AI listing writer.' });
        return;
      }

      const ip = extractClientIp(req);
      const userId =
        req.body && typeof req.body.userId === 'string' ? req.body.userId : undefined;
      const limit = checkIdentifyRateLimit({ ip, userId });

      res.setHeader('X-RateLimit-Remaining', String(limit.remaining));
      if (!limit.allowed) {
        res.setHeader('Retry-After', String(limit.retryAfterSeconds));
        res.status(429).json({
          error: `You've used your 20 photo identifications for this hour. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes, or enter the piece manually.`,
        });
        return;
      }

      const result = await handleListingWriterApi(req.body, process.env.GEMINI_API_KEY);
      res.status(200).json(result);
    } catch (error) {
      console.error('listing-writer error:', error);
      const { status, message } = formatApiError(error);
      res.status(status).json({ error: message });
    }
  });

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

  app.post('/api/billing/create-checkout-session', async (req: Request, res: Response) => {
    try {
      const { userId, email } = req.body || {};
      if (!userId) {
        res.status(400).json({ error: 'Missing userId for billing session.' });
        return;
      }
      const stripeSecret = process.env.STRIPE_SECRET_KEY;
      const priceId = process.env.STRIPE_PREMIUM_PRICE_ID || 'price_test_collector_plus';
      
      if (!stripeSecret) {
        res.status(200).json({
          url: `/settings?stripe_success=true&mode=test_stub`,
          message: 'Stripe test mode simulation activated. STRIPE_SECRET_KEY not configured.',
        });
        return;
      }

      // If Stripe secret is provided in test mode, return test mode success URL with price reference
      res.status(200).json({
        url: `/settings?stripe_success=true&price=${priceId}`,
      });
    } catch (error) {
      console.error('billing error:', error);
      res.status(500).json({ error: 'Failed to create billing session.' });
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Fanzeum server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
