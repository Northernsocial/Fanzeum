import React, { useEffect, useState } from 'react';
import { Bookmark, BookmarkCheck, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  addPieceToWantlist,
  fetchItemSignalCounts,
  fetchUserItemSignals,
  toggleItemSignal,
} from '../lib/interactionRepo';
import type { CollectibleItemRecord } from '../types/domain';

interface ItemSignalButtonsProps {
  item: CollectibleItemRecord;
  compact?: boolean;
}

export const ItemSignalButtons: React.FC<ItemSignalButtonsProps> = ({ item, compact = false }) => {
  const { firebaseUser, openAuthModal } = useAuth();
  const uid = firebaseUser?.uid || 'guest_user';
  const isVerified = Boolean(firebaseUser?.emailVerified);

  const [hasGot, setHasGot] = useState(false);
  const [hasWant, setHasWant] = useState(false);
  const [gotCount, setGotCount] = useState(0);
  const [wantCount, setWantCount] = useState(0);
  const [wantToast, setWantToast] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchItemSignalCounts(item.id),
      fetchUserItemSignals(uid, [item.id]),
    ]).then(([counts, userSignals]) => {
      if (!active) return;
      setGotCount(counts.gotCount);
      setWantCount(counts.wantCount);
      const userState = userSignals[item.id];
      if (userState) {
        setHasGot(userState.hasGot);
        setHasWant(userState.hasWant);
      }
    });
    return () => {
      active = false;
    };
  }, [item.id, uid]);

  const handleToggleGot = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!firebaseUser) {
      openAuthModal();
      return;
    }

    if (busy) return;
    setBusy(true);

    const nextState = !hasGot;
    setHasGot(nextState);
    setGotCount((prev) => Math.max(0, prev + (nextState ? 1 : -1)));

    try {
      await toggleItemSignal({
        itemId: item.id,
        userId: uid,
        signalType: 'got',
        isVerifiedUser: isVerified,
      });
    } catch {
      // Revert on failure
      setHasGot(!nextState);
      setGotCount((prev) => Math.max(0, prev + (nextState ? -1 : 1)));
    } finally {
      setBusy(false);
    }
  };

  const handleToggleWant = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!firebaseUser) {
      openAuthModal();
      return;
    }

    if (busy) return;
    setBusy(true);

    const nextState = !hasWant;
    setHasWant(nextState);
    setWantCount((prev) => Math.max(0, prev + (nextState ? 1 : -1)));

    try {
      await toggleItemSignal({
        itemId: item.id,
        userId: uid,
        signalType: 'want',
        isVerifiedUser: isVerified,
      });

      // If user activated "want one", also add the piece to their Wantlist automatically
      if (nextState) {
        await addPieceToWantlist({
          item,
          userId: uid,
          isVerifiedUser: isVerified,
        });
        setWantToast(true);
        setTimeout(() => setWantToast(false), 2400);
      }
    } catch {
      setHasWant(!nextState);
      setWantCount((prev) => Math.max(0, prev + (nextState ? -1 : 1)));
    } finally {
      setBusy(false);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-mono">
        <button
          type="button"
          onClick={handleToggleGot}
          title={hasGot ? "I've got this piece" : "I've got one"}
          className={`min-h-[30px] px-2 py-0.5 rounded-lg border transition-colors inline-flex items-center gap-1 cursor-pointer ${
            hasGot
              ? 'bg-ok/15 border-ok text-ok font-semibold'
              : 'bg-surface border-border text-muted hover:text-ink hover:border-brass/40'
          }`}
        >
          <CheckCircle2 className="w-3 h-3" strokeWidth={1.5} />
          <span>Got {gotCount > 0 ? gotCount : ''}</span>
        </button>

        <button
          type="button"
          onClick={handleToggleWant}
          title={hasWant ? 'In your wantlist' : 'I want one (adds to wantlist)'}
          className={`min-h-[30px] px-2 py-0.5 rounded-lg border transition-colors inline-flex items-center gap-1 cursor-pointer ${
            hasWant
              ? 'bg-brass/20 border-brass text-brass font-semibold'
              : 'bg-surface border-border text-muted hover:text-ink hover:border-brass/40'
          }`}
        >
          {hasWant ? (
            <BookmarkCheck className="w-3 h-3 text-brass" strokeWidth={1.5} />
          ) : (
            <Bookmark className="w-3 h-3" strokeWidth={1.5} />
          )}
          <span>Want {wantCount > 0 ? wantCount : ''}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleToggleGot}
          className={`min-h-[40px] px-3.5 py-1.5 rounded-xl border text-xs sm:text-sm font-medium transition-colors inline-flex items-center gap-2 cursor-pointer ${
            hasGot
              ? 'bg-ok/15 border-ok text-ok font-semibold shadow-sm'
              : 'bg-surface border-border text-muted hover:text-ink hover:border-brass/50'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" strokeWidth={1.5} />
          <span>I&apos;ve got one</span>
          <span className="font-mono text-xs opacity-75">({gotCount})</span>
        </button>

        <button
          type="button"
          onClick={handleToggleWant}
          className={`min-h-[40px] px-3.5 py-1.5 rounded-xl border text-xs sm:text-sm font-medium transition-colors inline-flex items-center gap-2 cursor-pointer ${
            hasWant
              ? 'bg-brass/20 border-brass text-brass font-semibold shadow-sm'
              : 'bg-surface border-border text-muted hover:text-ink hover:border-brass/50'
          }`}
        >
          {hasWant ? (
            <BookmarkCheck className="w-4 h-4 text-brass" strokeWidth={1.5} />
          ) : (
            <Bookmark className="w-4 h-4" strokeWidth={1.5} />
          )}
          <span>I want one</span>
          <span className="font-mono text-xs opacity-75">({wantCount})</span>
        </button>
      </div>

      {wantToast && (
        <p className="text-xs font-mono text-brass animate-in fade-in slide-in-from-top-1">
          ✓ Added to your Wantlist!
        </p>
      )}
    </div>
  );
};
