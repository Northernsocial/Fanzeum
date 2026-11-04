import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Calendar, User } from 'lucide-react';
import { CATEGORIES } from '../../config/categories';
import { fetchArticleBySlug } from '../../lib/firestoreRepo';
import type { ArticleRecord } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { EmptyState, Skeleton } from '../../components/ui/EmptyState';
import { SafeMarkdown } from './SafeMarkdown';

export const ArticlePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<ArticleRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (slug) {
      fetchArticleBySlug(slug)
        .then((res) => {
          if (active) setArticle(res);
        })
        .catch((err) => console.error('Error fetching article:', err))
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <EmptyState
          icon={<BookOpen className="w-6 h-6" />}
          title="Article not found"
          description="The article you are looking for does not exist or has been removed."
          action={
            <Link to="/news">
              <Button>Back to news &amp; blog</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const catObj = CATEGORIES[article.category as keyof typeof CATEGORIES];

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-8 py-10 sm:py-16 space-y-8">
      <div>
        <Link
          to="/news"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to news &amp; blog</span>
        </Link>

        {catObj && (
          <span className="inline-block px-3 py-1 rounded-full bg-surface-raised border border-border text-xs font-medium text-brass mb-4">
            {catObj.label}
          </span>
        )}

        <h1 className="text-3xl sm:text-5xl font-display font-semibold text-ink leading-tight">
          {article.title}
        </h1>

        <div className="flex items-center gap-6 text-sm text-muted mt-4 pt-4 border-t border-border">
          <div className="inline-flex items-center gap-2">
            <User className="w-4 h-4 text-brass" />
            <span>Fanzeum Editorial</span>
          </div>
          <div className="inline-flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brass" />
            <span>UK Collector Guide</span>
          </div>
        </div>
      </div>

      <div className="aspect-[16/9] rounded-2xl overflow-hidden border border-border bg-surface-raised">
        <img
          src={article.coverImage}
          alt={article.title}
          className="w-full h-full object-cover"
          loading="eager"
        />
      </div>

      <div className="bg-surface rounded-2xl border border-border p-6 sm:p-10 shadow-sm">
        <SafeMarkdown content={article.body} />
      </div>

      <div className="pt-6 border-t border-border flex items-center justify-between">
        <Link to="/news">
          <Button variant="secondary">
            <ArrowLeft className="w-4 h-4" />
            <span>More articles</span>
          </Button>
        </Link>
      </div>
    </article>
  );
};
