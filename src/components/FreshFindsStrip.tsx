import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Flame } from 'lucide-react';
import { CATEGORIES } from '../config/categories';
import { listFreshFinds } from '../lib/firestoreRepo';
import type { FreshFindRecord } from '../types/domain';
import { Card } from './ui/Card';
import { CategoryIcon } from './ui/CategoryIcon';
import { CollectorImage } from './ui/CollectorImage';
import { PanelConfirmedBadge } from './ui/PanelConfirmedBadge';

export const FreshFindsStrip: React.FC = () => {
  const [finds, setFinds] = useState<FreshFindRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const res = await listFreshFinds({ pageSize: 6 });
        if (!active) return;
        setFinds(res.items.slice(0, 6));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  if (!loading && finds.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-8 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-brass">
            <Flame className="w-4 h-4" strokeWidth={1.5} />
            <span>Community Discoveries</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-semibold text-ink mt-1">
            Fresh Finds
          </h2>
          <p className="text-base text-muted mt-1">
            Recent pickups catalogued and shared by UK collectors.
          </p>
        </div>

        <Link
          to="/fresh-finds"
          className="text-sm font-medium text-brass hover:underline whitespace-nowrap inline-flex items-center gap-1"
        >
          <span>View all finds</span>
          <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-48 rounded-xl bg-surface animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {finds.map((find) => (
            <Link
              key={find.id}
              to={`/i/${find.itemId}`}
              className="block group h-full"
            >
              <Card interactive className="overflow-hidden h-full flex flex-col p-0">
                <div className="aspect-square bg-surface-raised relative overflow-hidden">
                  <CollectorImage
                    src={find.thumbUrl}
                    alt={find.title}
                    category={find.category}
                    className="w-full h-full"
                    imgClassName="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {find.panelStatus === 'confirmed' && (
                    <div className="absolute top-2 right-2">
                      <PanelConfirmedBadge size="sm" iconOnly />
                    </div>
                  )}
                </div>

                <div className="p-3 space-y-1.5 flex-1 flex flex-col">
                  <div className="flex items-center gap-1 text-xs text-muted">
                    <CategoryIcon category={find.category} className="w-3.5 h-3.5 text-brass" />
                    <span className="truncate">{CATEGORIES[find.category]?.shortLabel}</span>
                  </div>
                  <h4 className="text-sm font-display font-semibold leading-snug text-ink line-clamp-2 min-h-[2.5rem] group-hover:text-brass transition-colors">
                    {find.title}
                  </h4>
                  {find.valueRange && (
                    <p className="text-sm font-semibold text-brass truncate mt-auto">
                      {find.valueRange}
                    </p>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
};
