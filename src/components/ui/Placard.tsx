import React from 'react';
import { Award } from 'lucide-react';
import { getItemPlacardParts } from '../../config/categories';
import { formatGbpRange } from '../../lib/entitlements';
import type { CollectibleItemRecord } from '../../types/domain';

interface PlacardProps {
  item: CollectibleItemRecord;
  hideValues?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const Placard: React.FC<PlacardProps> = ({
  item,
  hideValues = false,
  size = 'md',
}) => {
  const parts = getItemPlacardParts(item.category, item.attributes);
  const metaSegments = [
    parts.year || item.year,
    parts.maker || item.maker,
    parts.catNumber || item.setNumber,
    parts.condition || item.condition,
  ].filter(Boolean);

  const titleClasses =
    size === 'lg'
      ? 'text-2xl sm:text-3xl font-display font-semibold text-ink leading-tight'
      : size === 'sm'
        ? 'text-base font-display font-semibold text-ink leading-snug line-clamp-2'
        : 'text-lg font-display font-semibold text-ink leading-snug line-clamp-2';

  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <h3 className={titleClasses}>{item.title}</h3>
        {item.grail && (
          <span
            title="Grail piece"
            className="inline-flex items-center gap-1 text-xs font-mono text-brass shrink-0 pt-0.5"
          >
            <Award className="w-4 h-4" strokeWidth={1.5} />
            <span>Grail</span>
          </span>
        )}
      </div>

      {metaSegments.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
          {metaSegments.map((seg, idx) => (
            <React.Fragment key={`${seg}_${idx}`}>
              {idx > 0 && <span aria-hidden="true">·</span>}
              <span className={idx >= 2 ? 'font-mono' : ''}>{seg}</span>
            </React.Fragment>
          ))}
        </div>
      )}

      {!hideValues && (item.valueMinGbp > 0 || item.valueMaxGbp > 0) && (
        <div className="pt-0.5 text-sm font-mono tabular-nums text-brass font-medium">
          Worth around {formatGbpRange(item.valueMinGbp, item.valueMaxGbp)}
        </div>
      )}
    </div>
  );
};
