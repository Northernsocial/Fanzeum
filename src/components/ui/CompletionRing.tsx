import React from 'react';

interface CompletionRingProps {
  current: number;
  target: number;
  size?: number;
}

export const CompletionRing: React.FC<CompletionRingProps> = ({
  current,
  target,
  size = 52,
}) => {
  if (target <= 0) return null;

  const pct = Math.min(100, Math.round((current / target) * 100));
  const strokeWidth = 4;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (pct / 100) * circumference;

  return (
    <div className="inline-flex items-center gap-3">
      <div className="relative inline-flex items-center justify-center shrink-0">
        <svg width={size} height={size} className="-rotate-90 block">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            className="stroke-border"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            className={pct >= 100 ? 'stroke-ok' : 'stroke-brass'}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute text-xs font-mono font-medium tabular-nums text-ink">
          {pct}%
        </span>
      </div>
      <div className="text-left">
        <div className="text-sm font-mono tabular-nums text-ink">
          {current} / {target} pieces
        </div>
        <div className="text-xs text-muted">
          {pct >= 100 ? 'Complete set' : `${Math.max(0, target - current)} left to finish`}
        </div>
      </div>
    </div>
  );
};
