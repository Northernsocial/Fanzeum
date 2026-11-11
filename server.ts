import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { ZodError } from 'zod';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import {
  checkIdentifyRateLimit,
  checkPanelDailyRateLimit,
  enhanceStory,
  identifyItem,
  onboardingSuggest,
  processPanelChatTurn,
} from './src/server/ai/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ApiError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

interface ServiceAccountJson {
  type: string;
  project_id: string;
  private_key: string;
  client_email: string;
  token_uri: string;
}

interface DecodedJwtHeader {
  alg: string;
  kid: string;
  typ: string;
}

interface DecodedJwtPayload {
  sub: string;
  aud: string;
  iss: string;
  exp: number;
  iat: number;
}

const FIREBASE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

function base64UrlDecode(str: string): string {
  const padding = '='.repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(
    str.replace(/-/g, '+').replace(/_/g, '/') + padding,
    'base64'
  ).toString('utf8');
}

function parseJwt(token: string): {
  header: DecodedJwtHeader;
  payload: DecodedJwtPayload;
} {
  const [headerB64, payloadB64] = token.split('.');
  if (!headerB64 || !payloadB64) throw new ApiError(401, 'Malformed ID token.');
  const header = JSON.parse(base64UrlDecode(headerB64)) as DecodedJwtHeader;
  const payload = JSON.parse(base64UrlDecode(payloadB64)) as DecodedJwtPayload;
  return { header, payload };
}

let firebaseCertsCache: Record<string, string> | null = null;
let firebaseCertsExpiry = 0;

async function getFirebaseCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (firebaseCertsCache && firebaseCertsExpiry > now) return firebaseCertsCache;
  const res = await fetch(FIREBASE_CERTS_URL);
  if (!res.ok) throw new ApiError(500, 'Unable to fetch Firebase public keys.');
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAge = maxAgeMatch
    ? Number(maxAgeMatch[1]) * 1000
    : 60 * 60 * 1000;
  firebaseCertsCache = (await res.json()) as Record<string, string>;
  firebaseCertsExpiry = now + maxAge;
  return firebaseCertsCache;
}

async function verifyFirebaseIdToken(
  idToken: string,
  projectId: string
): Promise<{ uid: string }> {
  try {
    const auth = getAuth();
    const decoded = await auth.verifyIdToken(idToken, true);
    if (decoded.aud !== projectId) {
      throw new ApiError(401, 'Invalid token audience.');
    }
    return { uid: decoded.uid };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, 'Invalid or expired ID token.');
  }
}

let serviceAccountCache: ServiceAccountJson | null = null;

function loadServiceAccount(): ServiceAccountJson {
  if (serviceAccountCache) return serviceAccountCache;
  const raw = process.env.FIREBASE_SA_JSON;
  if (!raw) throw new ApiError(503, 'Server service account not configured.');
  serviceAccountCache = JSON.parse(raw) as ServiceAccountJson;
  return serviceAccountCache;
}

function getPrivateKeyPem(privateKey: string): string {
  if (privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    return privateKey;
  }
  return `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
}

async function getFirestoreAccessToken(): Promise<{
  token: string;
  projectId: string;
}> {
  const sa = loadServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    sub: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  };
  const header = { alg: 'RS256', typ: 'JWT' };
  const encode = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  const signingInput = `${encode(header)}.${encode(claim)}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  const privateKeyPem = getPrivateKeyPem(sa.private_key);
  const signature = signer.sign(privateKeyPem, 'base64url');
  const jwt = `${signingInput}.${signature}`;
  const params = new URLSearchParams();
  params.set('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  params.set('assertion', jwt);
  const res = await fetch(sa.token_uri, {
    method: 'POST',
    body: params,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(500, `Firestore auth failed: ${text}`);
  }
  const data = (await res.json()) as { access_token: string };
  return { token: data.access_token, projectId: sa.project_id };
}

async function updateSellerVerification(
  uid: string,
  status: string
): Promise<void> {
  const { token, projectId } = await getFirestoreAccessToken();
  const url =
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}` +
    `?updateMask.fieldPaths=sellerVerification.status&updateMask.fieldPaths=sellerVerification.updatedAt`;
  const body = {
    sellerVerification: {
      mapValue: {
        fields: {
          status: { stringValue: status },
          updatedAt: { timestampValue: new Date().toISOString() },
        },
      },
    },
  };
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(500, `Failed to update verification status: ${text}`);
  }
}

async function createDiditSession(
  uid: string
): Promise<{ sessionUrl: string; sessionId?: string }> {
  const apiKey = process.env.DIDIT_API_KEY;
  const workflowId = process.env.DIDIT_WORKFLOW_ID;
  if (!apiKey || !workflowId) {
    throw new ApiError(503, 'Seller verification is being set up.');
  }
  const authScheme = process.env.DIDIT_AUTH_SCHEME || 'ApiKey';
  const apiBase = process.env.DIDIT_API_BASE || 'https://api.didit.me';
  const callbackUrl = process.env.DIDIT_CALLBACK_URL;
  const body: Record<string, unknown> = {
    workflow_id: workflowId,
    vendor_data: uid,
  };
  if (callbackUrl) body.callback_url = callbackUrl;
  const res = await fetch(`${apiBase}/v1/session/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `${authScheme} ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(502, `Didit session creation failed: ${text}`);
  }
  const data = (await res.json()) as {
    session_url?: string;
    sessionUrl?: string;
    session_id?: string;
    id?: string;
  };
  const sessionUrl = data.session_url ?? data.sessionUrl;
  if (!sessionUrl || typeof sessionUrl !== 'string') {
    throw new ApiError(502, 'Didit response missing session URL.');
  }
  return { sessionUrl, sessionId: data.session_id ?? data.id };
}

function verifyDiditWebhookSignature(
  payload: Buffer,
  signatureHeader: string | undefined,
  secret: string
): void {
  if (!signatureHeader) throw new ApiError(401, 'Missing webhook signature.');
  const cleanSig = signatureHeader.trim().replace(/^["']|["']$/g, '');
  const withoutPrefix = cleanSig.startsWith('sha256=') ? cleanSig.slice(7) : cleanSig;
  const hex = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const b64 = crypto.createHmac('sha256', secret).update(payload).digest('base64');
  const sigBuf = Buffer.from(withoutPrefix, 'utf8');
  const matches = (candidate: string) => {
    const buf = Buffer.from(candidate, 'utf8');
    return buf.length === sigBuf.length && crypto.timingSafeEqual(buf, sigBuf);
  };
  if (!matches(hex) && !matches(b64)) {
    throw new ApiError(401, 'Invalid webhook signature.');
  }
}

const verifySessionRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkVerifySessionRateLimit(ip: string, userId?: string): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const key = userId ? `user:${userId}` : `ip:${ip}`;
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const maxRequests = 5; // 5 sessions per hour per user/IP
  
  const record = verifySessionRateLimitMap.get(key);
  if (!record || record.resetAt < now) {
    verifySessionRateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, retryAfterSeconds: 0 };
  }
  
  if (record.count >= maxRequests) {
    const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }
  
  record.count++;
  return { allowed: true, remaining: maxRequests - record.count, retryAfterSeconds: 0 };
}

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

  app.get('/healthz', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  app.post(
    '/api/verify/webhook',
    express.raw({ type: 'application/json' }),
    async (req: Request, res: Response) => {
      try {
        const secret = process.env.DIDIT_WEBHOOK_SECRET;
        if (!secret) {
          res
            .status(503)
            .json({ error: 'Seller verification is being set up.' });
          return;
        }
        const headerName =
          process.env.DIDIT_WEBHOOK_HEADER || 'x-didit-signature';
        const signature = req.headers[headerName.toLowerCase()] as
          | string
          | undefined;
        verifyDiditWebhookSignature(req.body as Buffer, signature, secret);
        const payload = JSON.parse((req.body as Buffer).toString('utf8'));
        
        if (!payload || typeof payload !== 'object') {
          res.status(400).json({ error: 'Invalid webhook payload.' });
          return;
        }
        
        const vendorData = payload.vendor_data;
        const status = payload.status;
        
        if (!vendorData || typeof vendorData !== 'string') {
          res.status(400).json({ error: 'Missing or invalid vendor_data.' });
          return;
        }
        if (!status || typeof status !== 'string') {
          res.status(400).json({ error: 'Missing or invalid status.' });
          return;
        }
        
        const normalized = status.toLowerCase();
        let firestoreStatus: string | null = null;
        if (
          normalized === 'approved' ||
          normalized === 'complete' ||
          normalized === 'success' ||
          normalized === 'passed'
        ) {
          firestoreStatus = 'approved';
        } else if (
          normalized === 'declined' ||
          normalized === 'rejected' ||
          normalized === 'failed' ||
          normalized === 'denied'
        ) {
          firestoreStatus = 'declined';
        } else if (
          normalized === 'pending' ||
          normalized === 'in_progress' ||
          normalized === 'started' ||
          normalized === 'processing'
        ) {
          firestoreStatus = 'pending';
        } else {
          console.warn(`Unrecognized Didit verification status: ${status}, defaulting to pending`);
          firestoreStatus = 'pending';
        }
        await updateSellerVerification(vendorData, firestoreStatus);
        res.status(200).json({ received: true, status: firestoreStatus });
      } catch (error) {
        console.error('verify webhook error:', error);
        const { status, message } = formatApiError(error);
        res.status(status).json({ error: message });
      }
    }
  );

  app.use(express.json({ limit: '12mb' }));

  app.post('/api/verify/session', async (req: Request, res: Response) => {
    try {
      const ip = extractClientIp(req);
      const sa = loadServiceAccount();
      const authHeader = req.headers.authorization || '';
      const idToken = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : '';
      if (!idToken) {
        res.status(401).json({ error: 'Sign in to start seller verification.' });
        return;
      }
      const { uid } = await verifyFirebaseIdToken(idToken, sa.project_id);
      const limit = checkVerifySessionRateLimit(ip, uid);

      res.setHeader('X-RateLimit-Remaining', String(limit.remaining));
      if (!limit.allowed) {
        res.setHeader('Retry-After', String(limit.retryAfterSeconds));
        const minutesLeft = Math.ceil(limit.retryAfterSeconds / 60);
        res.status(429).json({
          error: `Too many verification attempts. Try again in ${minutesLeft} minutes.`,
        });
        return;
      }

      const apiKey = process.env.DIDIT_API_KEY;
      const workflowId = process.env.DIDIT_WORKFLOW_ID;
      if (!apiKey || !workflowId) {
        res.status(503).json({
          error:
            'Seller verification is being set up. Please try again later.',
        });
        return;
      }
      const session = await createDiditSession(uid);
      res.status(200).json({
        sessionUrl: session.sessionUrl,
        sessionId: session.sessionId,
        status: 'pending',
      });
    } catch (error) {
      console.error('verify session error:', error);
      const { status, message } = formatApiError(error);
      res.status(status).json({ error: message });
    }
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
          error: `You've used your 15 expert panel messages for today on the free plan. Your questions will refresh in ${hoursLeft} hours, or you can save this piece right now to your Showcase.`,
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

      res.status(200).json({
        url: `/settings?stripe_success=true&price=${priceId}`,
      });
    } catch (error) {
      console.error('billing error:', error);
      res.status(500).json({ error: 'Failed to create billing session.' });
    }
  });

  function initializeFirebaseAdmin() {
    if (getApps().length === 0) {
      const sa = loadServiceAccount();
      initializeApp({
        credential: cert(sa),
        projectId: sa.project_id,
      });
    }
  }

  initializeFirebaseAdmin();

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
