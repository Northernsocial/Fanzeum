import { ZodError } from 'zod';
import {
  checkIdentifyRateLimit,
  checkPanelDailyRateLimit,
  enhanceStory,
  identifyItem,
  onboardingSuggest,
  preGradeItem,
  processPanelChatTurn,
} from '../../../src/server/ai/index.ts';

interface CloudflareEnv {
  GEMINI_API_KEY?: string;
}

interface CloudflarePagesContext {
  request: Request;
  env: CloudflareEnv;
  params: {
    route?: string | string[];
  };
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context: CloudflarePagesContext): Promise<Response> {
  const rawRoute = context.params.route;
  const route = Array.isArray(rawRoute) ? rawRoute[0] : rawRoute;
  const apiKey = context.env.GEMINI_API_KEY;

  let body: Record<string, unknown> = {};
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'Invalid JSON request body.' }, 400);
  }

  try {
    if (route === 'panel-chat') {
      const ip =
        context.request.headers.get('CF-Connecting-IP') ||
        context.request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
        'cf-anon';
      const userId = typeof body.userId === 'string' ? body.userId : undefined;
      const limit = checkPanelDailyRateLimit({ ip, userId });

      if (!limit.allowed) {
        const hoursLeft = Math.ceil(limit.retryAfterSeconds / 3600);
        return jsonResponse(
          {
            error: `You've used your 15 expert panel messages for today on the free plan. Your questions will refresh in ${hoursLeft} hours, or you can save this piece right now to your cabinet.`,
          },
          429,
          {
            'Retry-After': String(limit.retryAfterSeconds),
            'X-RateLimit-Remaining': '0',
          },
        );
      }

      const result = await processPanelChatTurn(body, apiKey);
      return jsonResponse(result, 200, {
        'X-RateLimit-Remaining': String(limit.remaining),
      });
    }

    if (route === 'identify-item') {
      const ip =
        context.request.headers.get('CF-Connecting-IP') ||
        context.request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
        'cf-anon';
      const userId = typeof body.userId === 'string' ? body.userId : undefined;
      const limit = checkIdentifyRateLimit({ ip, userId });

      if (!limit.allowed) {
        return jsonResponse(
          {
            error: `You've used your 20 photo identifications for this hour. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes, or enter the piece manually.`,
          },
          429,
          {
            'Retry-After': String(limit.retryAfterSeconds),
            'X-RateLimit-Remaining': '0',
          },
        );
      }

      const result = await identifyItem(body, apiKey);
      return jsonResponse(result, 200, {
        'X-RateLimit-Remaining': String(limit.remaining),
      });
    }

    if (route === 'onboarding') {
      const result = await onboardingSuggest(body, apiKey);
      return jsonResponse(result, 200);
    }

    if (route === 'enhance-story') {
      const result = await enhanceStory(body, apiKey);
      return jsonResponse(result, 200);
    }

    if (route === 'pre-grade') {
      const preGradeInput = {
        itemId: typeof body.itemId === 'string' ? body.itemId : '',
        category: typeof body.category === 'string' ? body.category : undefined,
        title: typeof body.title === 'string' ? body.title : undefined,
        photoUrls: Array.isArray(body.photoUrls)
          ? body.photoUrls.filter((x): x is string => typeof x === 'string')
          : [],
        userNotes: typeof body.userNotes === 'string' ? body.userNotes : undefined,
      };
      const result = await preGradeItem(preGradeInput);
      return jsonResponse(result, 200);
    }

    return jsonResponse({ error: `Unknown AI route: ${route || ''}` }, 404);
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonResponse(
        { error: error.issues[0]?.message || 'Invalid request payload.' },
        400,
      );
    }
    const status =
      error && typeof error === 'object' && 'statusCode' in error
        ? Number((error as { statusCode?: number }).statusCode) || 500
        : 500;
    const message =
      error instanceof Error
        ? error.message
        : 'AI service unavailable right now. You can fill in the details manually.';
    return jsonResponse({ error: message }, status);
  }
}
