import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  raised?: boolean;
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({
  raised = false,
  interactive = false,
  className = '',
  children,
  ...rest
}) => {
  return (
    <div
      className={`rounded-2xl border border-border ${
        raised ? 'bg-surface-raised' : 'bg-surface'
      } ${
        interactive
          ? 'transition-transform duration-150 hover:-translate-y-0.5 hover:border-brass/50'
          : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
};
