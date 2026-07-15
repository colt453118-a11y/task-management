import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-50 disabled:pointer-events-none disabled:opacity-50 select-none',
  {
    variants: {
      variant: {
        default:
          'bg-brand-500 text-white shadow-sm hover:bg-brand-400 active:bg-brand-600 active:scale-[0.97]',
        destructive:
          'bg-error text-white shadow-sm hover:bg-red-400 active:bg-red-600 active:scale-[0.97]',
        outline:
          'border border-surface-300/40 bg-transparent text-surface-700 hover:bg-surface-200/50 hover:text-surface-900 active:bg-surface-300/30 dark:text-surface-300 dark:hover:bg-surface-300/20 dark:hover:text-surface-100',
        secondary:
          'bg-surface-200/70 text-surface-700 hover:bg-surface-300/50 hover:text-surface-900 active:bg-surface-300/70 dark:bg-surface-800 dark:text-surface-300 dark:hover:bg-surface-700 dark:hover:text-surface-100',
        ghost:
          'text-surface-600 hover:bg-surface-200/50 hover:text-surface-900 active:bg-surface-300/30 dark:text-surface-400 dark:hover:bg-surface-300/20 dark:hover:text-surface-100',
        link:
          'text-brand-500 underline-offset-4 hover:underline hover:text-brand-400',
      },
      size: {
        default: 'h-9 px-4 py-2 rounded-xl',
        sm: 'h-8 rounded-lg px-3 text-xs',
        lg: 'h-10 rounded-xl px-8',
        xl: 'h-12 rounded-2xl px-10 text-base',
        icon: 'h-9 w-9 rounded-xl',
        'icon-sm': 'h-8 w-8 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
