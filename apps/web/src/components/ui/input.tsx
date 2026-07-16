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
          'bg-surface-100/80 flex h-10 w-full rounded-xl border px-3.5 py-2 text-sm shadow-sm transition-all duration-200',
          'file:text-surface-700 dark:file:text-surface-300 file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'placeholder:text-surface-400 dark:placeholder:text-surface-500',
          'hover:border-surface-400/40 dark:hover:border-surface-500/40',
          'focus-visible:ring-brand-500/25 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2',
          'disabled:bg-surface-200/50 dark:disabled:bg-surface-800/50 disabled:cursor-not-allowed disabled:opacity-50',
          error
            ? 'border-error/50 focus-visible:ring-error/25 focus-visible:border-error'
            : 'border-surface-300/30 dark:border-surface-600/30',
          'dark:bg-surface-900/80 dark:text-surface-100',
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
