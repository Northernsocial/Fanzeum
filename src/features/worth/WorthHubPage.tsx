import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Sparkles, ShieldCheck, ArrowRight } from 'lucide-react';
import { CATEGORIES, CATEGORY_LIST, type CategorySlug } from '../../config/categories';
import { useAuth } from '../../contexts/AuthContext';
import { searchWorthItems } from '../../lib/worthRepo';
import { useDocumentMeta } from '../../components/DocumentMeta';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { WorthCard } from './WorthCard';

export const WorthHubPage: React.FC = () => {
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategorySlug | 'all'>('all');

  useDocumentMeta({
    title: "What's It Worth? UK Collector Price & Valuation Guides",
    description:
      'Free UK valuation guides for cards, coins, stamps, comics, vinyl, and toys. See recent UK market values, condition guides, and display what you collect.',
  });

  const filteredItems = searchWorthItems(searchQuery, selectedCategory);

  const handleCtaClick = () => {
    if (firebaseUser) {
      navigate('/add');
    } else {
      navigate('/onboarding');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-14 pb-28 space-y-12">
      {/* Hero Header */}
      <div className="space-y-4 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brass/10 border border-brass/30 text-xs font-mono text-brass">
          <Sparkles className="w-3.5 h-3.5" />
          <span>UK Collector Price Intelligence</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-display font-semibold text-ink tracking-tight">
          What’s it worth?
        </h1>
        <p className="text-base sm:text-lg text-muted leading-relaxed">
          Explore realistic UK £ valuation ranges, recent sales data, and grading nuances for football cards, coins, stamps, comics, vinyl, and toys.
        </p>
      </div>

      {/* Search & Category Filter */}
      <div className="space-y-4">
        <div className="relative max-w-xl">
          <Search
            className="w-5 h-5 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            strokeWidth={1.5}
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search e.g. “Pelé”, “Penny Black”, “Charizard”, “Kew Gardens”…"
            className="w-full min-h-[46px] pl-11 pr-4 py-2.5 text-base rounded-xl border border-border bg-surface text-ink placeholder:text-muted/65 focus:outline-none focus:border-brass/70 transition-colors"
          />
        </div>

        {/* Hobby Categories Pills */}
        <div
          role="group"
          aria-label="Filter guides by hobby"
          className="flex items-center gap-2 overflow-x-auto pb-2"
        >
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`min-h-[40px] px-4 py-2 rounded-xl text-sm font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-brass text-brass-fg border-brass'
                : 'bg-surface text-muted border-border hover:text-ink hover:border-brass/40'
            }`}
          >
            All hobbies
          </button>
          {CATEGORY_LIST.map((cat) => {
            const active = selectedCategory === cat.slug;
            return (
              <button
                key={cat.slug}
                type="button"
                onClick={() => setSelectedCategory(cat.slug)}
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
      </div>

      {/* Category Index Quick Links */}
      {selectedCategory === 'all' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-display font-semibold text-ink">Browse by Category</h2>
            <span className="text-xs font-mono text-muted">8 collector disciplines</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {CATEGORY_LIST.map((cat) => (
              <Link
                key={cat.slug}
                to={`/worth/${cat.slug}`}
                className="p-4 rounded-2xl bg-surface border border-border hover:border-brass/60 transition-all group flex flex-col justify-between gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-surface-raised border border-border flex items-center justify-center text-brass group-hover:scale-105 transition-transform">
                  <CategoryIcon category={cat.slug} className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-ink group-hover:text-brass transition-colors">
                    {cat.shortLabel}
                  </div>
                  <div className="text-xs text-muted mt-0.5 flex items-center gap-1">
                    <span>View guides</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Featured Valuation Guides Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-display font-semibold text-ink">
            {selectedCategory === 'all'
              ? 'Popular Valuation Guides'
              : `${CATEGORIES[selectedCategory].label} Guides`}
          </h2>
          <span className="text-xs font-mono text-muted">
            {filteredItems.length} {filteredItems.length === 1 ? 'guide' : 'guides'} available
          </span>
        </div>

        {filteredItems.length === 0 ? (
          <Card className="p-8 text-center space-y-3">
            <p className="text-muted text-sm">No valuation guides found matching “{searchQuery}”.</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
            >
              Reset filters
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => (
              <WorthCard key={`${item.category}_${item.slug}`} item={item} />
            ))}
          </div>
        )}
      </div>

      {/* Banner CTA */}
      <Card raised className="p-6 sm:p-10 border-brass/40 bg-surface-raised space-y-4 text-center max-w-2xl mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-brass/10 border border-brass/30 text-brass flex items-center justify-center mx-auto">
          <ShieldCheck className="w-6 h-6" strokeWidth={1.5} />
        </div>
        <h2 className="text-2xl font-display font-semibold text-ink">
          Have an item you want to price?
        </h2>
        <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">
          Upload photos of your piece to catalog it, see realistic UK £ valuations, and show it off in your personal showcase.
        </p>
        <div className="pt-2">
          <Button size="lg" onClick={handleCtaClick}>
            {firebaseUser ? 'Add a piece to your showcase' : 'Value yours free: sign up'}
          </Button>
        </div>
        <p className="text-[11px] font-mono text-muted">
          AI estimates are collector guides, not an authentication certificate.
        </p>
      </Card>
    </div>
  );
};
