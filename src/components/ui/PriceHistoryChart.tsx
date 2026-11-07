import React from 'react';
import { formatGbp } from '../../lib/entitlements';
import type { PriceHistoryEntry } from '../../types/domain';

interface PriceHistoryChartProps {
  entries: PriceHistoryEntry[];
  title?: string;
  height?: number;
  showValuationOnly?: boolean;
  className?: string;
}

export const PriceHistoryChart: React.FC<PriceHistoryChartProps> = ({
  entries,
  title = 'Price History',
  height = 180,
  showValuationOnly = false,
  className = '',
}) => {
  const filtered = showValuationOnly
    ? entries.filter((e) => e.source === 'valuation')
    : entries;

  if (filtered.length === 0) {
    return (
      <div className={`rounded-xl border border-border bg-surface p-6 text-center ${className}`}>
        <p className="text-sm text-muted">No price history yet</p>
        <p className="text-xs text-muted/70 mt-1">Estimates appear after AI valuations or sales</p>
      </div>
    );
  }

  const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date));
  const prices = sorted.map((e) => e.priceGbp);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice || 1;
  const padding = Math.max(range * 0.1, 5);
  const chartMin = Math.max(0, minPrice - padding);
  const chartMax = maxPrice + padding;
  const chartRange = chartMax - chartMin;

  const width = 100;
  const stepX = width / (sorted.length - 1 || 1);

  const points = sorted.map((entry, i) => {
    const x = i * stepX;
    const y = 100 - ((entry.priceGbp - chartMin) / chartRange) * 100;
    return { x, y, entry };
  });

  const pathData = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');

  const latest = sorted[sorted.length - 1];
  const earliest = sorted[0];
  const change = latest.priceGbp - earliest.priceGbp;
  const changePct = earliest.priceGbp > 0 ? Math.round((change / earliest.priceGbp) * 100) : 0;

  return (
    <div className={`rounded-xl border border-border bg-surface p-4 ${className}`} style={{ height }}>
      {title && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-ink">{title}</h3>
          <span className="text-xs font-mono text-muted">Estimates, not guarantees</span>
        </div>
      )}

      <div className="relative h-full" style={{ minHeight: height - 60 }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full" aria-hidden="true">
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brass)" stopOpacity="0.15" />
              <stop offset="100%" stopColor="var(--color-brass)" stopOpacity="0" />
            </linearGradient>
          </defs>

          <path
            d={`M 0 100 ${pathData} L 100 100 Z`}
            fill="url(#priceGradient)"
            stroke="none"
          />
          <path
            d={pathData}
            stroke="var(--color-brass)"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="2.5"
              fill="var(--color-brass)"
              stroke="var(--color-surface)"
              strokeWidth="1.5"
            />
          ))}
        </svg>

        <div className="absolute inset-0 flex items-end justify-between px-1 pb-1 pointer-events-none">
          <div className="text-[10px] font-mono text-muted" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
            {formatGbp(chartMax)}
          </div>
          <div className="text-[10px] font-mono text-muted" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
            {formatGbp(chartMin)}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 pointer-events-none">
          {sorted.length > 1 && (
            <>
              <span className="text-[10px] font-mono text-muted" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                {earliest.date.slice(5)}
              </span>
              <span className="text-[10px] font-mono text-muted" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                {latest.date.slice(5)}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-ink">{formatGbp(latest.priceGbp)}</span>
          <span
            className={`text-xs font-mono px-1.5 py-0.5 rounded ${
              change > 0 ? 'text-ok bg-ok/10' : change < 0 ? 'text-danger bg-danger/10' : 'text-muted bg-surface-raised'
            }`}
          >
            {change > 0 ? '+' : ''}{changePct}% ({change > 0 ? '+' : ''}{formatGbp(change)})
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-brass" />
            Valuation
          </span>
          {!showValuationOnly && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-ok" />
              Sale
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
