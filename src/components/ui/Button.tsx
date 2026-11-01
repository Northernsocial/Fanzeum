import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  children,
  ...rest
}) => {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-brass text-brass-fg hover:opacity-90',
    secondary: 'bg-surface-raised text-ink border border-border hover:border-brass/60',
    ghost: 'bg-transparent text-muted hover:text-ink hover:bg-surface-raised',
    danger: 'bg-danger/15 text-danger border border-danger/40 hover:bg-danger/25',
  };

  const sizes: Record<ButtonSize, string> = {
    sm: 'min-h-[40px] px-3.5 py-2 text-sm',
    md: 'min-h-[44px] px-5 py-2.5 text-base',
    lg: 'min-h-[48px] px-6 py-3 text-base',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
};
