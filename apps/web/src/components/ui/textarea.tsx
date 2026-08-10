import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'bg-surface-300/60 text-surface-800 flex min-h-[80px] w-full rounded-xl border px-3.5 py-2.5 text-sm shadow-sm transition-all duration-200',
          'placeholder:text-surface-600',
          'hover:border-brand-500/35',
          'focus-visible:ring-brand-500/20 focus-visible:border-brand-500/60 focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:shadow-[0_0_12px_rgb(var(--brand-rgb)/0.12)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error
            ? 'border-error/50 focus-visible:ring-error/20 focus-visible:border-error/60'
            : 'border-surface-600/45',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };
