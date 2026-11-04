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
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { formatGbp } from '../../lib/entitlements';
import {
  fetchUserSwaps,
  createSwapProposal,
  updateSwapStatus,
  listOwnerItems,
} from '../../lib/firestoreRepo';
import type { CollectibleItemRecord, SwapRecord } from '../../types/domain';
import { useDocumentMeta } from '../../components/DocumentMeta';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CollectorImage } from '../../components/ui/CollectorImage';
import { EmptyState, Skeleton } from '../../components/ui/EmptyState';
import { Sheet } from '../../components/ui/Sheet';
import { Tabs } from '../../components/ui/Tabs';

export const SwapsHubPage: React.FC = () => {
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();
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

  const loadData = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const [allSwaps, itms] = await Promise.all([
        fetchUserSwaps(uid),
        listOwnerItems(uid, 100),
      ]);
      setSwaps(allSwaps);
      setMyItems(itms);
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

  const handleAction = async (swapId: string, action: 'accept' | 'ship' | 'complete' | 'decline' | 'cancel') => {
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

    await updateSwapStatus({
      swapId,
      status: newStatus,
      proposerConfirmed: pConf,
      recipientConfirmed: rConf,
    });
    await loadData();
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
            return (
              <Card key={swap.swapId} raised className="p-6 space-y-4">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-brass capitalize">Trade Status: {swap.status}</span>
                  <span className="text-muted">With @{peerHandle}</span>
                </div>

                <div className="grid grid-cols-2 gap-4 py-2 border-y border-border text-sm">
                  <div>
                    <span className="text-xs text-muted block mb-1">You offer</span>
                    <span className="font-mono font-medium">{swap.proposerItemIds.length} pieces</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted block mb-1">They offer</span>
                    <span className="font-mono font-medium">{swap.recipientItemIds.length} pieces</span>
                  </div>
                </div>

                {swap.cashTopUpGbp > 0 && (
                  <div className="text-xs font-mono text-brass">
                    Cash top-up: {formatGbp(swap.cashTopUpGbp)} paid by {swap.cashPayer}
                  </div>
                )}

                {swap.note && <p className="text-xs text-muted italic">&ldquo;{swap.note}&rdquo;</p>}

                <div className="pt-2 flex items-center justify-end gap-2">
                  {swap.status === 'proposed' && !isProposer && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => void handleAction(swap.swapId, 'decline')}>
                        Decline
                      </Button>
                      <Button size="sm" onClick={() => void handleAction(swap.swapId, 'accept')}>
                        Accept trade
                      </Button>
                    </>
                  )}
                  {swap.status === 'accepted' && (
                    <Button size="sm" onClick={() => void handleAction(swap.swapId, 'ship')}>
                      Mark shipped
                    </Button>
                  )}
                  {swap.status === 'shipped' && (
                    <Button size="sm" onClick={() => void handleAction(swap.swapId, 'complete')}>
                      Confirm received &amp; complete
                    </Button>
                  )}
                  {swap.status === 'proposed' && isProposer && (
                    <Button size="sm" variant="ghost" onClick={() => void handleAction(swap.swapId, 'cancel')}>
                      Cancel proposal
                    </Button>
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
    </div>
  );
};
