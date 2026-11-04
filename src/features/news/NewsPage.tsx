import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Newspaper } from 'lucide-react';
import { CATEGORIES, type CategorySlug } from '../../config/categories';
import { listArticles } from '../../lib/firestoreRepo';
import type { ArticleRecord } from '../../types/domain';
import { Card } from '../../components/ui/Card';
import { EmptyState, Skeleton } from '../../components/ui/EmptyState';
import { Tabs } from '../../components/ui/Tabs';

export const NewsPage: React.FC = () => {
  const [articles, setArticles] = useState<ArticleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<CategorySlug | 'all'>('all');

  useEffect(() => {
    let active = true;
    listArticles(30)
      .then((res) => {
        if (active) setArticles(res);
      })
      .catch((err) => console.error('Error loading articles:', err))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = category === 'all'
    ? articles
    : articles.filter((a) => a.category === category);

  const categoryTabs = [
    { value: 'all' as const, label: 'All articles' },
    ...Object.values(CATEGORIES).map((c: { slug: CategorySlug; label: string }) => ({ value: c.slug, label: c.label })),
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-raised border border-border text-xs font-medium text-brass mb-3">
            <Newspaper className="w-3.5 h-3.5" />
            <span>Collector News &amp; Guides</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-semibold text-ink">
            Stories from the Showcase
          </h1>
          <p className="text-base text-muted mt-2 max-w-2xl">
            Expert advice, care guides, and updates for British collectors of stamps, coins, cards, and more.
          </p>
        </div>
      </div>

      <Tabs
        options={categoryTabs}
        value={category}
        onChange={(v) => setCategory(v as CategorySlug | 'all')}
        ariaLabel="Filter articles by category"
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="w-6 h-6" />}
          title="No articles found"
          description="There are no articles published in this category yet."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filtered.map((art) => {
            const catObj = CATEGORIES[art.category as keyof typeof CATEGORIES];
            return (
              <Link key={art.id} to={`/news/${art.slug}`}>
                <Card interactive className="overflow-hidden flex flex-col h-full">
                  <div className="aspect-[16/10] overflow-hidden bg-surface-raised relative">
                    <img
                      src={art.coverImage}
                      alt={art.title}
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                      loading="lazy"
                    />
                    {catObj && (
                      <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-bg/80 backdrop-blur-sm text-xs font-medium text-ink border border-border">
                        {catObj.label}
                      </span>
                    )}
                  </div>
                  <div className="p-6 flex flex-col flex-1 justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-display font-semibold text-ink line-clamp-2">
                        {art.title}
                      </h2>
                      <p className="text-sm text-muted mt-2 line-clamp-3">
                        {art.body.replace(/###|\n/g, ' ').slice(0, 140)}…
                      </p>
                    </div>
                    <div className="text-xs font-medium text-brass">Read article →</div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};
