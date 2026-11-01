import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Camera, Sparkles } from 'lucide-react';
import {
  CATEGORY_METADATA,
  CategorySlug,
  CollectionRecord,
} from '../types/domain';
import { DEMO_COLLECTIONS, DEMO_CURATORS } from '../data/demoExhibitions';
import { listPublicCollections } from '../lib/firestoreRepo';
import { formatGbpRange } from '../lib/entitlements';
import { useAuth } from '../contexts/AuthContext';
import { ArchivalImage } from '../components/ArchivalImage';

export const HomePage: React.FC = () => {
  const { firebaseUser, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const [liveCollections, setLiveCollections] = useState<CollectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<'all' | CategorySlug>('all');

  useEffect(() => {
    let mounted = true;
    listPublicCollections(24)
      .then((cols) => {
        if (mounted) setLiveCollections(cols);
      })
      .catch((err) => {
        console.error('Could not load live public collections:', err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const allCollections = useMemo(() => {
    return [...liveCollections, ...DEMO_COLLECTIONS];
  }, [liveCollections]);

  const filteredCollections = useMemo(() => {
    if (selectedCategory === 'all') return allCollections;
    return allCollections.filter((c) => c.category === selectedCategory);
  }, [allCollections, selectedCategory]);

  const leadExhibition = DEMO_COLLECTIONS[0];

  const handleStartCurating = () => {
    if (firebaseUser) {
      navigate('/onboarding');
    } else {
      openAuthModal();
    }
  };

  return (
    <div className="space-y-20 pb-20">
      {/* Institutional Exhibition Marquee Hero (2-column stretch split) */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-10 sm:pt-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-between py-2">
            <div>
              <p className="text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400">
                Curatorial Archive · United Kingdom &amp; Worldwide
              </p>
              <h1 className="mt-4 text-4xl sm:text-5xl lg:text-[3.5rem] leading-[1.08] font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
                Where Meaningful Collections Become Living Exhibitions.
              </h1>
              <p className="mt-5 text-base leading-relaxed text-stone-600 dark:text-stone-300 max-w-xl">
                Photograph any stamp, coin, football card, vinyl pressing, or treasured artefact. Fanzeum’s AI curator identifies the issue, estimates UK market value in £ GBP, and frames your pieces in a serene museum-grade gallery.
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-stone-200 dark:border-stone-800 space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleStartCurating}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#9A3412] hover:bg-[#7C2D12] text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  {firebaseUser ? 'Launch AI Curatorial Guide' : 'Start Your First Exhibition'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/exhibition/${leadExhibition.id}`)}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-stone-300 dark:border-stone-700 text-[#1C1917] dark:text-[#F5F2EB] text-sm font-medium hover:bg-stone-200/50 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Explore Featured Cabinet
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                <span>AI Photo Identification</span>
                <span aria-hidden="true">·</span>
                <span>Public, Followers &amp; Private Vaults</span>
                <span aria-hidden="true">·</span>
                <span>UK GDPR Isolated Privacy</span>
              </div>
            </div>
          </div>

          {/* Lead Exhibition Plate */}
          <div className="lg:col-span-6">
            <Link
              to={`/exhibition/${leadExhibition.id}`}
              className="group block h-full rounded-xl overflow-hidden border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171614] transition-transform duration-200 hover:-translate-y-0.5"
            >
              <div className="aspect-[4/3] bg-[#EFECE6] dark:bg-[#0F0E0D] overflow-hidden">
                <ArchivalImage
                  src={leadExhibition.coverImageUrl}
                  alt={leadExhibition.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                  <span>Featured Exhibition</span>
                  <span aria-hidden="true">·</span>
                  <span>{CATEGORY_METADATA[leadExhibition.category].shortLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {formatGbpRange(
                      leadExhibition.estimatedTotalMinGbp,
                      leadExhibition.estimatedTotalMaxGbp,
                    )}
                  </span>
                </div>
                <h2 className="mt-2 text-2xl font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB] group-hover:text-[#9A3412] dark:group-hover:text-[#D97757] transition-colors">
                  {leadExhibition.title}
                </h2>
                <p className="mt-1.5 text-xs text-stone-500 dark:text-stone-400">
                  Curated by {leadExhibition.ownerName} (@{leadExhibition.ownerHandle})
                </p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Public Exhibitions Directory */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400">
              Open Galleries
            </p>
            <h2 className="mt-1 text-3xl font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
              Current Public Exhibitions
            </h2>
          </div>

          {/* Interactive Department Filter Control */}
          <div
            role="tablist"
            aria-label="Filter exhibitions by collecting department"
            className="flex items-center gap-1 p-1 rounded-lg bg-[#EFECE6] dark:bg-[#171614] border border-stone-200/80 dark:border-stone-800 overflow-x-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategory === 'all'}
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-white dark:bg-[#26231F] text-[#1C1917] dark:text-[#F5F2EB] shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-[#1C1917] dark:hover:text-[#F5F2EB]'
              }`}
            >
              All ({allCollections.length})
            </button>
            {(
              [
                'stamps',
                'coins',
                'football_cards',
                'trading_cards',
                'comics',
                'vinyl',
                'toys',
                'memorabilia',
              ] as CategorySlug[]
            ).map((slug) => (
              <button
                key={slug}
                type="button"
                role="tab"
                aria-selected={selectedCategory === slug}
                onClick={() => setSelectedCategory(slug)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedCategory === slug
                    ? 'bg-white dark:bg-[#26231F] text-[#1C1917] dark:text-[#F5F2EB] shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-[#1C1917] dark:hover:text-[#F5F2EB]'
                }`}
              >
                {CATEGORY_METADATA[slug].shortLabel}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="rounded-xl border border-stone-200 dark:border-stone-800 h-96 animate-pulse bg-stone-100 dark:bg-stone-900"
              />
            ))}
          </div>
        ) : filteredCollections.length === 0 ? (
          <div className="mt-10 rounded-xl border border-stone-200 dark:border-stone-800 p-12 text-center bg-white dark:bg-[#171614]">
            <Camera className="w-8 h-8 mx-auto text-stone-400 stroke-[1.25]" />
            <h3 className="mt-3 text-xl font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
              No Public Exhibitions in {CATEGORY_METADATA[selectedCategory as CategorySlug]?.label} Yet
            </h3>
            <p className="mt-1.5 text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto">
              Be the founding curator in this department by photographing your first item in the Studio.
            </p>
            <button
              type="button"
              onClick={() => (firebaseUser ? navigate('/studio') : openAuthModal())}
              className="mt-5 px-4 py-2 rounded-lg bg-[#9A3412] text-white text-xs font-medium cursor-pointer"
            >
              Create First {CATEGORY_METADATA[selectedCategory as CategorySlug]?.shortLabel} Exhibition
            </button>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredCollections.map((col) => (
              <Link
                key={col.id}
                to={`/exhibition/${col.id}`}
                className="group flex flex-col rounded-xl overflow-hidden border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171614] transition-transform duration-200 hover:-translate-y-0.5"
              >
                <div className="aspect-[4/3] bg-[#EFECE6] dark:bg-[#0F0E0D] overflow-hidden">
                  <ArchivalImage
                    src={col.coverImageUrl}
                    alt={col.title}
                    fallbackTitle={col.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </div>
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Zero-Pill Unboxed Metadata */}
                    <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                      <span>{CATEGORY_METADATA[col.category]?.shortLabel || col.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{col.itemCount} items</span>
                      {col.setTargetCount > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            {Math.min(100, Math.round((col.itemCount / col.setTargetCount) * 100))}% of set
                          </span>
                        </>
                      )}
                    </div>

                    <h3 className="mt-2 text-xl font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB] group-hover:text-[#9A3412] dark:group-hover:text-[#D97757] transition-colors line-clamp-2">
                      {col.title}
                    </h3>

                    {col.story && (
                      <p className="mt-2 text-sm text-stone-600 dark:text-stone-400 line-clamp-2 leading-relaxed">
                        {col.story}
                      </p>
                    )}
                  </div>

                  <div className="mt-5 pt-4 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between text-xs">
                    <span className="text-stone-600 dark:text-stone-300 truncate max-w-[160px]">
                      {col.ownerName}
                    </span>
                    <span className="font-mono tabular-nums text-[#9A3412] dark:text-[#D97757] font-medium">
                      {formatGbpRange(col.estimatedTotalMinGbp, col.estimatedTotalMaxGbp)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Curators & Specialists Section */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="border-t border-stone-200 dark:border-stone-800 pt-14">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400">
                Resident Specialists
              </p>
              <h2 className="mt-1 text-3xl font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
                Featured UK Curators &amp; Collectors
              </h2>
            </div>
            <Link
              to="/curators"
              className="text-xs font-medium text-[#9A3412] dark:text-[#D97757] hover:underline whitespace-nowrap shrink-0"
            >
              View All Curators →
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            {DEMO_CURATORS.map((curator) => (
              <Link
                key={curator.uid}
                to={`/collector/${curator.uid}`}
                className="p-6 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171614] hover:border-stone-400 dark:hover:border-stone-600 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                    <span>@{curator.handle}</span>
                    {curator.isVerifiedExpert && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#9A3412] dark:text-[#D97757] font-medium">
                          Verified Specialist
                        </span>
                      </>
                    )}
                  </div>
                  <h3 className="mt-1.5 text-xl font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
                    {curator.displayName}
                  </h3>
                  <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                    {curator.location}
                  </p>
                  <p className="mt-3 text-sm text-stone-600 dark:text-stone-300 leading-relaxed line-clamp-3">
                    {curator.bio}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-stone-100 dark:border-stone-800 text-xs text-stone-500 dark:text-stone-400">
                  {curator.specialties.map((s) => CATEGORY_METADATA[s]?.shortLabel).join(' · ')}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
