export type CategorySlug =
  | 'stamps'
  | 'football_cards'
  | 'trading_cards'
  | 'coins'
  | 'comics'
  | 'vinyl'
  | 'toys'
  | 'memorabilia';

export type VisibilityLevel = 'public' | 'followers' | 'private';

export type CollectorGoal = 'exhibit' | 'complete_set' | 'sell' | 'learn';

export type UserRole = 'collector' | 'expert' | 'store' | 'admin';

export type PlanTier = 'free' | 'premium' | 'store';

export type AIConfidence = 'high' | 'medium' | 'low' | 'manual';

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
  onboardingCompleted: boolean;
  collectionsCount: number;
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
  category: CategorySlug;
  visibility: VisibilityLevel;
  name: string;
  year: string;
  maker: string;
  series: string;
  setNumber: string;
  condition: string;
  valueMinGbp: number;
  valueMaxGbp: number;
  aiConfidence: AIConfidence;
  curatorialNote: string;
  imageUrl: string;
  forSale: boolean;
  isDemo?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AIIdentificationResult {
  name: string;
  category: CategorySlug;
  year: string;
  maker: string;
  series: string;
  setNumber: string;
  conditionGuess: string;
  valueMinGbp: number;
  valueMaxGbp: number;
  confidence: 'high' | 'medium' | 'low';
  curatorialNote: string;
}

export interface AIOnboardingResponse {
  welcomeNote: string;
  suggestedCollectionTitle: string;
  suggestedCollectionStory: string;
  suggestedBio: string;
  photographyTip: string;
}

export const CATEGORY_METADATA: Record<
  CategorySlug,
  { label: string; shortLabel: string; curatorDepartment: string }
> = {
  stamps: {
    label: 'Philately & Stamps',
    shortLabel: 'Stamps',
    curatorDepartment: 'Department of British & Commonwealth Philately',
  },
  football_cards: {
    label: 'Football Cards',
    shortLabel: 'Football Cards',
    curatorDepartment: 'Archive of Sporting Trade Cards',
  },
  trading_cards: {
    label: 'Trading Cards',
    shortLabel: 'Trading Cards',
    curatorDepartment: 'Cabinet of Illustrated Trade Issues',
  },
  coins: {
    label: 'Coins & Numismatics',
    shortLabel: 'Coins',
    curatorDepartment: 'Cabinet of Sovereign & Hammered Coinage',
  },
  comics: {
    label: 'Comics & Graphic Editions',
    shortLabel: 'Comics',
    curatorDepartment: 'Archive of Sequential Print',
  },
  vinyl: {
    label: 'Vinyl & First Pressings',
    shortLabel: 'Vinyl',
    curatorDepartment: 'Recorded Sound & Sleeve Archive',
  },
  toys: {
    label: 'Vintage Toys & Die-Cast',
    shortLabel: 'Toys',
    curatorDepartment: 'Industrial & Tinplate Toy Collection',
  },
  memorabilia: {
    label: 'Cultural Memorabilia',
    shortLabel: 'Memorabilia',
    curatorDepartment: 'Ephemera & Historical Artefacts',
  },
};

export const GOAL_LABELS: Record<CollectorGoal, { title: string; subtitle: string }> = {
  exhibit: {
    title: 'Curate & Exhibit',
    subtitle: 'Present pieces in a museum-grade public or private gallery.',
  },
  complete_set: {
    title: 'Complete a Set',
    subtitle: 'Track missing catalogue numbers and monitor set completion.',
  },
  sell: {
    title: 'Value & Prepare to Sell',
    subtitle: 'Catalogue condition and GBP valuation ranges for future sales.',
  },
  learn: {
    title: 'Study & Identify',
    subtitle: 'Uncover makers, dates, plates, and provenance with AI assistance.',
  },
};
