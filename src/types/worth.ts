import type { CategorySlug } from '../config/categories';

export interface WorthConditionTier {
  grade: string;
  priceGbp: number;
  notes?: string;
}

export interface WorthItemGuide {
  slug: string;
  category: CategorySlug;
  title: string;
  shortTitle: string;
  year: string;
  maker?: string;
  minGbp: number;
  maxGbp: number;
  medianGbp: number;
  baselineCollectorCount: number;
  description: string;
  keyFactors: string[];
  specifications: Record<string, string>;
  conditionTiers: WorthConditionTier[];
  notableVariants?: string[];
  tags: string[];
  imageUrl?: string;
}
