import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, Loader2, LogOut, Plus, Sparkles, Trash2 } from 'lucide-react';
import {
  CATEGORY_METADATA,
  CategorySlug,
  CollectionRecord,
  VisibilityLevel,
} from '../types/domain';
import { useAuth } from '../contexts/AuthContext';
import {
  canCreateCollection,
  formatGbpRange,
  getEntitlements,
} from '../lib/entitlements';
import {
  createCollectionRecord,
  deleteEntireCollection,
  listOwnerCollections,
  seedSampleCabinetForUser,
  updateUserPublicProfile,
} from '../lib/firestoreRepo';
import { polishCollectionStory } from '../lib/aiClient';
import { ArchivalImage } from '../components/ArchivalImage';
import { PhotoIdentifyModal } from '../components/PhotoIdentifyModal';

export const StudioPage: React.FC = () => {
  const {
    firebaseUser,
    profile,
    needsEmailVerification,
    openAuthModal,
    resendVerificationEmail,
    refreshVerificationStatus,
    refreshProfile,
    signOut,
  } = useAuth();
  const navigate = useNavigate();

  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [loadingCols, setLoadingCols] = useState(false);

  // New Collection Form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CategorySlug>('stamps');
  const [visibility, setVisibility] = useState<VisibilityLevel>('public');
  const [setTargetCount, setSetTargetCount] = useState<number>(0);
  const [story, setStory] = useState('');
  const [polishingStory, setPolishingStory] = useState(false);
  const [creating, setCreating] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Profile Edit Form
  const [editingProfile, setEditingProfile] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Photo Upload Modal Target
  const [activeUploadCollection, setActiveUploadCollection] = useState<CollectionRecord | null>(
    null,
  );
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const loadMyCollections = useCallback(async () => {
    if (!firebaseUser?.emailVerified) return;
    setLoadingCols(true);
    try {
      const cols = await listOwnerCollections(firebaseUser.uid);
      setCollections(cols);
    } catch (err) {
      console.error('Failed to load owner collections:', err);
    } finally {
      setLoadingCols(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    loadMyCollections();
  }, [loadMyCollections]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setHandle(profile.handle);
      setLocation(profile.location);
      setBio(profile.bio);
    }
  }, [profile]);

  if (!firebaseUser) {
    return (
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-20 text-center">
        <p className="text-xs uppercase tracking-widest text-stone-500">Collector Studio</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
          Sign In to Curate Your Cabinet
        </h1>
        <p className="mt-3 text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto">
          Create public or private exhibitions, photograph collectibles for instant AI identification and £ GBP valuation, and manage your collector profile.
        </p>
        <button
          type="button"
          onClick={openAuthModal}
          className="mt-6 px-6 py-3 rounded-lg bg-[#9A3412] hover:bg-[#7C2D12] text-white text-sm font-medium cursor-pointer"
        >
          Sign In or Register
        </button>
      </div>
    );
  }

  if (needsEmailVerification) {
    return (
      <div className="max-w-xl mx-auto px-5 sm:px-8 py-16">
        <div className="p-8 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171614] space-y-4">
          <p className="text-xs uppercase tracking-widest text-[#9A3412] dark:text-[#D97757]">
            Security Verification Required
          </p>
          <h1 className="text-2xl font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
            Verify Your Email Address
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
            We sent a verification link to <strong>{firebaseUser.email}</strong>. Fanzeum’s security rules require verified email addresses before publishing collections or storing personal archives.
          </p>
          {feedbackMsg && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400">{feedbackMsg}</p>
          )}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={async () => {
                const verified = await refreshVerificationStatus();
                if (!verified) {
                  setFeedbackMsg('Not verified yet — please click the link in your inbox first.');
                }
              }}
              className="px-4 py-2 rounded-lg bg-[#1C1917] dark:bg-[#F5F2EB] text-[#FBF9F5] dark:text-[#1C1917] text-xs font-medium cursor-pointer"
            >
              I’ve Verified · Refresh Status
            </button>
            <button
              type="button"
              onClick={async () => {
                await resendVerificationEmail();
                setFeedbackMsg('Verification email resent.');
              }}
              className="px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 text-xs font-medium cursor-pointer"
            >
              Resend Verification Email
            </button>
            <button
              type="button"
              onClick={signOut}
              className="px-3 py-2 text-xs text-stone-500 hover:underline cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const entitlements = getEntitlements(profile);
  const creationGate = canCreateCollection(profile, collections.length);

  const handlePolishStory = async () => {
    setPolishingStory(true);
    try {
      const refined = await polishCollectionStory({
        title: title || 'Selected Cabinet',
        category,
        draftStory: story || `A curated ${CATEGORY_METADATA[category].shortLabel} collection.`,
      });
      setStory(refined);
    } catch (err) {
      setFeedbackMsg(err instanceof Error ? err.message : 'Could not polish story.');
    } finally {
      setPolishingStory(false);
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !creationGate.allowed) return;
    setCreating(true);
    setFeedbackMsg(null);
    try {
      const created = await createCollectionRecord({
        profile,
        title,
        story,
        category,
        visibility,
        setTargetCount,
      });
      await refreshProfile();
      await loadMyCollections();
      setTitle('');
      setStory('');
      setSetTargetCount(0);
      setShowCreateForm(false);
      setActiveUploadCollection(created);
    } catch (err) {
      setFeedbackMsg(err instanceof Error ? err.message : 'Could not create collection.');
    } finally {
      setCreating(false);
    }
  };

  const handleSeedDemo = async () => {
    if (!profile) return;
    setSeeding(true);
    setFeedbackMsg(null);
    try {
      const seeded = await seedSampleCabinetForUser(profile);
      await refreshProfile();
      await loadMyCollections();
      navigate(`/exhibition/${seeded.id}`);
    } catch (err) {
      setFeedbackMsg(err instanceof Error ? err.message : 'Could not seed starter cabinet.');
    } finally {
      setSeeding(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSavingProfile(true);
    try {
      await updateUserPublicProfile(profile.uid, {
        displayName,
        handle,
        location,
        bio,
      });
      await refreshProfile();
      setEditingProfile(false);
      setFeedbackMsg('Curator profile updated.');
    } catch (err) {
      setFeedbackMsg(err instanceof Error ? err.message : 'Could not update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeleteCollection = async (col: CollectionRecord) => {
    if (!profile) return;
    await deleteEntireCollection(col, profile);
    await refreshProfile();
    await loadMyCollections();
  };

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 py-12 pb-20 space-y-12">
      {/* Curator Header & Entitlements Bar */}
      <section className="border-b border-stone-200 dark:border-stone-800 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
            <span>{entitlements.label}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {collections.length} of {entitlements.maxCollections} collections used
            </span>
            {profile?.handle && (
              <>
                <span aria-hidden="true">·</span>
                <Link
                  to={`/collector/${profile.uid}`}
                  className="underline hover:text-[#9A3412] dark:hover:text-[#D97757]"
                >
                  Public Profile (@{profile.handle})
                </Link>
              </>
            )}
          </div>
          <h1 className="mt-2 text-3xl sm:text-4xl font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
            {profile?.displayName || 'Collector'}’s Studio
          </h1>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            {profile?.bio || 'Manage your exhibitions, upload item photographs for AI cataloguing, and edit your curator profile.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setEditingProfile((prev) => !prev)}
            className="px-3.5 py-2 rounded-lg border border-stone-300 dark:border-stone-700 text-xs font-medium text-[#1C1917] dark:text-[#F5F2EB] hover:bg-stone-200/50 dark:hover:bg-stone-800 cursor-pointer"
          >
            {editingProfile ? 'Close Profile Editor' : 'Edit Profile'}
          </button>
          <button
            type="button"
            disabled={!creationGate.allowed}
            onClick={() => setShowCreateForm((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#9A3412] hover:bg-[#7C2D12] text-white text-xs font-medium disabled:opacity-50 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Collection
          </button>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-stone-500 hover:text-[#1C1917] dark:hover:text-[#F5F2EB] cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </section>

      {feedbackMsg && (
        <p className="text-xs p-3.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171614] text-stone-700 dark:text-stone-300">
          {feedbackMsg}
        </p>
      )}

      {/* Profile Editor */}
      {editingProfile && (
        <form
          onSubmit={handleSaveProfile}
          className="p-6 sm:p-8 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171614] space-y-4 max-w-2xl"
        >
          <h2 className="text-xl font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
            Public Curator Profile
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Display Name
              </label>
              <input
                type="text"
                required
                maxLength={80}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-[#FBF9F5] dark:bg-[#0F0E0D]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Handle (lowercase)
              </label>
              <input
                type="text"
                required
                maxLength={32}
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-stone-300 dark:border-stone-700 bg-[#FBF9F5] dark:bg-[#0F0E0D]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
              Location
            </label>
            <input
              type="text"
              maxLength={80}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Edinburgh, Scotland, UK"
              className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-[#FBF9F5] dark:bg-[#0F0E0D]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
              Curatorial Statement / Bio
            </label>
            <textarea
              rows={3}
              maxLength={600}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-[#FBF9F5] dark:bg-[#0F0E0D]"
            />
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="px-5 py-2 rounded-lg bg-[#1C1917] dark:bg-[#F5F2EB] text-[#FBF9F5] dark:text-[#1C1917] text-xs font-medium cursor-pointer"
          >
            {savingProfile ? 'Saving…' : 'Save Profile'}
          </button>
        </form>
      )}

      {/* New Collection Form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateCollection}
          className="p-6 sm:p-8 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171614] space-y-4 max-w-3xl"
        >
          <h2 className="text-2xl font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
            Create New Exhibition Cabinet
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Collection Title
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Post-War British Commemorative Stamps"
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-[#FBF9F5] dark:bg-[#0F0E0D]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Primary Department
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CategorySlug)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-[#FBF9F5] dark:bg-[#0F0E0D]"
              >
                {Object.entries(CATEGORY_METADATA).map(([slug, meta]) => (
                  <option key={slug} value={slug}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Visibility
              </label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as VisibilityLevel)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-[#FBF9F5] dark:bg-[#0F0E0D]"
              >
                <option value="public">Public Exhibition (Open to Everyone)</option>
                <option value="followers">Followers Only</option>
                <option value="private">Private Vault (Only You)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Target Set Size (0 if open-ended)
              </label>
              <input
                type="number"
                min={0}
                max={50000}
                value={setTargetCount}
                onChange={(e) => setSetTargetCount(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-stone-300 dark:border-stone-700 bg-[#FBF9F5] dark:bg-[#0F0E0D]"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                Curatorial Story &amp; Provenance Notes
              </label>
              <button
                type="button"
                disabled={polishingStory}
                onClick={handlePolishStory}
                className="inline-flex items-center gap-1 text-xs text-[#9A3412] dark:text-[#D97757] hover:underline cursor-pointer"
              >
                {polishingStory ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                Polish with AI Curator
              </button>
            </div>
            <textarea
              rows={3}
              maxLength={2500}
              value={story}
              onChange={(e) => setStory(e.target.value)}
              placeholder="Share the story behind this collection, how you acquired key pieces, or what makes this set special…"
              className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-[#FBF9F5] dark:bg-[#0F0E0D]"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={creating}
              className="px-5 py-2.5 rounded-lg bg-[#9A3412] hover:bg-[#7C2D12] text-white text-xs font-medium cursor-pointer"
            >
              {creating ? 'Creating…' : 'Create Collection & Upload Photos'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2.5 rounded-lg border border-stone-300 dark:border-stone-700 text-xs cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Owner's Collections List */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
            Your Collections ({collections.length})
          </h2>
          {collections.length === 0 && !loadingCols && (
            <button
              type="button"
              disabled={seeding}
              onClick={handleSeedDemo}
              className="text-xs font-medium text-[#9A3412] dark:text-[#D97757] hover:underline cursor-pointer"
            >
              {seeding ? 'Seeding Starter Cabinet…' : '+ Seed Starter UK Cabinet for Testing'}
            </button>
          )}
        </div>

        {loadingCols ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2].map((n) => (
              <div
                key={n}
                className="h-72 rounded-xl bg-stone-100 dark:bg-stone-900 animate-pulse"
              />
            ))}
          </div>
        ) : collections.length === 0 ? (
          <div className="p-12 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171614] text-center space-y-4">
            <h3 className="text-xl font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
              Your Studio Is Ready
            </h3>
            <p className="text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto">
              Start with our AI Curatorial Guide, create a blank collection to photograph your own items, or seed a starter UK cabinet to test editing right away.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="px-5 py-2.5 rounded-lg bg-[#9A3412] text-white text-xs font-medium cursor-pointer"
              >
                Create Blank Collection
              </button>
              <Link
                to="/onboarding"
                className="px-5 py-2.5 rounded-lg border border-stone-300 dark:border-stone-700 text-xs font-medium"
              >
                Use AI Onboarding Guide
              </Link>
              <button
                type="button"
                disabled={seeding}
                onClick={handleSeedDemo}
                className="px-5 py-2.5 rounded-lg border border-stone-300 dark:border-stone-700 text-xs font-medium cursor-pointer"
              >
                {seeding ? 'Seeding…' : 'Seed Starter UK Cabinet'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {collections.map((col) => (
              <div
                key={col.id}
                className="flex flex-col rounded-xl overflow-hidden border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171614]"
              >
                <Link
                  to={`/exhibition/${col.id}`}
                  className="aspect-[4/3] bg-[#EFECE6] dark:bg-[#0F0E0D] block overflow-hidden"
                >
                  <ArchivalImage src={col.coverImageUrl} alt={col.title} fallbackTitle={col.title} />
                </Link>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                      <span>{CATEGORY_METADATA[col.category]?.shortLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span>{col.visibility}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{col.itemCount} items</span>
                    </div>
                    <Link
                      to={`/exhibition/${col.id}`}
                      className="mt-1.5 block text-xl font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB] hover:text-[#9A3412]"
                    >
                      {col.title}
                    </Link>
                    <p className="mt-1 font-mono text-xs tabular-nums text-[#9A3412] dark:text-[#D97757]">
                      {formatGbpRange(col.estimatedTotalMinGbp, col.estimatedTotalMaxGbp)}
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveUploadCollection(col)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1C1917] dark:bg-[#F5F2EB] text-[#FBF9F5] dark:text-[#1C1917] text-xs font-medium cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Add by Photo
                    </button>

                    <div className="flex items-center gap-2">
                      <Link
                        to={`/exhibition/${col.id}`}
                        className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 text-xs font-medium"
                      >
                        Exhibit
                      </Link>
                      <button
                        type="button"
                        aria-label={`Delete ${col.title}`}
                        onClick={() => handleDeleteCollection(col)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-red-700 dark:hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {activeUploadCollection && firebaseUser && (
        <PhotoIdentifyModal
          open={Boolean(activeUploadCollection)}
          collectionRecord={activeUploadCollection}
          ownerId={firebaseUser.uid}
          onClose={() => setActiveUploadCollection(null)}
          onSaved={loadMyCollections}
        />
      )}
    </div>
  );
};
