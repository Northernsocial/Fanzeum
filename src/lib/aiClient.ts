import type {
  AIIdentificationResult,
  AIOnboardingResponse,
  CategorySlug,
  CollectorGoal,
  PanelCard,
} from '../types/domain';
import type { PanelChatTurnResponse } from '../server/ai/panelChat';

export interface IdentifyPhotoPayload {
  base64: string;
  mimeType: string;
  label?: string;
}

export interface SendPanelChatTurnParams {
  itemId: string;
  userId?: string;
  userMessage?: string;
  photos?: IdentifyPhotoPayload[];
  historySummary?: string;
  currentCard?: PanelCard;
  personaId?: string;
}

export async function sendPanelChatTurn(
  params: SendPanelChatTurnParams,
): Promise<PanelChatTurnResponse> {
  const res = await fetch('/api/ai/panel-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data?.error || 'The expert panel is momentarily busy. Please try your question again in a moment.',
    );
  }
  return data as PanelChatTurnResponse;
}

export async function identifyCollectibleByPhoto(params: {
  photos: IdentifyPhotoPayload[];
  categoryHint?: CategorySlug;
  userNotes?: string;
  userId?: string;
}): Promise<AIIdentificationResult> {
  const res = await fetch('/api/ai/identify-item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data?.error || 'Could not identify this photo right now. You can fill in the details below.',
    );
  }
  return data as AIIdentificationResult;
}

export async function generateOnboardingGuide(params: {
  displayName: string;
  specialties: CategorySlug[];
  goal: CollectorGoal;
  location?: string;
}): Promise<AIOnboardingResponse> {
  const res = await fetch('/api/ai/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Could not generate starter collection suggestion.');
  }
  return data as AIOnboardingResponse;
}

export async function polishCollectionStory(params: {
  title: string;
  category: CategorySlug;
  draftStory: string;
}): Promise<string> {
  const res = await fetch('/api/ai/enhance-story', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Could not tidy up your story right now.');
  }
  return String(data.story || params.draftStory);
}

export async function generateListingDescription(params: {
  title: string;
  category: CategorySlug;
  condition: string;
  valueEstGbp: number;
  userNotes?: string;
}): Promise<{ title: string; description: string; suggestedPriceGbp: number }> {
  const res = await fetch('/api/ai/listing-writer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Could not draft listing description right now.');
  }
  return data as { title: string; description: string; suggestedPriceGbp: number };
}
