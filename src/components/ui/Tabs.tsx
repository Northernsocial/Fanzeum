import React from 'react';

export interface TabOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps<T extends string> {
  options: TabOption<T>[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel?: string;
}

export function Tabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel = 'View options',
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 p-1 rounded-xl bg-surface-raised border border-border overflow-x-auto max-w-full"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-sm font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              active
                ? 'bg-brass text-brass-fg'
                : 'text-muted hover:text-ink'
            }`}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
