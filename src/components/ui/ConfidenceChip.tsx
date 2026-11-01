import React from 'react';
import { AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import type { AIConfidence } from '../../types/domain';

interface ConfidenceChipProps {
  confidence: AIConfidence;
  compact?: boolean;
}

export const ConfidenceChip: React.FC<ConfidenceChipProps> = ({
  confidence,
  compact = false,
}) => {
  if (confidence === 'manual') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-mono text-muted whitespace-nowrap">
        <span>Collector verified</span>
      </span>
    );
  }

  if (confidence === 'high') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-mono text-ok whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
        <span>{compact ? 'High' : 'Confident match'}</span>
      </span>
    );
  }

  if (confidence === 'medium') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-mono text-brass whitespace-nowrap">
        <HelpCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
        <span>{compact ? 'Medium' : 'Likely match'}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-mono text-warn whitespace-nowrap">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
      <span>{compact ? 'Check' : 'Double-check'}</span>
    </span>
  );
};
