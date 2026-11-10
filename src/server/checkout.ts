import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

const PLATFORM_COMMISSION_RATE = 0.05; // 5%

interface StripeSession {
  id: string;
  metadata: Record<string, string>;
  payment_status: string;
  customer_details?: {
    email?: string;
  };
  amount_total?: number;
  currency?: string;
}

export async function verifyCheckoutSession(sessionId: string) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return { ok: false, error: 'Payments are not enabled yet. Please try again later.' };
  }

  let session: StripeSession;
  try {
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });
    if (!res.ok) {
      return { ok: false, error: 'Could not verify your payment session.' };
    }
    session = await res.json();
  } catch (err) {
    return { ok: false, error: 'Could not connect to the payment provider.' };
  }

  if (session.payment_status !== 'paid') {
    return { ok: false, error: 'Your payment has not been completed.' };
  }

  const listingId = session.metadata?.listingId;
  if (!listingId) {
    return { ok: false, error: 'Missing listing information in the payment session.' };
  }

  const buyerId = session.metadata?.buyerId;
  if (!buyerId) {
    return { ok: false, error: 'Missing buyer information in the payment session.' };
  }

  // Fetch the listing
  const listingRef = db.collection('marketplace').doc(listingId);
  const listingSnap = await listingRef.get();
  if (!listingSnap.exists) {
    return { ok: false, error: 'The listing could not be found.' };
  }
  const listing = listingSnap.data()!;
  if (listing.status !== 'active') {
    return { ok: false, error: 'This listing is no longer available.' };
  }

  const priceGbp = listing.priceGbp;
  const platformCommissionGbp = Math.round(priceGbp * PLATFORM_COMMISSION_RATE * 100) / 100;
  const sellerPayoutDue = priceGbp - platformCommissionGbp;

  // Update listing to sold
  await listingRef.update({
    status: 'sold',
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Create order doc
  const orderId = `order_${sessionId}`;
  const orderRef = db.collection('orders').doc(orderId);
  await orderRef.set({
    id: orderId,
    listingId: listingId,
    itemId: listing.itemId,
    buyerId: buyerId,
    buyerHandle: session.metadata?.buyerHandle || 'buyer',
    sellerId: listing.sellerId,
    sellerHandle: listing.sellerHandle,
    title: listing.title,
    priceGbp: priceGbp,
    platformCommissionRate: PLATFORM_COMMISSION_RATE,
    platformCommissionGbp: platformCommissionGbp,
    sellerPayoutDue: sellerPayoutDue,
    stripeSessionId: sessionId,
    status: 'paid',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { ok: true };
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  try {
    const body = await request.json() as { sessionId: string };
    if (!body.sessionId) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing session ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const result = await verifyCheckoutSession(body.sessionId);
    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
