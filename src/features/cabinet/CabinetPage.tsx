import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  BadgeCheck,
  Camera,
  Check,
  FolderPlus,
  Lock,
  MapPin,
  Pencil,
  Share2,
  UserX,
} from 'lucide-react';
import { CATEGORIES, CATEGORY_LIST, type CategorySlug } from '../../config/categories';
import { useAuth } from '../../contexts/AuthContext';
import { canUse, formatGbpRange, sanitizeHandle } from '../../lib/entitlements';
import {
  createCollectionRecord,
  fetchUserByHandle,
  isHandleAvailable,
  listOwnerCollections,
  updateUserPublicProfile,
} from '../../lib/firestoreRepo';
import { uploadAvatarPhoto } from '../../lib/imageUtils';
import type { CollectionRecord, UserProfile, VisibilityLevel } from '../../types/domain';
import { useDocumentMeta } from '../../components/DocumentMeta';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CollectorImage } from '../../components/ui/CollectorImage';
import { CompletionRing } from '../../components/ui/CompletionRing';
import { EmptyState, Skeleton } from '../../components/ui/EmptyState';
import { Sheet } from '../../components/ui/Sheet';

export const CabinetPage: React.FC = () => {
  const { atHandle, handle: routeHandle } = useParams<{ atHandle?: string; handle?: string }>();
  const navigate = useNavigate();
  const { firebaseUser, profile: viewerProfile, refreshProfile } = useAuth();

  const isInvalidAtRoute = Boolean(atHandle && !atHandle.startsWith('@'));
  const cleanHandle = (routeHandle || atHandle || '').replace(/^@+/, '').trim().toLowerCase();

  const [cabinetOwner, setCabinetOwner] = useState<UserProfile | null>(null);
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedToast, setCopiedToast] = useState(false);

  // Edit profile sheet state
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editHandle, setEditHandle] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editSpecialties, setEditSpecialties] = useState<CategorySlug[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // New collection sheet state
  const [newColOpen, setNewColOpen] = useState(false);
  const [colTitle, setColTitle] = useState('');
  const [colCategory, setColCategory] = useState<CategorySlug>('football_cards');
  const [colStory, setColStory] = useState('');
  const [colTarget, setColTarget] = useState('');
  const [colVisibility, setColVisibility] = useState<VisibilityLevel>('public');
  const [creatingCol, setCreatingCol] = useState(false);
  const [colError, setColError] = useState<string | null>(null);

  const isOwnCabinet = Boolean(
    firebaseUser?.emailVerified && cabinetOwner && firebaseUser.uid === cabinetOwner.uid,
  );

  useDocumentMeta({
    title: cabinetOwner ? `${cabinetOwner.displayName} (@${cabinetOwner.handle})` : 'Collector Cabinet',
    description: cabinetOwner?.bio || `Explore @${cleanHandle}'s collections on Fanzeum.`,
    image: cabinetOwner?.avatarUrl,
  });

  useEffect(() => {
    if (isInvalidAtRoute || !cleanHandle) {
      setLoading(false);
      return;
    }

    let active = true;
    async function load() {
      setLoading(true);
      try {
        const user = await fetchUserByHandle(cleanHandle, viewerProfile);
        if (!active) return;
        setCabinetOwner(user);
        if (user) {
          const cols = await listOwnerCollections(user.uid, firebaseUser?.uid);
          if (!active) return;
          setCollections(cols);
        } else {
          setCollections([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [cleanHandle, isInvalidAtRoute, viewerProfile, firebaseUser?.uid]);

  const totals = useMemo(() => {
    const min = collections.reduce((s, c) => s + (c.estimatedTotalMinGbp || 0), 0);
    const max = collections.reduce((s, c) => s + (c.estimatedTotalMaxGbp || 0), 0);
    const pieces = collections.reduce((s, c) => s + (c.itemCount || 0), 0);
    return { min, max, pieces };
  }, [collections]);

  const openEditProfile = () => {
    if (!cabinetOwner) return;
    setEditName(cabinetOwner.displayName);
    setEditHandle(cabinetOwner.handle);
    setEditLocation(cabinetOwner.location);
    setEditBio(cabinetOwner.bio);
    setEditSpecialties(cabinetOwner.specialties || []);
    setProfileError(null);
    setEditOpen(true);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firebaseUser || !cabinetOwner) return;
    setUploadingAvatar(true);
    setProfileError(null);
    try {
      const url = await uploadAvatarPhoto(firebaseUser.uid, file);
      await updateUserPublicProfile(firebaseUser.uid, { avatarUrl: url });
      await refreshProfile();
      setCabinetOwner((prev) => (prev ? { ...prev, avatarUrl: url } : prev));
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Could not upload avatar.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !cabinetOwner) return;
    setSavingProfile(true);
    setProfileError(null);
    try {
      const cleanNextHandle = sanitizeHandle(editHandle);
      if (cleanNextHandle !== cabinetOwner.handle) {
        const available = await isHandleAvailable(cleanNextHandle, firebaseUser.uid);
        if (!available) {
          setProfileError(`@${cleanNextHandle} is already taken. Try another handle.`);
          setSavingProfile(false);
          return;
        }
      }

      await updateUserPublicProfile(firebaseUser.uid, {
        displayName: editName,
        handle: cleanNextHandle,
        location: editLocation,
        bio: editBio,
        specialties: editSpecialties,
      });
      await refreshProfile();
      setEditOpen(false);
      if (cleanNextHandle !== cabinetOwner.handle) {
        navigate(`/@${cleanNextHandle}`, { replace: true });
      } else {
        setCabinetOwner((prev) =>
          prev
            ? {
                ...prev,
                displayName: editName.trim() || prev.displayName,
                location: editLocation,
                bio: editBio,
                specialties: editSpecialties,
              }
            : prev,
        );
      }
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Could not save profile changes.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewerProfile) return;
    setCreatingCol(true);
    setColError(null);
    try {
      const created = await createCollectionRecord({
        profile: viewerProfile,
        title: colTitle,
        story: colStory,
        category: colCategory,
        visibility: colVisibility,
        setTargetCount: Number(colTarget) || 0,
      });
      await refreshProfile();
      setNewColOpen(false);
      navigate(`/c/${created.id}`);
    } catch (err) {
      setColError(err instanceof Error ? err.message : 'Could not create collection.');
    } finally {
      setCreatingCol(false);
    }
  };

  const handleShareCabinet = async () => {
    if (!cabinetOwner) return;
    const shareUrl = `${window.location.origin}/@${cabinetOwner.handle}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${cabinetOwner.displayName} (@${cabinetOwner.handle}) on Fanzeum`,
          text: cabinetOwner.bio || `Check out @${cabinetOwner.handle}'s cabinet on Fanzeum.`,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    await navigator.clipboard?.writeText(shareUrl);
    setCopiedToast(true);
    window.setTimeout(() => setCopiedToast(false), 2600);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12 space-y-8">
        <Skeleton className="h-44" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (isInvalidAtRoute || !cabinetOwner) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-16">
        <EmptyState
          icon={<UserX className="w-6 h-6" strokeWidth={1.5} />}
          title="Cabinet not found or private"
          description="Either nobody has claimed this @handle yet, or the collector has set their cabinet to private."
          action={
            <Button onClick={() => navigate('/explore')}>Explore public cabinets</Button>
          }
        />
      </div>
    );
  }

  const showValues = !cabinetOwner.hideValues || isOwnCabinet;
  const showLocation = (!cabinetOwner.hideLocation || isOwnCabinet) && Boolean(cabinetOwner.location);
  const canCreate = canUse('create_collection', viewerProfile, {
    currentCollectionsCount: collections.length,
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12 pb-28 space-y-10">
      {/* Collector Header */}
      <Card className="p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div className="flex items-start gap-4 sm:gap-5">
            <CollectorImage
              src={cabinetOwner.avatarUrl}
              alt={cabinetOwner.displayName}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-brass/40 shrink-0 bg-surface-raised"
              imgClassName="w-full h-full object-cover rounded-full"
            />
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-display font-semibold text-ink">
                  {cabinetOwner.displayName}
                </h1>
                {cabinetOwner.isVerifiedExpert && (
                  <span
                    title="Verified category specialist"
                    className="inline-flex items-center gap-1 text-xs font-mono text-brass"
                  >
                    <BadgeCheck className="w-4 h-4" strokeWidth={1.5} />
                    <span>Specialist</span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted">
                <span className="font-mono text-brass">@{cabinetOwner.handle}</span>
                {showLocation && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" strokeWidth={1.5} />
                      {cabinetOwner.location}
                    </span>
                  </>
                )}
                {cabinetOwner.joinedLabel && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Joined {cabinetOwner.joinedLabel}</span>
                  </>
                )}
                {!cabinetOwner.isPublicProfile && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-warn">
                      <Lock className="w-3.5 h-3.5" strokeWidth={1.5} />
                      Private cabinet
                    </span>
                  </>
                )}
              </div>

              {cabinetOwner.bio && (
                <p className="text-base text-ink/90 max-w-2xl pt-1 leading-relaxed">
                  {cabinetOwner.bio}
                </p>
              )}

              {cabinetOwner.specialties?.length > 0 && (
                <div className="pt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  <span>Collects:</span>
                  {cabinetOwner.specialties.map((slug, idx) => (
                    <React.Fragment key={slug}>
                      {idx > 0 && <span aria-hidden="true">·</span>}
                      <span className="text-ink">{CATEGORIES[slug]?.shortLabel || slug}</span>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button variant="secondary" size="sm" onClick={handleShareCabinet}>
              {copiedToast ? (
                <>
                  <Check className="w-4 h-4 text-ok" strokeWidth={1.5} />
                  <span>Link copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" strokeWidth={1.5} />
                  <span>Share</span>
                </>
              )}
            </Button>

            {isOwnCabinet && (
              <>
                <Button variant="secondary" size="sm" onClick={openEditProfile}>
                  <Pencil className="w-4 h-4" strokeWidth={1.5} />
                  <span>Edit profile</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setColCategory(cabinetOwner.specialties?.[0] || 'football_cards');
                    setColTitle('');
                    setColStory('');
                    setColTarget('');
                    setColError(null);
                    setNewColOpen(true);
                  }}
                >
                  <FolderPlus className="w-4 h-4" strokeWidth={1.5} />
                  <span>New collection</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Collector Stats Strip */}
        <div className="pt-5 border-t border-border flex flex-wrap items-center gap-x-8 gap-y-3">
          <div>
            <div className="text-xs text-muted">Collections</div>
            <div className="text-xl font-mono font-semibold tabular-nums text-ink">
              {collections.length}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted">Pieces</div>
            <div className="text-xl font-mono font-semibold tabular-nums text-ink">
              {totals.pieces}
            </div>
          </div>
          {showValues && totals.max > 0 && (
            <div>
              <div className="text-xs text-muted">
                {cabinetOwner.hideValues && isOwnCabinet
                  ? 'Estimated total (hidden from visitors)'
                  : 'Estimated total'}
              </div>
              <div className="text-xl font-mono font-semibold tabular-nums text-brass">
                {formatGbpRange(totals.min, totals.max)}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Collections Grid */}
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-display font-semibold text-ink">Collections</h2>
          {isOwnCabinet && (
            <Button variant="secondary" size="sm" onClick={() => navigate('/add')}>
              <Camera className="w-4 h-4" strokeWidth={1.5} />
              <span>Add piece by photo</span>
            </Button>
          )}
        </div>

        {collections.length === 0 ? (
          <EmptyState
            icon={<FolderPlus className="w-6 h-6" strokeWidth={1.5} />}
            title={isOwnCabinet ? 'Start your first collection' : 'No public collections yet'}
            description={
              isOwnCabinet
                ? 'Group a set, binder, album, or coin tray—then snap your first piece.'
                : 'This collector has not published any public sets yet.'
            }
            action={
              isOwnCabinet ? (
                <Button onClick={() => setNewColOpen(true)}>Create collection</Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.map((col) => (
              <Link key={col.id} to={`/c/${col.id}`} className="block">
                <Card interactive className="overflow-hidden h-full flex flex-col justify-between">
                  <div>
                    <div className="aspect-[16/10] bg-surface-raised border-b border-border p-5 flex items-center justify-center after-hours-spotlight">
                      <CollectorImage
                        src={col.coverImageUrl}
                        alt={col.title}
                        category={col.category}
                        className="w-full h-full"
                        imgClassName="w-full h-full object-contain"
                      />
                    </div>
                    <div className="p-5 space-y-2">
                      <div className="text-xs text-muted flex items-center gap-2">
                        <span>{CATEGORIES[col.category]?.shortLabel || col.category}</span>
                        {isOwnCabinet && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="capitalize">{col.visibility}</span>
                          </>
                        )}
                      </div>
                      <h3 className="text-xl font-display font-semibold text-ink line-clamp-2">
                        {col.title}
                      </h3>
                      {col.story && (
                        <p className="text-sm text-muted line-clamp-2 leading-relaxed">
                          {col.story}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="px-5 pb-5 pt-3 border-t border-border flex items-center justify-between gap-3">
                    {col.setTargetCount > 0 ? (
                      <CompletionRing
                        current={col.itemCount}
                        target={col.setTargetCount}
                        size={44}
                      />
                    ) : (
                      <span className="text-sm font-mono text-muted">
                        {col.itemCount} {col.itemCount === 1 ? 'piece' : 'pieces'}
                      </span>
                    )}
                    {showValues && col.estimatedTotalMaxGbp > 0 && (
                      <span className="text-sm font-mono tabular-nums text-brass">
                        {formatGbpRange(col.estimatedTotalMinGbp, col.estimatedTotalMaxGbp)}
                      </span>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Edit Profile Sheet */}
      <Sheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit your collector profile"
        subtitle="Update your @handle, avatar photo, bio, and hobbies."
      >
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="flex items-center gap-4">
            <CollectorImage
              src={cabinetOwner.avatarUrl}
              alt={cabinetOwner.displayName}
              className="w-16 h-16 rounded-full border border-border shrink-0 bg-surface-raised"
              imgClassName="w-full h-full object-cover rounded-full"
            />
            <label className="min-h-[40px] px-4 py-2 rounded-xl border border-border bg-surface-raised text-sm font-medium text-ink hover:border-brass/50 inline-flex items-center gap-2 cursor-pointer">
              <Camera className="w-4 h-4 text-brass" strokeWidth={1.5} />
              <span>{uploadingAvatar ? 'Uploading…' : 'Change avatar'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="sr-only"
              />
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Display name</label>
            <input
              type="text"
              required
              maxLength={80}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-base rounded-xl border border-border bg-bg text-ink"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Public @handle</label>
            <div className="flex items-center rounded-xl border border-border bg-bg px-3.5">
              <span className="text-muted font-mono">@</span>
              <input
                type="text"
                required
                maxLength={28}
                value={editHandle}
                onChange={(e) => setEditHandle(e.target.value)}
                className="w-full min-h-[44px] pl-1 py-2 text-base font-mono bg-transparent text-ink focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Town or county</label>
            <input
              type="text"
              maxLength={80}
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              placeholder="e.g. Sheffield, South Yorkshire"
              className="w-full min-h-[44px] px-3.5 py-2 text-base rounded-xl border border-border bg-bg text-ink"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Collector bio</label>
            <textarea
              rows={3}
              maxLength={600}
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              placeholder="What do you collect, chase, or specialise in?"
              className="w-full px-3.5 py-2.5 text-base rounded-xl border border-border bg-bg text-ink"
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-ink mb-2">Hobbies you collect</span>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_LIST.map((cat) => {
                const selected = editSpecialties.includes(cat.slug);
                return (
                  <button
                    key={cat.slug}
                    type="button"
                    onClick={() =>
                      setEditSpecialties((prev) =>
                        selected ? prev.filter((s) => s !== cat.slug) : [...prev, cat.slug],
                      )
                    }
                    className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                      selected
                        ? 'bg-brass text-brass-fg border-brass'
                        : 'bg-bg text-muted border-border hover:text-ink'
                    }`}
                  >
                    {cat.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {profileError && (
            <p className="text-sm text-danger bg-danger/10 border border-danger/40 rounded-xl p-3">
              {profileError}
            </p>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </Sheet>

      {/* New Collection Sheet */}
      <Sheet
        open={newColOpen}
        onClose={() => setNewColOpen(false)}
        title="New collection"
        subtitle="Create a binder, set checklist, coin tray, or crate."
      >
        {!canCreate.allowed ? (
          <div className="space-y-4">
            <p className="text-base text-muted">{canCreate.reason}</p>
            <Button fullWidth onClick={() => setNewColOpen(false)}>
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleCreateCollection} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Collection title</label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={120}
                value={colTitle}
                onChange={(e) => setColTitle(e.target.value)}
                placeholder="e.g. 2003-04 Topps Chrome Premier League Refractors"
                className="w-full min-h-[44px] px-3.5 py-2 text-base rounded-xl border border-border bg-bg text-ink"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Hobby</label>
                <select
                  value={colCategory}
                  onChange={(e) => setColCategory(e.target.value as CategorySlug)}
                  className="w-full min-h-[44px] px-3.5 py-2 text-base rounded-xl border border-border bg-bg text-ink"
                >
                  {CATEGORY_LIST.map((cat) => (
                    <option key={cat.slug} value={cat.slug}>
                      {cat.shortLabel}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1">Visibility</label>
                <select
                  value={colVisibility}
                  onChange={(e) => setColVisibility(e.target.value as VisibilityLevel)}
                  className="w-full min-h-[44px] px-3.5 py-2 text-base rounded-xl border border-border bg-bg text-ink"
                >
                  <option value="public">Public</option>
                  <option value="private">Private (only me)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Set target size (optional)
              </label>
              <input
                type="number"
                min={0}
                max={50000}
                value={colTarget}
                onChange={(e) => setColTarget(e.target.value)}
                placeholder="e.g. 271 for a full sticker album (leave blank if open-ended)"
                className="w-full min-h-[44px] px-3.5 py-2 text-base font-mono rounded-xl border border-border bg-bg text-ink"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Story behind this collection
              </label>
              <textarea
                rows={3}
                maxLength={2500}
                value={colStory}
                onChange={(e) => setColStory(e.target.value)}
                placeholder="How you started chasing this run, favourite pulls, or grading goals…"
                className="w-full px-3.5 py-2.5 text-base rounded-xl border border-border bg-bg text-ink"
              />
            </div>

            {colError && (
              <p className="text-sm text-danger bg-danger/10 border border-danger/40 rounded-xl p-3">
                {colError}
              </p>
            )}

            <div className="pt-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setNewColOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creatingCol}>
                {creatingCol ? 'Creating…' : 'Create collection'}
              </Button>
            </div>
          </form>
        )}
      </Sheet>
    </div>
  );
};
