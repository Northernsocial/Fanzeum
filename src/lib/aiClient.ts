import type {
  AIIdentificationResult,
  AIOnboardingResponse,
  CategorySlug,
  CollectorGoal,
} from '../types/domain';

export async function identifyCollectibleByPhoto(params: {
  imageBase64: string;
  mimeType: string;
  categoryHint?: CategorySlug;
  userNotes?: string;
}): Promise<AIIdentificationResult> {
  const res = await fetch('/api/ai/identify-item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'AI identification failed.');
  }
  return data as AIIdentificationResult;
}

export async function generateCuratorialOnboarding(params: {
  displayName: string;
  specialties: CategorySlug[];
  goal: CollectorGoal;
  personalNote?: string;
}): Promise<AIOnboardingResponse> {
  const res = await fetch('/api/ai/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Could not generate curatorial onboarding guide.');
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
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Could not refine story right now.');
  }
  return String(data.story || params.draftStory);
}
