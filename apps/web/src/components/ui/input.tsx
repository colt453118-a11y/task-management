import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-xl border px-3.5 py-2 text-sm shadow-sm transition-all duration-200',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'placeholder:text-surface-600',
          'hover:border-brand-500/35',
          'focus-visible:border-brand-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20',
          'focus-visible:shadow-[0_0_12px_rgba(99,102,241,0.08)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error
            ? 'border-error/50 focus-visible:ring-error/20 focus-visible:border-error/60'
            : 'border-surface-600/45',
          'bg-surface-300/60 text-surface-800 file:text-surface-800',
          'dark:bg-surface-300/40 dark:text-surface-800 dark:border-surface-600/40 dark:placeholder:text-surface-600 dark:file:text-surface-700',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
