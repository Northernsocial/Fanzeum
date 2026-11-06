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

export type FollowTargetType = 'category' | 'user';

export interface FollowRecord {
  followerId: string;
  targetType: FollowTargetType;
  targetId: string;
  createdAt?: unknown;
}

export interface ItemLikeRecord {
  uid: string;
  itemId: string;
  createdAt?: unknown;
}

export interface ItemSaveRecord {
  uid: string;
  itemId: string;
  createdAt?: unknown;
}

export interface ItemCommentRecord {
  id: string;
  itemId: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorAvatarUrl: string;
  text: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ReportRecord {
  id?: string;
  reporterId: string;
  targetType: 'comment' | 'item';
  targetId: string;
  itemId: string;
  reason: string;
  createdAt?: unknown;
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
  helpedBy?: string; // Collector handle or note of who contributed ID correction
  panelStatus?: 'none' | 'confirmed' | 'disputed';
  panelConfirmedAt?: string;
  isDemo?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type IdCorrectionStatus = 'pending' | 'accepted' | 'dismissed';

export interface IdCorrectionRecord {
  id: string;
  itemId: string;
  itemOwnerId: string;
  suggesterId: string;
  suggesterHandle: string;
  suggesterName: string;
  suggestedCorrection: string; // e.g. "I think this is SG 8, not SG 7"
  note?: string; // Optional detailed explanation
  status: IdCorrectionStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type ItemSignalType = 'got' | 'want';

export interface ItemSignalRecord {
  id: string;
  itemId: string;
  userId: string;
  signalType: ItemSignalType;
  createdAt?: unknown;
}

export interface WantItemRecord {
  id: string;
  userId: string;
  category: CategorySlug;
  title: string;
  keyFields: Record<string, string | boolean>;
  notes: string;
  maxPriceGbp?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type NotificationType = 'want_match' | 'id_correction_received' | 'id_correction_accepted' | 'collector_alert' | 'follow' | 'like' | 'comment';

export interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  itemId: string;
  itemTitle: string;
  itemCategory: CategorySlug;
  read: boolean;
  createdAt?: unknown;
}

export interface FreshFindRecord {
  id: string;
  itemId: string;
  ownerId: string;
  ownerHandle: string;
  category: CategorySlug;
  title: string;
  thumbUrl: string;
  valueRange?: string;
  panelStatus?: 'none' | 'confirmed' | 'disputed';
  isDemo?: boolean;
  createdAt?: unknown;
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

export type MarketplaceListingStatus = 'active' | 'sold' | 'withdrawn';

export interface MarketplaceListingRecord {
  id: string;
  itemId: string;
  sellerId: string;
  sellerHandle: string;
  sellerName: string;
  sellerAvatarUrl?: string;
  title: string;
  description: string;
  photos: ItemPhoto[];
  priceGbp: number;
  condition: string;
  category: CategorySlug;
  status: MarketplaceListingStatus;
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
    subtitle: 'Display cards, coins, stamps or records properly and share my showcase.',
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

export interface CollectorMatchSuggestion {
  collector: UserProfile;
  score: number;
  reason: string;
  matchingItemsCount: number;
  sharedCategories: CategorySlug[];
  wantlistOverlapItems: CollectibleItemRecord[];
}
export interface ArticleRecord {
  id: string;
  title: string;
  slug: string;
  body: string;
  category: CategorySlug;
  coverImage: string;
  publishedAt?: unknown;
  authorId: string;
  updatedAt?: unknown;
}

export interface ValuationSnapshotRecord {
  snapshotId: string;
  userId: string;
  totalMinGbp: number;
  totalMaxGbp: number;
  itemsCount: number;
  date: string; // YYYY-MM-DD
  createdAt?: unknown;
}

export interface PriceAlertRecord {
  alertId: string;
  userId: string;
  targetType: 'item' | 'want';
  targetId: string;
  title: string;
  thresholdType: 'below_price' | 'gain_loss_pct';
  thresholdValue: number;
  triggered: boolean;
  triggeredAt?: unknown;
  createdAt?: unknown;
}

export type SwapStatus = 'proposed' | 'countered' | 'accepted' | 'shipped' | 'completed' | 'declined' | 'cancelled';

export interface SwapRecord {
  swapId: string;
  proposerId: string;
  proposerHandle: string;
  recipientId: string;
  recipientHandle: string;
  proposerItemIds: string[];
  recipientItemIds: string[];
  cashTopUpGbp: number;
  cashPayer: 'none' | 'proposer' | 'recipient';
  status: SwapStatus;
  proposerConfirmed: boolean;
  recipientConfirmed: boolean;
  note?: string;
  // Trade rating fields
  proposerRating?: number;
  proposerRatingNote?: string;
  recipientRating?: number;
  recipientRatingNote?: string;
  ratingCompletedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}
export interface CommunityPoll {
  question: string;
  options: string[];
  votes: Record<string, number>; // optionIndex -> count
  userVotes: Record<string, number>; // userId -> optionIndex
}

export interface CommunityThreadRecord {
  id: string;
  category: CategorySlug;
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorAvatarUrl: string;
  title: string;
  body: string;
  photoUrl?: string;
  linkedItemId?: string;
  poll?: CommunityPoll;
  replyCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface WeeklyDigestRecord {
  digestId: string;
  userId: string;
  weekLabel: string;
  summaryText: string;
  topRisers: { title: string; deltaGbp: number }[];
  newPiecesCount: number;
  valuationDeltaGbp: number;
  createdAt?: unknown;
}
export interface CommunityReplyRecord {
  id: string;
  threadId: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorAvatarUrl: string;
  text: string;
  photoUrl?: string;
  linkedItemId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TradePartnerSuggestion {
  user: UserProfile;
  score: number;
  reason: string;
  offeredItems: CollectibleItemRecord[];
  wantedItems: CollectibleItemRecord[];
}
