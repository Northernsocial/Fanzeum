import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Loader2, Sparkles } from 'lucide-react';
import {
  AIOnboardingResponse,
  CATEGORY_METADATA,
  CategorySlug,
  CollectorGoal,
  GOAL_LABELS,
} from '../types/domain';
import { generateCuratorialOnboarding } from '../lib/aiClient';
import { createCollectionRecord, updateUserPublicProfile } from '../lib/firestoreRepo';
import { DEMO_CURATORS } from '../data/demoExhibitions';
import { useAuth } from '../contexts/AuthContext';

export const OnboardingPage: React.FC = () => {
  const { firebaseUser, profile, needsEmailVerification, openAuthModal, refreshProfile } =
    useAuth();
  const navigate = useNavigate();

  const [selectedCategories, setSelectedCategories] = useState<CategorySlug[]>(
    profile?.specialties.length ? profile.specialties : ['stamps'],
  );
  const [goal, setGoal] = useState<CollectorGoal>(profile?.goal || 'exhibit');
  const [personalNote, setPersonalNote] = useState('');
  const [generating, setGenerating] = useState(false);
  const [aiPlan, setAiPlan] = useState<AIOnboardingResponse | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [customStory, setCustomStory] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCategory = (slug: CategorySlug) => {
    setSelectedCategories((prev) =>
      prev.includes(slug)
        ? prev.length > 1
          ? prev.filter((s) => s !== slug)
          : prev
        : [...prev, slug].slice(0, 5),
    );
  };

  const handleConsultCurator = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    try {
      const plan = await generateCuratorialOnboarding({
        displayName: profile?.displayName || firebaseUser?.displayName || 'Collector',
        specialties: selectedCategories,
        goal,
        personalNote,
      });
      setAiPlan(plan);
      setCustomTitle(plan.suggestedCollectionTitle);
      setCustomStory(plan.suggestedCollectionStory);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach AI curator right now.');
    } finally {
      setGenerating(false);
    }
  };

  const handleLaunchFirstCollection = async () => {
    if (!firebaseUser) {
      openAuthModal();
      return;
    }
    if (!profile) return;

    setSaving(true);
    setError(null);
    try {
      await updateUserPublicProfile(profile.uid, {
        specialties: selectedCategories,
        goal,
        bio: profile.bio || aiPlan?.suggestedBio || '',
        onboardingCompleted: true,
      });

      const created = await createCollectionRecord({
        profile,
        title: customTitle || 'First Cabinet Exhibition',
        story: customStory,
        category: selectedCategories[0] || 'stamps',
        visibility: 'public',
      });

      await refreshProfile();
      navigate(`/exhibition/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your first collection.');
    } finally {
      setSaving(false);
    }
  };

  const matchedCurators = DEMO_CURATORS.filter((c) =>
    c.specialties.some((s) => selectedCategories.includes(s)),
  );
  const displayCurators = matchedCurators.length > 0 ? matchedCurators : DEMO_CURATORS;

  return (
    <div className="max-w-4xl mx-auto px-5 sm:px-8 py-12 pb-20">
      <div className="border-b border-stone-200 dark:border-stone-800 pb-6">
        <p className="text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400">
          AI Curatorial Guide
        </p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
          Shape Your Personal Cabinet
        </h1>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400 max-w-2xl">
          Tell our curatorial guide what you collect and what you want to achieve. We will draft your opening exhibition, tailor photography advice, and introduce fellow specialists.
        </p>
      </div>

      {needsEmailVerification && (
        <div className="mt-6 p-4 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 text-sm text-amber-900 dark:text-amber-200">
          Please verify your email address in the{' '}
          <Link to="/studio" className="underline font-medium">
            Studio
          </Link>{' '}
          before saving your first collection to Firestore, or sign in with Google for instant verified access.
        </div>
      )}

      <form onSubmit={handleConsultCurator} className="mt-8 space-y-8">
        {/* Step 1: Categories */}
        <div>
          <label className="block text-sm font-medium text-[#1C1917] dark:text-[#F5F2EB] mb-3">
            01. Which collecting departments belong in your cabinet?
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(Object.keys(CATEGORY_METADATA) as CategorySlug[]).map((slug) => {
              const active = selectedCategories.includes(slug);
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => toggleCategory(slug)}
                  className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                    active
                      ? 'border-[#9A3412] dark:border-[#D97757] bg-[#F4EFE6] dark:bg-[#221E1A]'
                      : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171614] hover:border-stone-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[#1C1917] dark:text-[#F5F2EB]">
                      {CATEGORY_METADATA[slug].shortLabel}
                    </span>
                    {active && <Check className="w-3.5 h-3.5 text-[#9A3412] dark:text-[#D97757]" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Goal */}
        <div>
          <label className="block text-sm font-medium text-[#1C1917] dark:text-[#F5F2EB] mb-3">
            02. What is your primary goal on Fanzeum?
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(Object.keys(GOAL_LABELS) as CollectorGoal[]).map((g) => {
              const active = goal === g;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGoal(g)}
                  className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                    active
                      ? 'border-[#9A3412] dark:border-[#D97757] bg-[#F4EFE6] dark:bg-[#221E1A]'
                      : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171614]'
                  }`}
                >
                  <div className="text-sm font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
                    {GOAL_LABELS[g].title}
                  </div>
                  <div className="mt-1 text-xs text-stone-600 dark:text-stone-400">
                    {GOAL_LABELS[g].subtitle}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 3: Optional Note */}
        <div>
          <label className="block text-sm font-medium text-[#1C1917] dark:text-[#F5F2EB] mb-1.5">
            03. Tell us a little about a favourite piece or era (optional)
          </label>
          <input
            type="text"
            maxLength={240}
            value={personalNote}
            onChange={(e) => setPersonalNote(e.target.value)}
            placeholder="e.g. Inherited my grandmother’s Commonwealth stamp albums and 1960s Scottish football cards"
            className="w-full px-4 py-2.5 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0F0E0D] text-[#1C1917] dark:text-[#F5F2EB]"
          />
        </div>

        <button
          type="submit"
          disabled={generating}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#1C1917] dark:bg-[#F5F2EB] text-[#FBF9F5] dark:text-[#1C1917] text-sm font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Preparing Your Curatorial Plan…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate First Exhibition Plan
            </>
          )}
        </button>
      </form>

      {error && (
        <p className="mt-6 text-xs p-3.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300">
          {error}
        </p>
      )}

      {/* AI Generated Onboarding Plan */}
      {aiPlan && (
        <section className="mt-12 pt-10 border-t border-stone-200 dark:border-stone-800 space-y-8">
          <div className="p-6 sm:p-8 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171614] space-y-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#9A3412] dark:text-[#D97757]">
                Chief Curator’s Welcome
              </p>
              <p className="mt-2 text-lg font-serif italic text-[#1C1917] dark:text-[#F5F2EB] leading-relaxed">
                “{aiPlan.welcomeNote}”
              </p>
              <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">
                Archival Photography Tip: {aiPlan.photographyTip}
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t border-stone-100 dark:border-stone-800">
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  First Exhibition Title (Editable)
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-[#FBF9F5] dark:bg-[#0F0E0D] text-[#1C1917] dark:text-[#F5F2EB]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Opening Curatorial Narrative (Editable)
                </label>
                <textarea
                  rows={3}
                  maxLength={2500}
                  value={customStory}
                  onChange={(e) => setCustomStory(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-[#FBF9F5] dark:bg-[#0F0E0D] text-[#1C1917] dark:text-[#F5F2EB]"
                />
              </div>

              <div className="pt-2">
                {firebaseUser && profile ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleLaunchFirstCollection}
                    className="px-6 py-3 rounded-lg bg-[#9A3412] hover:bg-[#7C2D12] text-white text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? 'Creating Exhibition…' : 'Create First Exhibition & Add Photos →'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={openAuthModal}
                    className="px-6 py-3 rounded-lg bg-[#9A3412] hover:bg-[#7C2D12] text-white text-sm font-medium cursor-pointer"
                  >
                    Sign In to Save This Exhibition
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Suggested Collectors to Follow */}
          <div>
            <h2 className="text-xl font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
              Suggested Curators in Your Departments
            </h2>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {displayCurators.map((c) => (
                <Link
                  key={c.uid}
                  to={`/collector/${c.uid}`}
                  className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171614] hover:border-stone-400 transition-colors"
                >
                  <div className="text-xs text-stone-500">@{c.handle}</div>
                  <div className="mt-1 font-serif font-semibold text-base text-[#1C1917] dark:text-[#F5F2EB]">
                    {c.displayName}
                  </div>
                  <div className="mt-1 text-xs text-stone-600 dark:text-stone-400 line-clamp-2">
                    {c.bio}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
