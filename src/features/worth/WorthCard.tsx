import React from 'react';
import { Link } from 'react-router-dom';
import { Users, TrendingUp, ArrowRight } from 'lucide-react';
import { CATEGORIES } from '../../config/categories';
import { formatGbpRange } from '../../lib/entitlements';
import type { WorthItemGuide } from '../../types/worth';
import { Card } from '../../components/ui/Card';
import { CategoryIcon } from '../../components/ui/CategoryIcon';

interface WorthCardProps {
  item: WorthItemGuide;
}

export const WorthCard: React.FC<WorthCardProps> = ({ item }) => {
  const catConfig = CATEGORIES[item.category];

  return (
    <Card raised interactive className="p-5 flex flex-col justify-between gap-4 h-full group">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface text-xs font-medium text-brass border border-border">
            <CategoryIcon category={item.category} className="w-3.5 h-3.5" />
            <span>{catConfig?.shortLabel || item.category}</span>
          </span>
          <span className="text-xs font-mono text-muted">{item.year}</span>
        </div>

        <div>
          <h3 className="text-lg font-display font-semibold text-ink group-hover:text-brass transition-colors line-clamp-2">
            {item.title}
          </h3>
          <p className="text-xs sm:text-sm text-muted mt-1.5 line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        </div>
      </div>

      <div className="space-y-3 pt-3 border-t border-border/80">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <div className="text-[11px] font-mono text-muted uppercase tracking-wider">
              Recent UK range
            </div>
            <div className="text-base font-semibold text-ink font-mono mt-0.5">
              {formatGbpRange(item.minGbp, item.maxGbp)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-mono text-muted uppercase tracking-wider flex items-center gap-1 justify-end">
              <Users className="w-3 h-3 text-brass" />
              <span>Showcases</span>
            </div>
            <div className="text-xs font-mono text-ink mt-0.5">
              {item.baselineCollectorCount}+ owners
            </div>
          </div>
        </div>

        <Link
          to={`/worth/${item.category}/${item.slug}`}
          className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded-xl bg-surface hover:bg-brass hover:text-brass-fg border border-border hover:border-brass transition-all duration-150 text-ink"
        >
          <span>View valuation guide</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </Card>
  );
};
