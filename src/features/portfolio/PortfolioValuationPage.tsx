import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  PieChart,
  Bell,
  ArrowUpRight,
  FileText,
  Calendar,
  Sparkles,
  Info,
} from 'lucide-react';
import { CATEGORIES, type CategorySlug } from '../../config/categories';
import { useAuth } from '../../contexts/AuthContext';
import { formatGbp } from '../../lib/entitlements';
import {
  listOwnerCollections,
  listOwnerItems,
  fetchUserValuationSnapshots,
  recordValuationSnapshot,
  fetchUserPriceAlerts,
  createPriceAlert,
  deletePriceAlert,
  fetchUserWeeklyDigest,
} from '../../lib/firestoreRepo';
import { fetchItemPrivateRecord } from '../../lib/firestoreRepo';
import type {
  CollectibleItemRecord,
  CollectionRecord,
  PriceAlertRecord,
  ValuationSnapshotRecord,
  WeeklyDigestRecord,
} from '../../types/domain';
import { useDocumentMeta } from '../../components/DocumentMeta';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CollectorImage } from '../../components/ui/CollectorImage';
import { EmptyState, Skeleton } from '../../components/ui/EmptyState';
import { Sheet } from '../../components/ui/Sheet';

export const PortfolioValuationPage: React.FC = () => {
  const navigate = useNavigate();
  const { firebaseUser, profile } = useAuth();
  const uid = firebaseUser?.uid;

  useDocumentMeta({
    title: 'Portfolio Valuation & ROI · Fanzeum',
    description: 'Track your showcase total value over time, gain/loss vs price paid, category splits, and price alerts.',
  });

  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [items, setItems] = useState<CollectibleItemRecord[]>([]);
  const [snapshots, setSnapshots] = useState<ValuationSnapshotRecord[]>([]);
  const [pricePaidMap, setPricePaidMap] = useState<Record<string, number>>({});
  const [alerts, setAlerts] = useState<PriceAlertRecord[]>([]);
  const [digest, setDigest] = useState<WeeklyDigestRecord | null>(null);

  // New alert sheet
  const [alertOpen, setAlertOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [thresholdType, setThresholdType] = useState<'below_price' | 'gain_loss_pct'>('gain_loss_pct');
  const [thresholdVal, setThresholdVal] = useState('15');
  const [savingAlert, setSavingAlert] = useState(false);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }
    const currentUid: string = uid;
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const [cols, itms, snaps, alts, weekly] = await Promise.all([
          listOwnerCollections(currentUid, currentUid, 50),
          listOwnerItems(currentUid, 150),
          fetchUserValuationSnapshots(currentUid),
          fetchUserPriceAlerts(currentUid),
          fetchUserWeeklyDigest(currentUid),
        ]);
        if (!active) return;
        setCollections(cols);
        setItems(itms);
        setSnapshots(snaps);
        setAlerts(alts);
        setDigest(weekly);

        // Fetch private price paid for items
        const priceMap: Record<string, number> = {};
        for (const item of itms) {
          const priv = await fetchItemPrivateRecord(currentUid, item.id);
          if (priv && priv.acquiredPriceGbp > 0) {
            priceMap[item.id] = priv.acquiredPriceGbp;
          }
        }
        if (active) setPricePaidMap(priceMap);

        // Record today snapshot if not present
        const minTot = itms.reduce((s, i) => s + (i.valueMinGbp || 0), 0);
        const maxTot = itms.reduce((s, i) => s + (i.valueMaxGbp || 0), 0);
        await recordValuationSnapshot({
          uid: currentUid,
          totalMinGbp: minTot,
          totalMaxGbp: maxTot,
          itemsCount: itms.length,
        });
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [uid]);

  const totals = React.useMemo(() => {
    const minVal = items.reduce((s, i) => s + (i.valueMinGbp || 0), 0);
    const maxVal = items.reduce((s, i) => s + (i.valueMaxGbp || 0), 0);
    const totalPaid = Object.values(pricePaidMap).reduce((s, p) => s + p, 0);
    const gainLoss = maxVal - totalPaid;
    const gainLossPct = totalPaid > 0 ? Math.round((gainLoss / totalPaid) * 100) : 0;
    return { minVal, maxVal, totalPaid, gainLoss, gainLossPct };
  }, [items, pricePaidMap]);

  const categoryBreakdown = React.useMemo(() => {
    const map: Record<CategorySlug, { count: number; value: number }> = {} as any;
    items.forEach((i) => {
      if (!map[i.category]) map[i.category] = { count: 0, value: 0 };
      map[i.category].count += 1;
      map[i.category].value += i.valueMaxGbp || 0;
    });
    return Object.entries(map).map(([cat, data]) => ({
      category: cat as CategorySlug,
      ...data,
    })).sort((a, b) => b.value - a.value);
  }, [items]);

  const topRisers = React.useMemo(() => {
    const scored = items.map((i) => {
      const paid = pricePaidMap[i.id] || (i.valueMaxGbp * 0.7);
      const delta = (i.valueMaxGbp || 0) - paid;
      return { item: i, paid, delta };
    });
    scored.sort((a, b) => b.delta - a.delta);
    return scored.slice(0, 5);
  }, [items, pricePaidMap]);

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || !selectedItemId) return;
    const targetItem = items.find((i) => i.id === selectedItemId);
    if (!targetItem) return;

    setSavingAlert(true);
    try {
      const created = await createPriceAlert({
        uid,
        targetType: 'item',
        targetId: targetItem.id,
        title: targetItem.title,
        thresholdType,
        thresholdValue: Number(thresholdVal) || 15,
      });
      setAlerts((prev) => [...prev, created]);
      setAlertOpen(false);
    } finally {
      setSavingAlert(false);
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.alertId !== alertId));
    await deletePriceAlert(alertId);
  };

  if (!firebaseUser) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-16 text-center space-y-4">
        <h1 className="text-2xl font-display font-semibold text-ink">Sign in to view your Portfolio</h1>
        <p className="text-sm text-muted">Track estimated totals, gain/loss vs price paid, and price alerts.</p>
        <Button onClick={() => navigate('/showcase')}>Sign in</Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12 space-y-8">
        <Skeleton className="h-40" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12 pb-28 space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-mono text-brass">
            <TrendingUp className="w-4 h-4" strokeWidth={1.5} />
            <span>Showcase Valuation &amp; ROI</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-semibold text-ink mt-1">
            Portfolio &amp; Price Alerts
          </h1>
          <p className="text-base text-muted mt-1 max-w-2xl">
            AI expert valuation estimates based on comparable recent UK market sales. All figures are estimates, never authentication.
          </p>
        </div>

        <Button onClick={() => setAlertOpen(true)}>
          <Bell className="w-4 h-4" />
          <span>Set price alert</span>
        </Button>
      </div>

      {/* Main KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card raised className="p-6 space-y-1">
          <div className="text-xs text-muted">Estimated Showcase Value</div>
          <div className="text-2xl font-mono font-semibold text-brass">
            {formatGbp(totals.minVal)} – {formatGbp(totals.maxVal)}
          </div>
          <div className="text-xs text-muted pt-1">Across {items.length} catalogued pieces</div>
        </Card>

        <Card raised className="p-6 space-y-1">
          <div className="text-xs text-muted">Total Price Paid (Acquired)</div>
          <div className="text-2xl font-mono font-semibold text-ink">
            {formatGbp(totals.totalPaid)}
          </div>
          <div className="text-xs text-muted pt-1">Recorded via private acquisition notes</div>
        </Card>

        <Card raised className="p-6 space-y-1">
          <div className="text-xs text-muted">Estimated Gain / Loss</div>
          <div className={`text-2xl font-mono font-semibold flex items-center gap-1.5 ${totals.gainLoss >= 0 ? 'text-ok' : 'text-danger'}`}>
            {totals.gainLoss >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            <span>{totals.gainLoss >= 0 ? '+' : ''}{formatGbp(totals.gainLoss)} ({totals.gainLossPct}%)</span>
          </div>
          <div className="text-xs text-muted pt-1">vs recorded price paid</div>
        </Card>

        <Card raised className="p-6 space-y-1">
          <div className="text-xs text-muted">Active Price Alerts</div>
          <div className="text-2xl font-mono font-semibold text-ink">{alerts.length}</div>
          <div className="text-xs text-muted pt-1">Watching market &amp; target prices</div>
        </Card>
      </div>

      {/* Weekly Digest Banner */}
      {digest && (
        <Card raised className="p-6 sm:p-8 bg-surface-raised border-brass/40 relative overflow-hidden space-y-4">
          <div className="absolute top-0 right-0 p-8 text-brass/10 pointer-events-none">
            <Sparkles className="w-24 h-24" />
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-brass">
            <Calendar className="w-4 h-4" />
            <span>{digest.weekLabel}</span>
          </div>
          <h2 className="text-2xl font-display font-semibold text-ink">Your collection this week</h2>
          <p className="text-base text-ink/90 leading-relaxed max-w-3xl">{digest.summaryText}</p>
          <div className="flex flex-wrap items-center gap-6 pt-2 text-sm font-mono">
            <div>
              <span className="text-muted">New pieces:</span> <span className="text-ink font-semibold">+{digest.newPiecesCount}</span>
            </div>
            <div>
              <span className="text-muted">Valuation movement:</span> <span className="text-brass font-semibold">+{formatGbp(digest.valuationDeltaGbp)}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Grid: Category Split & Top Risers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Category Split */}
        <Card raised className="p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-display font-semibold text-ink flex items-center gap-2">
              <PieChart className="w-5 h-5 text-brass" />
              <span>Category Value Split</span>
            </h3>
            <span className="text-xs font-mono text-muted">Estimated Market Share</span>
          </div>

          <div className="space-y-4">
            {categoryBreakdown.map((row) => {
              const catConfig = CATEGORIES[row.category];
              const pct = totals.maxVal > 0 ? Math.round((row.value / totals.maxVal) * 100) : 0;
              return (
                <div key={row.category} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-ink flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-brass" />
                      {catConfig?.shortLabel || row.category} ({row.count} {row.count === 1 ? 'piece' : 'pieces'})
                    </span>
                    <span className="font-mono font-semibold text-brass">{formatGbp(row.value)} ({pct}%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-surface-raised overflow-hidden">
                    <div className="h-full bg-brass rounded-full" style={{ width: `${Math.max(4, pct)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Top Risers & Gainers */}
        <Card raised className="p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-display font-semibold text-ink flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brass" />
              <span>Top Estimated Gainers</span>
            </h3>
            <span className="text-xs font-mono text-muted">vs Acquisition Paid</span>
          </div>

          <div className="space-y-3">
            {topRisers.map(({ item, paid, delta }) => (
              <div
                key={item.id}
                onClick={() => navigate(`/i/${item.id}`)}
                className="p-3.5 rounded-xl border border-border bg-surface hover:border-brass/50 transition-colors flex items-center justify-between gap-4 cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <CollectorImage
                    src={item.thumbUrl || item.imageUrl}
                    alt={item.title}
                    className="w-12 h-12 rounded-lg border border-border shrink-0 bg-surface-raised"
                    imgClassName="w-full h-full object-cover rounded-lg"
                  />
                  <div className="min-w-0">
                    <h4 className="font-display font-medium text-ink truncate text-sm">{item.title}</h4>
                    <p className="text-xs text-muted font-mono">Paid: {formatGbp(paid)}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-mono font-semibold text-ok">+{formatGbp(delta)}</div>
                  <div className="text-xs font-mono text-brass">{formatGbp(item.valueMaxGbp)} Est.</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Active Price Alerts */}
      <Card raised className="p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-display font-semibold text-ink flex items-center gap-2">
            <Bell className="w-5 h-5 text-brass" />
            <span>Price &amp; Valuation Alerts</span>
          </h3>
          <Button variant="secondary" size="sm" onClick={() => setAlertOpen(true)}>
            Add alert
          </Button>
        </div>

        {alerts.length === 0 ? (
          <EmptyState
            icon={<Bell className="w-6 h-6" />}
            title="No price alerts set"
            description="Set alerts to be notified when comparable market values shift by more than 15% or when a wanted item drops below your budget."
            action={<Button onClick={() => setAlertOpen(true)}>Set first alert</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {alerts.map((alert) => (
              <div key={alert.alertId} className="p-4 rounded-xl border border-border bg-surface space-y-3">
                <div className="flex items-center justify-between text-xs text-muted font-mono">
                  <span>{alert.thresholdType === 'below_price' ? 'Target Budget' : 'Movement Alert'}</span>
                  <button
                    type="button"
                    onClick={() => void handleDeleteAlert(alert.alertId)}
                    className="text-danger hover:underline cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
                <h4 className="font-display font-semibold text-ink">{alert.title}</h4>
                <div className="text-sm font-mono text-brass">
                  {alert.thresholdType === 'below_price' ? `Below ${formatGbp(alert.thresholdValue)}` : `> ${alert.thresholdValue}% shift`}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Set Alert Sheet */}
      <Sheet
        open={alertOpen}
        onClose={() => setAlertOpen(false)}
        title="Set Price Alert"
        subtitle="Get notified when showcase pieces or want items hit valuation thresholds."
      >
        <form onSubmit={handleCreateAlert} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Select Piece</label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              required
              className="w-full min-h-[44px] px-3.5 py-2 text-sm rounded-xl border border-border bg-bg text-ink"
            >
              <option value="">Choose item...</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title} ({formatGbp(i.valueMaxGbp)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Alert Trigger Type</label>
            <select
              value={thresholdType}
              onChange={(e) => setThresholdType(e.target.value as 'below_price' | 'gain_loss_pct')}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm rounded-xl border border-border bg-bg text-ink"
            >
              <option value="gain_loss_pct">Valuation shift percentage (&gt; X%)</option>
              <option value="below_price">Market price drops below (&lt; £X)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Threshold Value</label>
            <input
              type="number"
              min={1}
              required
              value={thresholdVal}
              onChange={(e) => setThresholdVal(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono rounded-xl border border-border bg-bg text-ink"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAlertOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={savingAlert || !selectedItemId}>
              {savingAlert ? 'Saving...' : 'Create alert'}
            </Button>
          </div>
        </form>
      </Sheet>
    </div>
  );
};
