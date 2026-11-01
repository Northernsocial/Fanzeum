import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = 'h-6 w-full' }) => (
  <div className={`animate-pulse rounded-xl bg-surface-raised ${className}`} />
);

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => (
  <div className="rounded-2xl border border-border bg-surface p-8 sm:p-12 text-center max-w-xl mx-auto">
    {icon && (
      <div className="w-12 h-12 rounded-2xl bg-surface-raised border border-border text-brass flex items-center justify-center mx-auto mb-4">
        {icon}
      </div>
    )}
    <h3 className="text-xl font-display font-semibold text-ink">{title}</h3>
    <p className="text-base text-muted mt-2 leading-relaxed">{description}</p>
    {action && <div className="mt-6 flex justify-center">{action}</div>}
  </div>
);
