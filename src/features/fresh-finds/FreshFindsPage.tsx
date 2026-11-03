import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Sparkles } from 'lucide-react';
import { CATEGORIES, CATEGORY_LIST, type CategorySlug } from '../../config/categories';
import { listFreshFinds } from '../../lib/firestoreRepo';
import type { FreshFindRecord } from '../../types/domain';
import { useDocumentMeta } from '../../components/DocumentMeta';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { CollectorImage } from '../../components/ui/CollectorImage';
import { EmptyState, Skeleton } from '../../components/ui/EmptyState';
import { PanelConfirmedBadge } from '../../components/ui/PanelConfirmedBadge';

export const FreshFindsPage: React.FC = () => {
  useDocumentMeta({
    title: 'Fresh Finds · Community Discoveries',
    description:
      'Recently identified pieces from collector showcases across the UK. View-only cards linking to public showcases.',
  });

  const [selectedCategory, setSelectedCategory] = useState<CategorySlug | 'all'>('all');
  const [items, setItems] = useState<FreshFindRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const res = await listFreshFinds({
          category: selectedCategory,
          pageSize: 12,
          pageIndex,
        });
        if (!active) return;
        setItems(res.items);
        setTotalCount(res.totalCount);
        setHasMore(res.hasMore);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [selectedCategory, pageIndex]);

  const handleSelectCategory = (cat: CategorySlug | 'all') => {
    setSelectedCategory(cat);
    setPageIndex(0);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12 pb-28 space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 text-xs font-mono text-brass">
          <Flame className="w-4 h-4" strokeWidth={1.5} />
          <span>Community Discovery Feed</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-display font-semibold text-ink">
          Fresh Finds
        </h1>
        <p className="text-base text-muted max-w-2xl leading-relaxed">
          Recently identified pieces shared by UK collectors. View verified catalogue references, specialist badges, and guide estimates.
        </p>
      </div>

      {/* Category Tabs */}
      <div
        role="tablist"
        aria-label="Fresh Finds categories"
        className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none"
      >
        <button
          type="button"
          role="tab"
          aria-selected={selectedCategory === 'all'}
          onClick={() => handleSelectCategory('all')}
          className={`min-h-[40px] px-4 py-2 rounded-xl text-sm font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            selectedCategory === 'all'
              ? 'bg-brass text-brass-fg border-brass'
              : 'bg-surface text-muted border-border hover:text-ink hover:border-brass/40'
          }`}
        >
          All Finds
        </button>

        {CATEGORY_LIST.map((cat) => {
          const isSelected = selectedCategory === cat.slug;
          return (
            <button
              key={cat.slug}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => handleSelectCategory(cat.slug)}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-sm font-medium border inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isSelected
                  ? 'bg-brass text-brass-fg border-brass'
                  : 'bg-surface text-muted border-border hover:text-ink hover:border-brass/40'
              }`}
            >
              <CategoryIcon category={cat.slug} className="w-3.5 h-3.5" />
              <span>New in {cat.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Result Count */}
      <div className="text-xs font-mono text-muted">
        Showing {items.length} of {totalCount} {totalCount === 1 ? 'find' : 'finds'}
      </div>

      {/* Feed Cards Grid */}
      {loading && items.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, idx) => (
            <Skeleton key={idx} className="h-96" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="w-6 h-6" strokeWidth={1.5} />}
          title="No Fresh Finds in this category yet"
          description="Be the first to share an identified piece in this category!"
          action={
            selectedCategory !== 'all' ? (
              <Button variant="secondary" onClick={() => handleSelectCategory('all')}>
                Show All Finds
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {items.map((find) => (
              <Link
                key={find.id}
                to={`/i/${find.itemId}`}
                className="block group h-full"
              >
                <Card interactive className="overflow-hidden h-full flex flex-col justify-between">
                  {/* Photo area */}
                  <div className="aspect-[4/3] bg-surface-raised border-b border-border p-4 flex items-center justify-center after-hours-spotlight relative">
                    <CollectorImage
                      src={find.thumbUrl}
                      alt={find.title}
                      category={find.category}
                      className="w-full h-full"
                      imgClassName="w-full h-full object-contain"
                    />
                    {find.panelStatus === 'confirmed' && (
                      <div className="absolute top-2.5 right-2.5">
                        <PanelConfirmedBadge size="sm" iconOnly />
                      </div>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs text-muted">
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          <CategoryIcon category={find.category} className="w-3.5 h-3.5 text-brass" />
                          <span>{CATEGORIES[find.category]?.shortLabel || find.category}</span>
                        </span>
                        <span className="font-mono text-muted/70">
                          @{find.ownerHandle}
                        </span>
                      </div>

                      <h3 className="text-base font-display font-semibold text-ink group-hover:text-brass transition-colors line-clamp-2 leading-snug">
                        {find.title}
                      </h3>
                    </div>

                    {/* Value Range (Optional by owner, zero private price, zero location) */}
                    {find.valueRange && (
                      <div className="pt-2 border-t border-border flex items-center justify-between text-xs font-mono">
                        <span className="text-muted">UK Guide</span>
                        <span className="text-brass font-medium tabular-nums">
                          {find.valueRange}
                        </span>
                      </div>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {hasMore && (
            <div className="pt-6 flex justify-center">
              <Button
                variant="secondary"
                size="lg"
                disabled={loading}
                onClick={() => setPageIndex((p) => p + 1)}
              >
                {loading ? 'Loading…' : 'Load more finds'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
