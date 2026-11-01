import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export const Sheet: React.FC<SheetProps> = ({
  open,
  onClose,
  title,
  subtitle,
  children,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-bg/80 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-surface border border-border p-6">
        <div className="w-10 h-1.5 rounded-full bg-border mx-auto mb-4 sm:hidden" />
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-border">
          <div>
            <h2 className="text-xl font-display font-semibold text-ink">{title}</h2>
            {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-muted hover:text-ink hover:bg-surface-raised transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>
        <div className="pt-5">{children}</div>
      </div>
    </div>
  );
};
