import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  CATEGORY_METADATA,
  CollectionRecord,
  GOAL_LABELS,
  UserProfile,
} from '../types/domain';
import { DEMO_COLLECTIONS, DEMO_CURATORS } from '../data/demoExhibitions';
import { fetchUserProfile, listPublicCollections } from '../lib/firestoreRepo';
import { formatGbpRange } from '../lib/entitlements';
import { ArchivalImage } from '../components/ArchivalImage';

export const CollectorProfilePage: React.FC = () => {
  const { uid } = useParams<{ uid: string }>();
  const [curator, setCurator] = useState<UserProfile | null>(null);
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const demoMatch = DEMO_CURATORS.find((c) => c.uid === uid);
        if (demoMatch) {
          if (mounted) {
            setCurator(demoMatch);
            setCollections(DEMO_COLLECTIONS.filter((c) => c.ownerId === uid));
          }
          return;
        }

        const [profileData, allPubCols] = await Promise.all([
          fetchUserProfile(uid!),
          listPublicCollections(50),
        ]);
        if (mounted) {
          setCurator(profileData);
          setCollections(allPubCols.filter((c) => c.ownerId === uid));
        }
      } catch (err) {
        console.error('Error loading collector profile:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [uid]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-16">
        <div className="h-48 rounded-xl bg-stone-100 dark:bg-stone-900 animate-pulse" />
      </div>
    );
  }

  if (!curator) {
    return (
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-20 text-center">
        <h1 className="text-3xl font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
          Collector Profile Not Found
        </h1>
        <Link
          to="/curators"
          className="mt-5 inline-block text-xs font-medium underline text-[#9A3412] dark:text-[#D97757]"
        >
          Browse Public Curators →
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 py-12 pb-20 space-y-12">
      <section className="border-b border-stone-200 dark:border-stone-800 pb-10">
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400">
          <span>@{curator.handle}</span>
          {curator.location && (
            <>
              <span aria-hidden="true">·</span>
              <span>{curator.location}</span>
            </>
          )}
          {curator.isVerifiedExpert && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[#9A3412] dark:text-[#D97757] font-semibold">
                Verified Specialist
              </span>
            </>
          )}
        </div>

        <h1 className="mt-2 text-3xl sm:text-5xl font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
          {curator.displayName}
        </h1>

        <p className="mt-4 text-base leading-relaxed text-stone-700 dark:text-stone-300 max-w-2xl">
          {curator.bio || 'Curating a personal cabinet on Fanzeum.'}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
          <span>Focus: {GOAL_LABELS[curator.goal]?.title || 'Curating'}</span>
          {curator.specialties.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                Departments:{' '}
                {curator.specialties.map((s) => CATEGORY_METADATA[s]?.shortLabel).join(', ')}
              </span>
            </>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
          Public Exhibitions ({collections.length})
        </h2>

        {collections.length === 0 ? (
          <p className="mt-4 text-sm text-stone-600 dark:text-stone-400">
            No public exhibitions published yet.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {collections.map((col) => (
              <Link
                key={col.id}
                to={`/exhibition/${col.id}`}
                className="group flex flex-col rounded-xl overflow-hidden border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171614]"
              >
                <div className="aspect-[4/3] bg-[#EFECE6] dark:bg-[#0F0E0D] overflow-hidden">
                  <ArchivalImage src={col.coverImageUrl} alt={col.title} />
                </div>
                <div className="p-5">
                  <div className="text-xs text-stone-500 dark:text-stone-400">
                    {CATEGORY_METADATA[col.category]?.shortLabel} · {col.itemCount} items
                  </div>
                  <h3 className="mt-1.5 text-xl font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB] group-hover:text-[#9A3412] transition-colors">
                    {col.title}
                  </h3>
                  <div className="mt-3 font-mono text-xs tabular-nums text-[#9A3412] dark:text-[#D97757]">
                    {formatGbpRange(col.estimatedTotalMinGbp, col.estimatedTotalMaxGbp)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
