import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Sparkles, ShieldCheck } from 'lucide-react';
import { CATEGORIES, type CategorySlug } from '../../config/categories';
import { useAuth } from '../../contexts/AuthContext';
import { getWorthItemsByCategory } from '../../lib/worthRepo';
import { useDocumentMeta } from '../../components/DocumentMeta';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { WorthCard } from './WorthCard';

export const WorthCategoryPage: React.FC = () => {
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const catKey = (categorySlug as CategorySlug) || 'football_cards';
  const catConfig = CATEGORIES[catKey];

  useDocumentMeta({
    title: catConfig
      ? `What Are ${catConfig.label} Worth? (UK Price Guide)`
      : "What's It Worth?",
    description: catConfig
      ? `Browse realistic UK £ price guides, recent valuation ranges, and collector demand for ${catConfig.label.toLowerCase()} on Fanzeum.`
      : 'Browse realistic UK £ price guides on Fanzeum.',
  });

  if (!catConfig) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-display font-semibold text-ink">Category not found</h1>
        <p className="text-muted text-sm">We don’t have valuation guides for this category yet.</p>
        <Button onClick={() => navigate('/worth')}>Back to Valuation Guides</Button>
      </div>
    );
  }

  const items = getWorthItemsByCategory(catKey);
  const filtered = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.shortTitle.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
    );
  });

  const handleCtaClick = () => {
    if (firebaseUser) {
      navigate('/add');
    } else {
      navigate('/onboarding');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12 pb-28 space-y-10">
      {/* Navigation Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted">
        <Link to="/worth" className="hover:text-ink inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All Valuation Guides</span>
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-ink font-medium">{catConfig.shortLabel}</span>
      </nav>

      {/* Category Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-6 sm:p-8 rounded-2xl bg-surface border border-brass/30">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-surface-raised border border-border text-brass flex items-center justify-center shrink-0">
            <CategoryIcon category={catConfig.slug} className="w-7 h-7" />
          </div>
          <div className="space-y-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono text-brass">
              <Sparkles className="w-3 h-3" />
              <span>UK Collector Guide</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-semibold text-ink">
              What are {catConfig.label} worth?
            </h1>
            <p className="text-sm sm:text-base text-muted leading-relaxed max-w-2xl">
              {catConfig.tagline}. Check recent UK market ranges, grading factors, and showcase counts.
            </p>
          </div>
        </div>

        <Button size="sm" onClick={handleCtaClick} className="self-start sm:self-center shrink-0">
          {firebaseUser ? 'Value your piece' : 'Value yours free: sign up'}
        </Button>
      </div>

      {/* Search & Stats Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative max-w-md w-full">
          <Search
            className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            strokeWidth={1.5}
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${catConfig.shortLabel.toLowerCase()} guides…`}
            className="w-full min-h-[42px] pl-10 pr-4 py-2 text-sm rounded-xl border border-border bg-surface text-ink placeholder:text-muted/65 focus:outline-none focus:border-brass/70"
          />
        </div>

        <div className="text-xs font-mono text-muted self-end sm:self-center">
          Showing {filtered.length} of {items.length} {catConfig.shortLabel} guides
        </div>
      </div>

      {/* Grid of Worth Cards */}
      {filtered.length === 0 ? (
        <Card className="p-8 text-center space-y-3">
          <p className="text-muted text-sm">No guides found matching “{searchQuery}”.</p>
          <Button variant="secondary" size="sm" onClick={() => setSearchQuery('')}>
            Clear search
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((item) => (
            <WorthCard key={`${item.category}_${item.slug}`} item={item} />
          ))}
        </div>
      )}

      {/* Valuation Disclaimer & CTA */}
      <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-brass shrink-0" />
          <span>
            Valuation guides reflect recent UK collector transactions and public sales data. AI results are estimates, never authentication.
          </span>
        </div>
        <Link to="/worth" className="text-brass hover:underline whitespace-nowrap">
          Explore other categories →
        </Link>
      </div>
    </div>
  );
};
