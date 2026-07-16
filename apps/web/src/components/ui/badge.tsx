import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2 focus:ring-offset-surface-50',
  {
    variants: {
      variant: {
        default: 'bg-surface-200/70 text-surface-600 dark:bg-surface-800 dark:text-surface-400',
        primary: 'bg-brand-500/10 text-brand-400 dark:bg-brand-500/15 dark:text-brand-300',
        success: 'bg-success/10 text-success dark:bg-success/15 dark:text-green-300',
        warning: 'bg-warning/10 text-warning dark:bg-warning/15 dark:text-yellow-300',
        danger: 'bg-error/10 text-error dark:bg-error/15 dark:text-red-300',
        info: 'bg-info/10 text-info dark:bg-info/15 dark:text-cyan-300',
      },
      size: {
        default: 'px-2.5 py-0.5 text-xs',
        sm: 'px-1.5 py-0 text-[10px]',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
