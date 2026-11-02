import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Camera, Check } from 'lucide-react';
import { CATEGORIES, CATEGORY_LIST, type CategorySlug } from '../../config/categories';
import { useAuth } from '../../contexts/AuthContext';
import { generateOnboardingGuide } from '../../lib/aiClient';
import { sanitizeHandle } from '../../lib/entitlements';
import {
  createCollectionRecord,
  isHandleAvailable,
  updateUserPublicProfile,
} from '../../lib/firestoreRepo';
import { uploadAvatarPhoto } from '../../lib/imageUtils';
import { GOAL_OPTIONS, type CollectorGoal } from '../../types/domain';
import { useDocumentMeta } from '../../components/DocumentMeta';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { CollectorImage } from '../../components/ui/CollectorImage';
import { EmptyState } from '../../components/ui/EmptyState';

export const OnboardingPage: React.FC = () => {
  const { firebaseUser, profile, openAuthModal, refreshProfile } = useAuth();
  const navigate = useNavigate();

  useDocumentMeta({
    title: 'Set Up Your Collector Showcase',
    description: 'Pick what you collect, claim your @handle, and create your starter collection.',
  });

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [specialties, setSpecialties] = useState<CategorySlug[]>(['football_cards']);
  const [goal, setGoal] = useState<CollectorGoal>('exhibit');
  const [handleInput, setHandleInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [starterTitle, setStarterTitle] = useState('');
  const [starterStory, setStarterStory] = useState('');
  const [welcomeTip, setWelcomeTip] = useState('');
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    if (profile.handle && !handleInput) setHandleInput(profile.handle);
    if (profile.location && !locationInput) setLocationInput(profile.location);
    if (profile.avatarUrl && !avatarUrl) setAvatarUrl(profile.avatarUrl);
    if (profile.specialties?.length > 0) setSpecialties(profile.specialties);
  }, [profile]);

  const moveToStep3 = async () => {
    setStep(3);
    const primaryCat = CATEGORIES[specialties[0] || 'football_cards'];
    setStarterTitle((prev) => prev || `My ${primaryCat.shortLabel} Showcase`);
    if (!profile) return;

    setLoadingSuggestion(true);
    try {
      const suggestion = await generateOnboardingGuide({
        displayName: profile.displayName,
        specialties,
        goal,
        location: locationInput || undefined,
      });
      setStarterTitle(suggestion.suggestedCollectionTitle);
      setStarterStory(suggestion.suggestedCollectionStory);
      setWelcomeTip(suggestion.photoTip);
    } catch {
      // Sensible instant defaults remain in place
    } finally {
      setLoadingSuggestion(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firebaseUser) return;
    setUploadingAvatar(true);
    try {
      const uploaded = await uploadAvatarPhoto(firebaseUser.uid, file);
      setAvatarUrl(uploaded);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not upload avatar.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser?.emailVerified || !profile) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const cleanHandle = sanitizeHandle(handleInput);
      const available = await isHandleAvailable(cleanHandle, firebaseUser.uid);
      if (!available) {
        setErrorMsg(`@${cleanHandle} is already taken. Try adding your town or collecting initials.`);
        setSubmitting(false);
        return;
      }

      await updateUserPublicProfile(firebaseUser.uid, {
        handle: cleanHandle,
        location: locationInput.trim(),
        avatarUrl,
        specialties,
        goal,
        onboardingCompleted: true,
      });

      const createdCol = await createCollectionRecord({
        profile: {
          ...profile,
          handle: cleanHandle,
        },
        title: starterTitle.trim() || `My ${CATEGORIES[specialties[0] || 'football_cards'].shortLabel} Set`,
        story: starterStory.trim(),
        category: specialties[0] || 'football_cards',
        visibility: 'public',
      });

      await refreshProfile();
      navigate(`/add?collectionId=${createdCol.id}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not finish setup.');
      setSubmitting(false);
    }
  };

  if (!firebaseUser) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-16">
        <EmptyState
          title="Sign in to set up your showcase"
          description="Takes under a minute—pick what you collect, claim your @handle, and snap your first piece."
          action={<Button onClick={openAuthModal}>Sign in</Button>}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10 sm:py-14 pb-28 space-y-8">
      <div className="space-y-1">
        <div className="text-xs font-mono text-brass">Step {step} of 3</div>
        <h1 className="text-3xl sm:text-4xl font-display font-semibold text-ink">
          {step === 1
            ? 'What do you collect?'
            : step === 2
              ? 'What do you want to do first?'
              : 'Claim your @handle & first set'}
        </h1>
      </div>

      {/* Step 1: Visual Hobby Tiles */}
      {step === 1 && (
        <div className="space-y-6">
          <p className="text-base text-muted">
            Pick one or more hobbies so we set up the right grading scales and catalogue numbers.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {CATEGORY_LIST.map((cat) => {
              const selected = specialties.includes(cat.slug);
              return (
                <button
                  key={cat.slug}
                  type="button"
                  onClick={() =>
                    setSpecialties((prev) =>
                      selected
                        ? prev.length > 1
                          ? prev.filter((s) => s !== cat.slug)
                          : prev
                        : [...prev, cat.slug],
                    )
                  }
                  className={`p-4 rounded-2xl border text-left flex items-start justify-between gap-3 transition-colors cursor-pointer ${
                    selected
                      ? 'border-brass bg-surface-raised'
                      : 'border-border bg-surface hover:border-brass/40'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-bg border border-border text-brass flex items-center justify-center shrink-0">
                      <CategoryIcon category={cat.slug} className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-base font-display font-semibold text-ink">
                        {cat.shortLabel}
                      </div>
                      <div className="text-xs text-muted mt-0.5 leading-relaxed">
                        {cat.tagline}
                      </div>
                    </div>
                  </div>
                  {selected && (
                    <Check className="w-5 h-5 text-brass shrink-0 mt-1" strokeWidth={1.5} />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex justify-end">
            <Button size="lg" onClick={() => setStep(2)}>
              <span>Next</span>
              <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Collector Goal */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3.5">
            {(Object.keys(GOAL_OPTIONS) as CollectorGoal[]).map((gKey) => {
              const item = GOAL_OPTIONS[gKey];
              const selected = goal === gKey;
              return (
                <button
                  key={gKey}
                  type="button"
                  onClick={() => setGoal(gKey)}
                  className={`p-5 rounded-2xl border text-left flex items-center justify-between gap-4 transition-colors cursor-pointer ${
                    selected
                      ? 'border-brass bg-surface-raised'
                      : 'border-border bg-surface hover:border-brass/40'
                  }`}
                >
                  <div>
                    <div className="text-lg font-display font-semibold text-ink">{item.title}</div>
                    <div className="text-sm text-muted mt-1">{item.subtitle}</div>
                  </div>
                  {selected && <Check className="w-5 h-5 text-brass shrink-0" strokeWidth={1.5} />}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>
              ← Back
            </Button>
            <Button size="lg" onClick={() => void moveToStep3()}>
              <span>Next</span>
              <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: @Handle, Avatar & Starter Collection */}
      {step === 3 && (
        <form onSubmit={handleFinish} className="space-y-6">
          <Card className="p-6 space-y-5">
            <div className="flex items-center gap-4">
              <CollectorImage
                src={avatarUrl}
                alt={profile?.displayName || 'Collector'}
                className="w-16 h-16 rounded-full border border-border bg-surface-raised shrink-0"
                imgClassName="w-full h-full object-cover rounded-full"
              />
              <label className="min-h-[40px] px-4 py-2 rounded-xl border border-border bg-surface-raised text-sm font-medium text-ink hover:border-brass/50 inline-flex items-center gap-2 cursor-pointer">
                <Camera className="w-4 h-4 text-brass" strokeWidth={1.5} />
                <span>{uploadingAvatar ? 'Uploading…' : 'Upload avatar (optional)'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="sr-only"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1">
                  Your public @handle
                </label>
                <div className="flex items-center rounded-xl border border-border bg-bg px-3.5">
                  <span className="text-muted font-mono">@</span>
                  <input
                    type="text"
                    required
                    maxLength={28}
                    value={handleInput}
                    onChange={(e) => setHandleInput(e.target.value)}
                    className="w-full min-h-[44px] pl-1 py-2 text-base font-mono bg-transparent text-ink focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1">
                  Town or county (optional)
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  placeholder="e.g. Bristol or Glasgow"
                  className="w-full min-h-[44px] px-3.5 py-2 text-base rounded-xl border border-border bg-bg text-ink"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-border space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-ink">First collection name</label>
                {loadingSuggestion && (
                  <span className="text-xs font-mono text-brass">Tailoring suggestion…</span>
                )}
              </div>
              <input
                type="text"
                required
                maxLength={120}
                value={starterTitle}
                onChange={(e) => setStarterTitle(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-base rounded-xl border border-border bg-bg text-ink"
              />

              <div>
                <label className="block text-sm font-medium text-ink mb-1">
                  Short note (optional)
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={starterStory}
                  onChange={(e) => setStarterStory(e.target.value)}
                  className="w-full px-3.5 py-2 text-base rounded-xl border border-border bg-bg text-ink"
                />
              </div>

              {welcomeTip && (
                <p className="text-xs text-muted">Photo tip: {welcomeTip}</p>
              )}
            </div>
          </Card>

          {errorMsg && (
            <p className="text-sm text-danger bg-danger/10 border border-danger/40 rounded-xl p-3">
              {errorMsg}
            </p>
          )}

          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep(2)}>
              ← Back
            </Button>
            <Button type="submit" size="lg" disabled={submitting}>
              <Camera className="w-4 h-4" strokeWidth={1.5} />
              <span>{submitting ? 'Setting up…' : 'Create showcase & add first piece'}</span>
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};
