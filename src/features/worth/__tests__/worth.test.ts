import { describe, it, expect } from 'vitest';
import {
  getAllWorthItems,
  getWorthItemsByCategory,
  getWorthItemBySlug,
  searchWorthItems,
} from '../../../lib/worthRepo';

describe('Worth Catalog and Repository', () => {
  it('loads all items from the catalog with valid fields', () => {
    const items = getAllWorthItems();
    expect(items.length).toBeGreaterThanOrEqual(10);

    for (const item of items) {
      expect(item.slug).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(item.category).toBeTruthy();
      expect(item.minGbp).toBeGreaterThan(0);
      expect(item.maxGbp).toBeGreaterThanOrEqual(item.minGbp);
      expect(item.baselineCollectorCount).toBeGreaterThan(0);
      expect(item.conditionTiers.length).toBeGreaterThan(0);
    }
  });

  it('filters items by category correctly', () => {
    const cards = getWorthItemsByCategory('football_cards');
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((c) => c.category === 'football_cards')).toBe(true);

    const coins = getWorthItemsByCategory('coins');
    expect(coins.length).toBeGreaterThan(0);
    expect(coins.every((c) => c.category === 'coins')).toBe(true);
  });

  it('finds item by category and slug', () => {
    const pele = getWorthItemBySlug('football_cards', '1958-alvorada-pele-rookie');
    expect(pele).toBeDefined();
    expect(pele?.title).toContain('Pelé');
    expect(pele?.minGbp).toBe(3500);

    const missing = getWorthItemBySlug('football_cards', 'non-existent-slug');
    expect(missing).toBeUndefined();
  });

  it('searches items by keyword', () => {
    const results = searchWorthItems('Penny Black');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toContain('Penny Black');
  });
});
