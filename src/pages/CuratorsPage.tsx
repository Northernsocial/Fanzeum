import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORY_METADATA, UserProfile } from '../types/domain';
import { DEMO_CURATORS } from '../data/demoExhibitions';
import { listPublicCurators } from '../lib/firestoreRepo';

export const CuratorsPage: React.FC = () => {
  const [liveCurators, setLiveCurators] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    listPublicCurators(30)
      .then((res) => {
        if (mounted) setLiveCurators(res);
      })
      .catch((err) => console.error('Could not load public curators:', err))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const combined = [
    ...liveCurators,
    ...DEMO_CURATORS.filter((d) => !liveCurators.some((l) => l.uid === d.uid)),
  ];

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 py-12 pb-20">
      <div className="border-b border-stone-200 dark:border-stone-800 pb-6">
        <p className="text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400">
          Collector &amp; Specialist Registry
        </p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
          Curators of Fanzeum
        </h1>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400 max-w-2xl">
          Discover collectors, philatelists, numismatists, and sporting card archivists exhibiting public cabinets across the United Kingdom and beyond.
        </p>
      </div>

      {loading ? (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-48 rounded-xl bg-stone-100 dark:bg-stone-900 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {combined.map((curator) => (
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
                <h2 className="mt-1.5 text-xl font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
                  {curator.displayName}
                </h2>
                {curator.location && (
                  <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                    {curator.location}
                  </p>
                )}
                <p className="mt-3 text-sm text-stone-600 dark:text-stone-300 leading-relaxed line-clamp-3">
                  {curator.bio || 'Curating a personal archive on Fanzeum.'}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
                <span className="truncate max-w-[200px]">
                  {curator.specialties.length > 0
                    ? curator.specialties.map((s) => CATEGORY_METADATA[s]?.shortLabel).join(' · ')
                    : 'General Collector'}
                </span>
                <span className="font-mono tabular-nums">{curator.collectionsCount} cabinets</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
