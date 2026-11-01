import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { CATEGORY_LIST, type CategorySlug } from '../../config/categories';
import { explorePublicItems } from '../../lib/firestoreRepo';
import type { CollectibleItemRecord } from '../../types/domain';
import { useDocumentMeta } from '../../components/DocumentMeta';
import { Button } from '../../components/ui/Button';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { EmptyState, Skeleton } from '../../components/ui/EmptyState';
import { PieceStage } from '../../components/ui/PieceStage';
import { Placard } from '../../components/ui/Placard';
import { Tabs } from '../../components/ui/Tabs';

export const ExplorePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCat = (searchParams.get('category') as CategorySlug | null) || 'all';
  const initialQ = searchParams.get('q') || '';

  const [category, setCategory] = useState<CategorySlug | 'all'>(initialCat);
  const [searchInput, setSearchInput] = useState(initialQ);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQ);
  const [sortBy, setSortBy] = useState<'newest' | 'value_desc'>('newest');
  const [pageIndex, setPageIndex] = useState(0);

  const [items, setItems] = useState<CollectibleItemRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  useDocumentMeta({
    title: 'Explore Pieces',
    description:
      'Search graded football cards, sovereigns, Victorian stamps, CGC comics, Northern Soul 45s, and vintage toys across Fanzeum.',
  });

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPageIndex(0);
    }, 220);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (category !== 'all') next.set('category', category);
    if (debouncedSearch.trim()) next.set('q', debouncedSearch.trim());
    setSearchParams(next, { replace: true });
  }, [category, debouncedSearch, setSearchParams]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const res = await explorePublicItems({
          category,
          search: debouncedSearch,
          sortBy,
          pageSize: 24,
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
  }, [category, debouncedSearch, sortBy, pageIndex]);

  const selectCategory = (next: CategorySlug | 'all') => {
    setCategory(next);
    setPageIndex(0);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12 pb-28 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-display font-semibold text-ink">
          Explore pieces
        </h1>
        <p className="text-base text-muted">
          Search by player, monarch, Stanley Gibbons or Spink reference, label, year, or @handle.
        </p>
      </div>

      {/* Search & Sort Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search
            className="w-5 h-5 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            strokeWidth={1.5}
          />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Try “Penny Black”, “Henry”, “Spink 3866”, “Motown”, or “Palitoy”…"
            className="w-full min-h-[46px] pl-11 pr-10 py-2.5 text-base rounded-xl border border-border bg-surface text-ink placeholder:text-muted/65"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              aria-label="Clear search"
              className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center absolute right-1.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink cursor-pointer"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          )}
        </div>

        <Tabs
          ariaLabel="Sort pieces"
          value={sortBy}
          onChange={(v) => {
            setSortBy(v);
            setPageIndex(0);
          }}
          options={[
            { value: 'newest', label: 'Newest' },
            { value: 'value_desc', label: 'Highest £ value' },
          ]}
        />
      </div>

      {/* Interactive Hobby Filter Bar */}
      <div
        role="group"
        aria-label="Filter by hobby"
        className="flex items-center gap-2 overflow-x-auto pb-2"
      >
        <button
          type="button"
          onClick={() => selectCategory('all')}
          className={`min-h-[40px] px-4 py-2 rounded-xl text-sm font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            category === 'all'
              ? 'bg-brass text-brass-fg border-brass'
              : 'bg-surface text-muted border-border hover:text-ink hover:border-brass/40'
          }`}
        >
          All hobbies
        </button>
        {CATEGORY_LIST.map((cat) => {
          const active = category === cat.slug;
          return (
            <button
              key={cat.slug}
              type="button"
              onClick={() => selectCategory(cat.slug)}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-sm font-medium border inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-brass text-brass-fg border-brass'
                  : 'bg-surface text-muted border-border hover:text-ink hover:border-brass/40'
              }`}
            >
              <CategoryIcon category={cat.slug} className="w-4 h-4" />
              <span>{cat.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Result Count */}
      <div className="text-sm font-mono text-muted">
        Showing {items.length} of {totalCount} {totalCount === 1 ? 'piece' : 'pieces'}
      </div>

      {/* Results Grid (24 per page) */}
      {loading && items.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, idx) => (
            <Skeleton key={idx} className="h-96" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Search className="w-6 h-6" strokeWidth={1.5} />}
          title="No matching pieces found"
          description="Try clearing your search term or switching back to All hobbies."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setSearchInput('');
                setCategory('all');
              }}
            >
              Reset filters
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10">
            {items.map((item) => (
              <div key={item.id} className="space-y-3">
                <Link to={`/i/${item.id}`} className="block">
                  <PieceStage item={item} />
                </Link>
                <div className="space-y-1 px-0.5">
                  <Link to={`/i/${item.id}`} className="block hover:text-brass transition-colors">
                    <Placard item={item} size="sm" />
                  </Link>
                  <Link
                    to={`/@${item.ownerHandle}`}
                    className="inline-block text-xs font-mono text-muted hover:text-ink"
                  >
                    @{item.ownerHandle}
                  </Link>
                </div>
              </div>
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
                {loading ? 'Loading…' : 'Load 24 more pieces'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
