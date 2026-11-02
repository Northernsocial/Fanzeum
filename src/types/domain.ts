import type { CategorySlug } from '../config/categories.ts';

export type { CategorySlug };

export type VisibilityLevel = 'public' | 'followers' | 'private';

export type CollectorGoal = 'exhibit' | 'complete_set' | 'sell' | 'learn';

export type UserRole = 'collector' | 'expert' | 'store' | 'admin';

export type PlanTier = 'free' | 'premium' | 'store';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type AIConfidence = ConfidenceLevel | 'manual';

export interface ItemPhoto {
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  label?: string; // e.g. 'Front / Obverse', 'Back / Reverse'
  blurDataUrl?: string;
}

export interface MediaCredit {
  sourceUrl: string;
  author: string;
  licence: string;
}

export interface UserProfile {
  uid: string;
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  location: string;
  specialties: CategorySlug[];
  goal: CollectorGoal;
  role: UserRole;
  plan: PlanTier;
  isVerifiedExpert: boolean;
  isPublicProfile: boolean;
  hideValues: boolean;
  hideLocation: boolean;
  onboardingCompleted: boolean;
  collectionsCount: number;
  piecesCount: number;
  joinedLabel?: string;
  isDemo?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserPrivateAccount {
  uid: string;
  email: string;
  analyticsConsent: boolean;
  marketingConsent: boolean;
  aiTrainingOptOut: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CollectionRecord {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerHandle: string;
  title: string;
  story: string;
  coverImageUrl: string;
  category: CategorySlug;
  visibility: VisibilityLevel;
  itemCount: number;
  setTargetCount: number;
  estimatedTotalMinGbp: number;
  estimatedTotalMaxGbp: number;
  featured: boolean;
  isDemo?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CollectibleItemRecord {
  id: string;
  collectionId: string;
  ownerId: string;
  ownerHandle: string;
  category: CategorySlug;
  visibility: VisibilityLevel;
  title: string;
  titleLower: string;
  story: string;
  imageUrl: string;
  thumbUrl: string;
  photos: ItemPhoto[];
  attributes: Record<string, string | boolean>;
  fieldConfidences: Record<string, ConfidenceLevel>;
  year: string;
  maker: string;
  setNumber: string;
  condition: string;
  valueMinGbp: number;
  valueMaxGbp: number;
  valuationReason: string;
  aiConfidence: AIConfidence;
  grail: boolean;
  tags: string[];
  customOrder: number;
  forSale: boolean;
  mediaCredit?: MediaCredit;
  isDemo?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ItemPrivateRecord {
  uid: string;
  itemId: string;
  acquiredDate: string;
  acquiredPriceGbp: number;
  privateNotes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AIIdentifyFieldEntry {
  value: string | boolean;
  confidence: ConfidenceLevel;
}

export interface AIIdentificationResult {
  title: string;
  category: CategorySlug;
  whatYouveGot: string;
  valueMinGbp: number;
  valueMaxGbp: number;
  valuationReason: string;
  overallConfidence: ConfidenceLevel;
  fields: Record<string, AIIdentifyFieldEntry>;
  suggestedTags: string[];
}

export interface AIOnboardingResponse {
  welcomeNote: string;
  suggestedCollectionTitle: string;
  suggestedCollectionStory: string;
  suggestedBio: string;
  photoTip: string;
}

export interface PanelCardFieldEntry {
  value: string | boolean;
  confidence: ConfidenceLevel;
}

export interface PanelCard {
  title: string;
  category: CategorySlug;
  fields: Record<string, PanelCardFieldEntry>;
  conditionGuess: string;
  valueMinGbp: number;
  valueMaxGbp: number;
  valuationReason: string;
  overallConfidence: ConfidenceLevel;
}

export interface PanelChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'lead';
  text: string;
  personaId: string;
  imageUrls?: string[];
  createdAt: string; // ISO string
}

export interface PanelChatRecord {
  itemId: string;
  ownerId: string;
  personaId: string;
  messages: PanelChatMessage[];
  summary: string;
  card: PanelCard;
  confidence: ConfidenceLevel;
  status: 'active' | 'saved' | 'closed';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export const GOAL_OPTIONS: Record<CollectorGoal, { title: string; subtitle: string }> = {
  exhibit: {
    title: 'Show off my pieces',
    subtitle: 'Display cards, coins, stamps or records properly and share my cabinet.',
  },
  complete_set: {
    title: 'Complete sets',
    subtitle: 'Track missing numbers, variants, and watch my set ring hit 100%.',
  },
  learn: {
    title: "Find out what things are worth",
    subtitle: 'Snap pieces to check printings, grades, and realistic UK £ prices.',
  },
  sell: {
    title: 'Buy and sell later',
    subtitle: 'Get my collection organised, graded, and priced ready for trading.',
  },
};
