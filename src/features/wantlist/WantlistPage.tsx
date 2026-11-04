import React, { useEffect, useState } from 'react';
import { Bookmark, BookmarkPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { CATEGORIES, CATEGORY_LIST, type CategorySlug } from '../../config/categories';
import { useAuth } from '../../contexts/AuthContext';
import { formatGbp } from '../../lib/entitlements';
import { addWant, deleteWant, fetchUserWants, updateWant } from '../../lib/interactionRepo';
import type { WantItemRecord } from '../../types/domain';
import { useDocumentMeta } from '../../components/DocumentMeta';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { EmptyState, Skeleton } from '../../components/ui/EmptyState';
import { Sheet } from '../../components/ui/Sheet';

export const WantlistPage: React.FC = () => {
  const { firebaseUser, openAuthModal } = useAuth();
  const uid = firebaseUser?.uid || 'guest_user';
  const isVerified = Boolean(firebaseUser?.emailVerified);

  useDocumentMeta({
    title: 'My Want List · Fanzeum',
    description: 'Track pieces you are looking for. Get in-app alerts when a matching Fresh Find appears.',
  });

  const [wants, setWants] = useState<WantItemRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [selectedCat, setSelectedCat] = useState<CategorySlug | 'all'>('all');

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingWant, setEditingWant] = useState<WantItemRecord | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CategorySlug>('stamps');
  const [notes, setNotes] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [keyFields, setKeyFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const loadWants = async () => {
    setLoading(true);
    try {
      const list = await fetchUserWants(uid);
      setWants(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWants();
  }, [uid]);

  const openAdd = () => {
    setEditingWant(null);
    setTitle('');
    setCategory('stamps');
    setNotes('');
    setMaxPrice('');
    setKeyFields({});
    setSheetOpen(true);
  };

  const openEdit = (w: WantItemRecord) => {
    setEditingWant(w);
    setTitle(w.title);
    setCategory(w.category);
    setNotes(w.notes || '');
    setMaxPrice(w.maxPriceGbp !== undefined ? String(w.maxPriceGbp) : '');
    const kf: Record<string, string> = {};
    if (w.keyFields) {
      Object.entries(w.keyFields).forEach(([k, v]) => {
        kf[k] = String(v);
      });
    }
    setKeyFields(kf);
    setSheetOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const numPrice = maxPrice ? Number(maxPrice) : undefined;
      if (editingWant) {
        await updateWant({
          wantId: editingWant.id,
          category,
          title: title.trim(),
          keyFields,
          notes: notes.trim(),
          maxPriceGbp: numPrice,
          isVerifiedUser: isVerified,
        });
      } else {
        await addWant({
          userId: uid,
          category,
          title: title.trim(),
          keyFields,
          notes: notes.trim(),
          maxPriceGbp: numPrice,
          isVerifiedUser: isVerified,
        });
      }
      setSheetOpen(false);
      await loadWants();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (wantId: string) => {
    await deleteWant({ wantId, isVerifiedUser: isVerified });
    await loadWants();
  };

  const filtered = selectedCat === 'all' ? wants : wants.filter((w) => w.category === selectedCat);
  const activeCatConfig = CATEGORIES[category];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12 pb-28 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-mono text-brass">
            <Bookmark className="w-4 h-4" strokeWidth={1.5} />
            <span>Collector Want List</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-semibold text-ink mt-1">
            My Wantlist
          </h1>
          <p className="text-base text-muted mt-1 max-w-2xl">
            Keep track of the pieces you are hunting. When another collector adds a matching Fresh
            Find, you will receive an in-app alert.
          </p>
        </div>

        <Button onClick={openAdd}>
          <Plus className="w-4 h-4" />
          <span>Add want</span>
        </Button>
      </div>

      {/* Category Filter */}
      {wants.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCat('all')}
            className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer ${
              selectedCat === 'all'
                ? 'bg-brass text-brass-fg border-brass'
                : 'bg-surface text-muted border-border hover:text-ink'
            }`}
          >
            All wants ({wants.length})
          </button>
          {CATEGORY_LIST.map((cat) => {
            const count = wants.filter((w) => w.category === cat.slug).length;
            if (count === 0) return null;
            return (
              <button
                key={cat.slug}
                type="button"
                onClick={() => setSelectedCat(cat.slug)}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer ${
                  selectedCat === cat.slug
                    ? 'bg-brass text-brass-fg border-brass'
                    : 'bg-surface text-muted border-border hover:text-ink'
                }`}
              >
                <CategoryIcon category={cat.slug} className="w-3.5 h-3.5" />
                <span>
                  {cat.shortLabel} ({count})
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<BookmarkPlus className="w-6 h-6" strokeWidth={1.5} />}
          title={wants.length === 0 ? 'Your Want List is empty' : 'No wants in this hobby'}
          description={
            wants.length === 0
              ? 'Click "I want one" on any showcase piece or Fresh Find, or add your wishlist targets here.'
              : 'Try selecting all wants.'
          }
          action={
            wants.length === 0 ? (
              <Button onClick={openAdd}>Add your first want</Button>
            ) : (
              <Button variant="secondary" onClick={() => setSelectedCat('all')}>
                Show all wants
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((want) => {
            const cat = CATEGORIES[want.category];
            return (
              <Card key={want.id} raised className="p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-brass font-mono">
                      <CategoryIcon category={want.category} className="w-3.5 h-3.5" />
                      <span>{cat?.shortLabel || want.category}</span>
                    </span>
                    {want.maxPriceGbp !== undefined && want.maxPriceGbp > 0 && (
                      <span className="font-mono text-muted">
                        Target: ≤ {formatGbp(want.maxPriceGbp)}
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-display font-semibold text-ink leading-snug">
                    {want.title}
                  </h3>

                  {want.keyFields && Object.keys(want.keyFields).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Object.entries(want.keyFields).map(([k, v]) => {
                        if (!v) return null;
                        return (
                          <span
                            key={k}
                            className="px-2 py-0.5 rounded-lg bg-surface border border-border text-[11px] font-mono text-muted"
                          >
                            {k}: {String(v)}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {want.notes && (
                    <p className="text-xs text-muted leading-relaxed line-clamp-3 pt-1">
                      {want.notes}
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => void handleDelete(want.id)}
                    className="p-1.5 text-muted hover:text-danger rounded-lg transition-colors cursor-pointer"
                    title="Remove from Want List"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                  </button>

                  <Button variant="ghost" size="sm" onClick={() => openEdit(want)}>
                    <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span>Edit</span>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Sheet */}
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editingWant ? 'Edit want' : 'Add want target'}
        subtitle="Specify what piece or variant you are hunting for."
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Hobby</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CategorySlug)}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm rounded-xl border border-border bg-bg text-ink"
            >
              {CATEGORY_LIST.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.shortLabel}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Title / Piece Name</label>
            <input
              type="text"
              required
              maxLength={140}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 1840 Two Penny Blue or 1996 Topps Kobe Bryant Rookie"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm rounded-xl border border-border bg-bg text-ink"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">
              Target budget (£ optional)
            </label>
            <input
              type="number"
              min={0}
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="e.g. 150"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono rounded-xl border border-border bg-bg text-ink"
            />
          </div>

          {/* Key fields for category */}
          <div className="pt-2 border-t border-border space-y-3">
            <div className="text-xs font-mono text-brass">
              Key fields to match ({activeCatConfig?.shortLabel})
            </div>
            {activeCatConfig?.fields.slice(0, 4).map((f) => (
              <div key={f.key}>
                <label className="block text-xs text-muted mb-1">{f.label}</label>
                <input
                  type="text"
                  value={keyFields[f.key] || ''}
                  onChange={(e) =>
                    setKeyFields((prev) => ({ ...prev, [f.key]: e.target.value }))
                  }
                  placeholder={f.placeholder || `Matching ${f.label.toLowerCase()}`}
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm rounded-xl border border-border bg-bg text-ink"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">
              Notes / Condition wanted
            </label>
            <textarea
              rows={3}
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Plate 1 or 2, original gum, or PSA 8+ only..."
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-border bg-bg text-ink"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setSheetOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !title.trim()}>
              {saving ? 'Saving…' : editingWant ? 'Save changes' : 'Add want'}
            </Button>
          </div>
        </form>
      </Sheet>
    </div>
  );
};
