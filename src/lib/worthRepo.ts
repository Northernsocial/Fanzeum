import type { CategorySlug } from '../config/categories';
import type { WorthItemGuide } from '../types/worth';
import rawCatalog from '../data/worthCatalog.json';

const catalog: WorthItemGuide[] = rawCatalog as WorthItemGuide[];

export function getAllWorthItems(): WorthItemGuide[] {
  return [...catalog];
}

export function getWorthItemsByCategory(category: CategorySlug): WorthItemGuide[] {
  return catalog.filter((item) => item.category === category);
}

export function getWorthItemBySlug(
  category: CategorySlug,
  slug: string,
): WorthItemGuide | undefined {
  return catalog.find((item) => item.category === category && item.slug === slug);
}

export function getRelatedWorthItems(
  currentItem: WorthItemGuide,
  limit = 3,
): WorthItemGuide[] {
  const sameCategory = catalog.filter(
    (item) => item.category === currentItem.category && item.slug !== currentItem.slug,
  );
  if (sameCategory.length >= limit) {
    return sameCategory.slice(0, limit);
  }
  const others = catalog.filter(
    (item) => item.category !== currentItem.category && item.slug !== currentItem.slug,
  );
  return [...sameCategory, ...others].slice(0, limit);
}

export function searchWorthItems(
  query: string,
  categoryFilter?: CategorySlug | 'all',
): WorthItemGuide[] {
  const q = query.trim().toLowerCase();
  return catalog.filter((item) => {
    if (categoryFilter && categoryFilter !== 'all' && item.category !== categoryFilter) {
      return false;
    }
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.shortTitle.toLowerCase().includes(q) ||
      item.year.includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.tags.some((t) => t.toLowerCase().includes(q))
    );
  });
}
