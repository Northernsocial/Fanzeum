import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronRight, Filter, Sparkles, Search } from 'lucide-react';
import { CATEGORIES, CATEGORY_LIST, type CategorySlug } from '../../config/categories';
import { useAuth } from '../../contexts/AuthContext';
import { listPopularSets, listSetsByCategory } from '../../lib/firestoreRepo';
import type { SetRecord } from '../../types/domain';
import { useDocumentMeta } from '../../components/DocumentMeta';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { CollectorImage } from '../../components/ui/CollectorImage';
import { EmptyState, Skeleton } from '../../components/ui/EmptyState';

export const SetsPage: React.FC = () => {
  const { categorySlug } = useParams<{ categorySlug?: CategorySlug }>();
  const { firebaseUser } = useAuth();
  const isVerified = Boolean(firebaseUser?.emailVerified);

  const [sets, setSets] = useState<SetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<CategorySlug>(categorySlug || 'football_cards');
  const [statusFilter, setStatusFilter] = useState<'active' | 'pending'>('active');

  useDocumentMeta({
    title: categorySlug
      ? `Set Checklists: ${CATEGORIES[categorySlug]?.shortLabel} · Fanzeum`
      : 'Set Checklists · Fanzeum',
    description: 'Browse complete set checklists for cards, coins, stamps, comics, vinyl and toys. Track what you own and what you need.',
  });

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const data = categorySlug
          ? await listSetsByCategory(categorySlug, statusFilter, 100)
          : await listPopularSets(selectedCategory, 50);
        if (active) setSets(data);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
  }, [categorySlug, selectedCategory, statusFilter]);

  const handleCategoryChange = (cat: CategorySlug) => {
    setSelectedCategory(cat);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12 space-y-8">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      </div>
    );
  }

  const currentCategoryConfig = CATEGORIES[selectedCategory];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12 pb-28 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-mono text-brass">
            <Sparkles className="w-4 h-4" strokeWidth={1.5} />
            <span>Set Checklists</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-semibold text-ink mt-1">
            {categorySlug ? `${currentCategoryConfig?.shortLabel} Sets` : 'Popular Set Checklists'}
          </h1>
          <p className="text-base text-muted mt-1 max-w-2xl">
            Browse complete checklists for known sets. Tap a set to see every item, track what you own,
            and add missing pieces to your Want List in one tap.
          </p>
        </div>

        {!categorySlug && (
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value as CategorySlug)}
              className="min-h-[44px] px-3.5 py-2 text-sm rounded-xl border border-border bg-bg text-ink"
              aria-label="Filter by hobby"
            >
              {CATEGORY_LIST.map((cat) => (
                <option key={cat.slug} value={cat.slug}>
                  {cat.shortLabel}
                </option>
              ))}
            </select>
            <Button variant="secondary" size="sm">
              <Filter className="w-4 h-4" strokeWidth={1.5} />
              <span>{statusFilter === 'active' ? 'Active sets' : 'Pending suggestions'}</span>
            </Button>
          </div>
        )}
      </div>

      {/* Category tabs when not on a specific category page */}
      {!categorySlug && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {CATEGORY_LIST.map((cat) => (
            <button
              key={cat.slug}
              type="button"
              onClick={() => handleCategoryChange(cat.slug)}
              className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer ${
                selectedCategory === cat.slug
                  ? 'bg-brass text-brass-fg border-brass'
                  : 'bg-surface text-muted border-border hover:text-ink'
              }`}
            >
              <CategoryIcon category={cat.slug} className="w-3.5 h-3.5" />
              <span>{cat.shortLabel}</span>
            </button>
          ))}
        </div>
      )}

      {/* Sets Grid */}
      {sets.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="w-6 h-6" strokeWidth={1.5} />}
          title={statusFilter === 'pending' ? 'No pending set suggestions' : 'No sets yet for this hobby'}
          description={
            statusFilter === 'pending'
              ? 'When collectors suggest new set checklists, they appear here for admin review.'
              : 'Be the first to suggest a set checklist for this category.'
          }
          action={
            isVerified ? (
              <Button onClick={() => window.location.href = `/add-set?category=${selectedCategory}`}>
                Suggest a set checklist
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => window.location.href = '/onboarding'}>
                Verify email to suggest sets
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sets.map((set) => (
            <Link key={set.id} to={`/set/${set.id}`} className="block">
              <Card interactive className="overflow-hidden h-full flex flex-col justify-between">
                <div>
                  <div className="aspect-[16/10] bg-surface-raised border-b border-border p-5 flex items-center justify-center after-hours-spotlight relative">
                    {set.coverImageUrl ? (
                      <CollectorImage
                        src={set.coverImageUrl}
                        alt={set.title}
                        category={set.category}
                        className="w-full h-full"
                        imgClassName="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <CategoryIcon category={set.category} className="w-16 h-16 text-brass/30" strokeWidth={1} />
                      </div>
                    )}
                    {set.status === 'pending' && (
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-mono bg-warn/20 text-warn border border-warn/30">
                        Pending
                      </span>
                    )}
                  </div>
                  <div className="p-5 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <span className="inline-flex items-center gap-1 text-brass font-mono">
                        <CategoryIcon category={set.category} className="w-3.5 h-3.5" />
                        <span>{CATEGORIES[set.category]?.shortLabel || set.category}</span>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{set.yearRange}</span>
                    </div>
                    <h3 className="text-lg font-display font-semibold text-ink line-clamp-2">
                      {set.title}
                    </h3>
                    <p className="text-sm text-muted line-clamp-2 leading-relaxed">
                      {set.description}
                    </p>
                  </div>
                </div>

                <div className="px-5 pb-5 pt-3 border-t border-border flex items-center justify-between gap-3">
                  <span className="text-sm font-mono tabular-nums text-ink">
                    {set.totalItems} {set.totalItems === 1 ? 'item' : 'items'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-brass font-mono text-sm">
                    <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
                    <span>View checklist</span>
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
