import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRightLeft,
  CheckCircle2,
  Package,
  Plus,
  ShieldCheck,
  Truck,
  UserCheck,
  XCircle,
  Star,
  Send,
  Undo,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { formatGbp } from '../../lib/entitlements';
import {
  fetchUserSwaps,
  createSwapProposal,
  updateSwapStatus,
  listOwnerItems,
} from '../../lib/firestoreRepo';
import {
  counterSwapProposal,
  submitTradeRating,
  fetchTradePartnersForUser,
} from '../../lib/tradeRepo';
import type {
  CollectibleItemRecord,
  SwapRecord,
  TradePartnerSuggestion,
  UserProfile,
} from '../../types/domain';
import { useDocumentMeta } from '../../components/DocumentMeta';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CollectorImage } from '../../components/ui/CollectorImage';
import { EmptyState, Skeleton } from '../../components/ui/EmptyState';
import { Sheet } from '../../components/ui/Sheet';
import { Tabs } from '../../components/ui/Tabs';
import { TradeRating } from '../../components/ui/TradeRating';

export const SwapsHubPage: React.FC = () => {
  const navigate = useNavigate();
  const { firebaseUser, profile } = useAuth();
  const uid = firebaseUser?.uid;
  const isVerified = Boolean(firebaseUser?.emailVerified);

  useDocumentMeta({
    title: 'Collector Swaps & Trades · Fanzeum',
    description: 'Propose and complete item-for-item trades with cash top-ups securely between showcases.',
  });

  const [loading, setLoading] = useState(true);
  const [swaps, setSwaps] = useState<SwapRecord[]>([]);
  const [myItems, setMyItems] = useState<CollectibleItemRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [suggestedPartners, setSuggestedPartners] = useState<TradePartnerSuggestion[]>([]);

  // Propose sheet
  const [proposeOpen, setProposeOpen] = useState(false);
  const [recipientHandle, setRecipientHandle] = useState('');
  const [selectedMyItemIds, setSelectedMyItemIds] = useState<string[]>([]);
  const [targetItemIdsStr, setTargetItemIdsStr] = useState('');
  const [cashTopUp, setCashTopUp] = useState('0');
  const [cashPayer, setCashPayer] = useState<'none' | 'proposer' | 'recipient'>('none');
  const [note, setNote] = useState('');
  const [proposing, setProposing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Counter sheet
  const [counterOpen, setCounterOpen] = useState(false);
  const [counterSwapId, setCounterSwapId] = useState<string | null>(null);
  const [counterItemIds, setCounterItemIds] = useState<string[]>([]);
  const [counterCashTopUp, setCounterCashTopUp] = useState('0');
  const [counterCashPayer, setCounterCashPayer] = useState<'none' | 'proposer' | 'recipient'>('none');
  const [counterNote, setCounterNote] = useState('');
  const [countering, setCountering] = useState(false);

  // Rating sheet
  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratingSwapId, setRatingSwapId] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingNote, setRatingNote] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  const loadData = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const [allSwaps, itms, partners] = await Promise.all([
        fetchUserSwaps(uid),
        listOwnerItems(uid, 100),
        fetchTradePartnersForUser({ userId: uid, maxResults: 6 }),
      ]);
      setSwaps(allSwaps);
      setMyItems(itms);
      setSuggestedPartners(partners);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [uid]);

  const handlePropose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || !firebaseUser || selectedMyItemIds.length === 0) return;
    setProposing(true);
    setErrorMsg(null);

    const targetIds = targetItemIdsStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      await createSwapProposal({
        proposerId: uid,
        proposerHandle: firebaseUser.displayName || 'collector',
        recipientHandle,
        proposerItemIds: selectedMyItemIds,
        recipientItemIds: targetIds.length > 0 ? targetIds : ['item_sample_placeholder'],
        cashTopUpGbp: Number(cashTopUp) || 0,
        cashPayer,
        note,
        isVerifiedUser: isVerified,
      });
      setProposeOpen(false);
      setRecipientHandle('');
      setSelectedMyItemIds([]);
      setTargetItemIdsStr('');
      setCashTopUp('0');
      setNote('');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not propose swap.');
    } finally {
      setProposing(false);
    }
  };

  const handleAction = async (swapId: string, action: 'accept' | 'ship' | 'complete' | 'decline' | 'cancel' | 'accept-counter' | 'decline-counter') => {
    let newStatus: SwapRecord['status'] = 'accepted';
    let pConf = false;
    let rConf = false;

    if (action === 'accept') newStatus = 'accepted';
    if (action === 'ship') newStatus = 'shipped';
    if (action === 'complete') {
      newStatus = 'completed';
      pConf = true;
      rConf = true;
    }
    if (action === 'decline') newStatus = 'declined';
    if (action === 'cancel') newStatus = 'cancelled';
    if (action === 'accept-counter') newStatus = 'accepted';
    if (action === 'decline-counter') newStatus = 'declined';

    await updateSwapStatus({
      swapId,
      status: newStatus,
      proposerConfirmed: pConf,
      recipientConfirmed: rConf,
    });
    await loadData();
  };

  const openCounterSheet = (swap: SwapRecord) => {
    setCounterSwapId(swap.swapId);
    setCounterItemIds([]);
    setCounterCashTopUp('0');
    setCounterCashPayer('none');
    setCounterNote('');
    setCounterOpen(true);
  };

  const handleCounterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || !counterSwapId || counterItemIds.length === 0) return;
    setCountering(true);
    try {
      await counterSwapProposal({
        swapId: counterSwapId,
        recipientId: uid,
        recipientItemIds: counterItemIds,
        cashTopUpGbp: Number(counterCashTopUp) || 0,
        cashPayer: counterCashPayer,
        note: counterNote,
        isVerifiedUser: isVerified,
      });
      setCounterOpen(false);
      setCounterSwapId(null);
      await loadData();
    } catch (err: any) {
      // Error handled by repo
    } finally {
      setCountering(false);
    }
  };

  const openRatingSheet = (swap: SwapRecord) => {
    setRatingSwapId(swap.swapId);
    setRatingValue(0);
    setRatingNote('');
    setRatingOpen(true);
  };

  const handleRatingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || !ratingSwapId || ratingValue === 0) return;
    setRatingSubmitting(true);
    try {
      await submitTradeRating({
        swapId: ratingSwapId,
        userId: uid,
        rating: ratingValue,
        note: ratingNote,
        isVerifiedUser: isVerified,
      });
      setRatingOpen(false);
      setRatingSwapId(null);
      await loadData();
    } catch (err: any) {
      // Error handled
    } finally {
      setRatingSubmitting(false);
    }
  };

  const filteredSwaps = swaps.filter((s) => {
    const isDone = s.status === 'completed' || s.status === 'declined' || s.status === 'cancelled';
    return activeTab === 'completed' ? isDone : !isDone;
  });

  if (!firebaseUser) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-16 text-center space-y-4">
        <h1 className="text-2xl font-display font-semibold text-ink">Sign in to use Collector Swaps</h1>
        <p className="text-sm text-muted">Propose item trades and cash top-ups securely between showcases.</p>
        <Button onClick={() => navigate('/showcase')}>Sign in</Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12 space-y-8">
        <Skeleton className="h-40" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12 pb-28 space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-mono text-brass">
            <ArrowRightLeft className="w-4 h-4" strokeWidth={1.5} />
            <span>Secure Showcase Trades</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-semibold text-ink mt-1">
            Collector Swaps Hub
          </h1>
          <p className="text-base text-muted mt-1 max-w-2xl">
            Propose item-for-item trades with optional cash top-ups. Both collectors confirm shipment and receipt to complete the trade.
          </p>
        </div>

        <Button onClick={() => setProposeOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>Propose trade</span>
        </Button>
      </div>

      {/* Suggested Trade Partners */}
      {suggestedPartners.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-mono text-brass">
            <UserCheck className="w-4 h-4" strokeWidth={1.5} />
            <span>Suggested trade partners</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {suggestedPartners.map((partner) => (
              <Card key={partner.user.uid} raised className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <CollectorImage
                    src={partner.user.avatarUrl}
                    alt={partner.user.displayName}
                    className="w-10 h-10 rounded-full"
                  />
                  <div className="min-w-0">
                    <div className="font-display font-medium text-ink truncate">
                      @{partner.user.handle}
                    </div>
                    <div className="text-xs text-muted">
                      {partner.user.displayName}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  {partner.reason}
                </p>
                <div className="flex items-center gap-2 text-[11px] font-mono text-brass">
                  <span>Score: {partner.score}</span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    setRecipientHandle(partner.user.handle);
                    setProposeOpen(true);
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Propose trade</span>
                </Button>
              </Card>
            ))}
          </div>
        </section>
      )}

      <Tabs
        ariaLabel="Swap tabs"
        value={activeTab}
        onChange={(t) => setActiveTab(t)}
        options={[
          { value: 'active', label: 'Active Trades' },
          { value: 'completed', label: 'Completed & History' },
        ]}
      />

      {filteredSwaps.length === 0 ? (
        <EmptyState
          icon={<ArrowRightLeft className="w-6 h-6" />}
          title={activeTab === 'active' ? 'No active trades' : 'No trade history'}
          description="Propose a trade with any collector by entering their @handle and selecting pieces from your showcase."
          action={<Button onClick={() => setProposeOpen(true)}>Propose trade</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredSwaps.map((swap) => {
            const isProposer = swap.proposerId === uid;
            const peerHandle = isProposer ? swap.recipientHandle : swap.proposerHandle;
            const peerRating = isProposer ? swap.recipientRating : swap.proposerRating;
            const myRating = isProposer ? swap.proposerRating : swap.recipientRating;
            const canRate = swap.status === 'completed' && myRating === undefined;
            return (
              <Card key={swap.swapId} raised className="p-6 space-y-4">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-brass capitalize">Trade Status: {swap.status}</span>
                  <span className="text-muted">With @{peerHandle}</span>
                </div>

                <div className="grid grid-cols-2 gap-4 py-2 border-y border-border text-sm">
                  <div>
                    <span className="text-xs text-muted block mb-1">You offer</span>
                    <span className="font-mono font-medium">
                      {isProposer ? swap.proposerItemIds.length : swap.recipientItemIds.length} pieces
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted block mb-1">They offer</span>
                    <span className="font-mono font-medium">
                      {isProposer ? swap.recipientItemIds.length : swap.proposerItemIds.length} pieces
                    </span>
                  </div>
                </div>

                {swap.cashTopUpGbp > 0 && (
                  <div className="text-xs font-mono text-brass">
                    Cash top-up: {formatGbp(swap.cashTopUpGbp)} paid by {swap.cashPayer}
                  </div>
                )}

                {swap.note && <p className="text-xs text-muted italic">&ldquo;{swap.note}&rdquo;</p>}

                {/* Counter proposal details */}
                {swap.status === 'countered' && (
                  <div className="p-3 rounded-xl bg-surface border border-border space-y-1.5">
                    <div className="text-xs font-mono text-brass">Counter proposal from @{peerHandle}</div>
                    <div className="text-sm">
                      They offer <span className="font-mono font-medium">{swap.recipientItemIds.length} pieces</span>
                      {swap.cashTopUpGbp > 0 && (
                        <> with cash top-up {formatGbp(swap.cashTopUpGbp)} paid by {swap.cashPayer}</>
                      )}
                    </div>
                    {swap.note && <p className="text-xs text-muted italic">&ldquo;{swap.note}&rdquo;</p>}
                  </div>
                )}

                {/* Rating display */}
                {swap.status === 'completed' && (
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted">Your rating:</span>
                      <TradeRating value={myRating} size="sm" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted">Their rating:</span>
                      <TradeRating value={peerRating} size="sm" />
                    </div>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-end gap-2 flex-wrap">
                  {/* Proposed state */}
                  {swap.status === 'proposed' && !isProposer && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleAction(swap.swapId, 'decline')}
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Decline</span>
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => void handleAction(swap.swapId, 'accept')}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Accept</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openCounterSheet(swap)}
                      >
                        <Undo className="w-4 h-4" />
                        <span>Counter</span>
                      </Button>
                    </>
                  )}
                  {swap.status === 'proposed' && isProposer && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleAction(swap.swapId, 'cancel')}
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Cancel proposal</span>
                    </Button>
                  )}

                  {/* Countered state */}
                  {swap.status === 'countered' && isProposer && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleAction(swap.swapId, 'decline-counter')}
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Decline</span>
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => void handleAction(swap.swapId, 'accept-counter')}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Accept counter</span>
                      </Button>
                    </>
                  )}
                  {swap.status === 'countered' && !isProposer && (
                    <span className="text-xs text-muted">Waiting for the other collector to respond to your counter.</span>
                  )}

                  {/* Accepted state */}
                  {swap.status === 'accepted' && (
                    <Button size="sm" onClick={() => void handleAction(swap.swapId, 'ship')}>
                      <Truck className="w-4 h-4" />
                      <span>Mark shipped</span>
                    </Button>
                  )}
                  {swap.status === 'accepted' && !isProposer && (
                    <span className="text-xs text-muted">Waiting for the other collector to ship.</span>
                  )}

                  {/* Shipped state */}
                  {swap.status === 'shipped' && (
                    <Button size="sm" onClick={() => void handleAction(swap.swapId, 'complete')}>
                      <Package className="w-4 h-4" />
                      <span>Confirm received &amp; complete</span>
                    </Button>
                  )}
                  {swap.status === 'shipped' && isProposer && (
                    <span className="text-xs text-muted">Waiting for the other collector to confirm receipt.</span>
                  )}

                  {/* Completed state - rating */}
                  {swap.status === 'completed' && canRate && (
                    <Button size="sm" variant="secondary" onClick={() => openRatingSheet(swap)}>
                      <Star className="w-4 h-4" />
                      <span>Rate trade</span>
                    </Button>
                  )}
                  {swap.status === 'completed' && myRating !== undefined && (
                    <span className="text-xs text-muted flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      You rated this trade
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Propose Sheet */}
      <Sheet
        open={proposeOpen}
        onClose={() => setProposeOpen(false)}
        title="Propose Collector Trade"
        subtitle="Offer pieces from your showcase in exchange for another collector's pieces."
      >
        <form onSubmit={handlePropose} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Recipient Collector @handle</label>
            <div className="flex items-center rounded-xl border border-border bg-bg px-3.5">
              <span className="text-muted font-mono">@</span>
              <input
                type="text"
                required
                value={recipientHandle}
                onChange={(e) => setRecipientHandle(e.target.value)}
                placeholder="collectorhandle"
                className="w-full min-h-[44px] pl-1 py-2 text-base font-mono bg-transparent text-ink focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Select pieces to offer from your showcase</label>
            <div className="max-h-44 overflow-y-auto space-y-2 border border-border rounded-xl p-3 bg-bg">
              {myItems.map((item) => {
                const checked = selectedMyItemIds.includes(item.id);
                return (
                  <label key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMyItemIds((prev) => [...prev, item.id]);
                        } else {
                          setSelectedMyItemIds((prev) => prev.filter((id) => id !== item.id));
                        }
                      }}
                      className="rounded border-border text-brass focus:ring-brass"
                    />
                    <span className="text-sm font-display font-medium text-ink truncate">{item.title}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Target piece ID(s) wanted (comma separated)</label>
            <input
              type="text"
              value={targetItemIdsStr}
              onChange={(e) => setTargetItemIdsStr(e.target.value)}
              placeholder="itm_123456"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono rounded-xl border border-border bg-bg text-ink"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Cash Top-Up (£)</label>
              <input
                type="number"
                min={0}
                value={cashTopUp}
                onChange={(e) => setCashTopUp(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono rounded-xl border border-border bg-bg text-ink"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Cash Payer</label>
              <select
                value={cashPayer}
                onChange={(e) => setCashPayer(e.target.value as any)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm rounded-xl border border-border bg-bg text-ink"
              >
                <option value="none">None</option>
                <option value="proposer">I will pay</option>
                <option value="recipient">They will pay</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Trade note / message</label>
            <textarea
              rows={2}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Interested in your rookie card for my vintage stamps..."
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-border bg-bg text-ink"
            />
          </div>

          {errorMsg && <p className="text-sm text-danger">{errorMsg}</p>}

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setProposeOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={proposing || selectedMyItemIds.length === 0}>
              {proposing ? 'Proposing...' : 'Send trade proposal'}
            </Button>
          </div>
        </form>
      </Sheet>

      {/* Counter Sheet */}
      <Sheet
        open={counterOpen}
        onClose={() => setCounterOpen(false)}
        title="Counter Trade Proposal"
        subtitle="Offer a different set of pieces to improve the trade."
      >
        <form onSubmit={handleCounterSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Select pieces to offer</label>
            <div className="max-h-44 overflow-y-auto space-y-2 border border-border rounded-xl p-3 bg-bg">
              {myItems.map((item) => {
                const checked = counterItemIds.includes(item.id);
                return (
                  <label key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setCounterItemIds((prev) => [...prev, item.id]);
                        } else {
                          setCounterItemIds((prev) => prev.filter((id) => id !== item.id));
                        }
                      }}
                      className="rounded border-border text-brass focus:ring-brass"
                    />
                    <span className="text-sm font-display font-medium text-ink truncate">{item.title}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Cash Top-Up (£)</label>
              <input
                type="number"
                min={0}
                value={counterCashTopUp}
                onChange={(e) => setCounterCashTopUp(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono rounded-xl border border-border bg-bg text-ink"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Cash Payer</label>
              <select
                value={counterCashPayer}
                onChange={(e) => setCounterCashPayer(e.target.value as any)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm rounded-xl border border-border bg-bg text-ink"
              >
                <option value="none">None</option>
                <option value="proposer">I will pay</option>
                <option value="recipient">They will pay</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Counter note</label>
            <textarea
              rows={2}
              maxLength={1000}
              value={counterNote}
              onChange={(e) => setCounterNote(e.target.value)}
              placeholder="e.g. How about my vintage stamp plus £20 for your rookie card?"
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-border bg-bg text-ink"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCounterOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={countering || counterItemIds.length === 0}>
              {countering ? 'Sending...' : 'Send counter'}
            </Button>
          </div>
        </form>
      </Sheet>

      {/* Rating Sheet */}
      <Sheet
        open={ratingOpen}
        onClose={() => setRatingOpen(false)}
        title="Rate your trade"
        subtitle="How was your experience with this collector?"
      >
        <form onSubmit={handleRatingSubmit} className="space-y-4">
          <div className="flex flex-col items-center py-2">
            <TradeRating value={ratingValue} onChange={setRatingValue} size="md" />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">
              Note (optional)
            </label>
            <textarea
              rows={3}
              maxLength={500}
              value={ratingNote}
              onChange={(e) => setRatingNote(e.target.value)}
              placeholder="Share a brief note about your trade experience..."
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-border bg-bg text-ink"
            />
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setRatingOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={ratingSubmitting || ratingValue === 0}>
              {ratingSubmitting ? 'Submitting...' : 'Submit rating'}
            </Button>
          </div>
        </form>
      </Sheet>
    </div>
  );
};
