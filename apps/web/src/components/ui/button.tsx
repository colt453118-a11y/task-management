import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-50 disabled:pointer-events-none disabled:opacity-50 select-none relative overflow-hidden',
  {
    variants: {
      variant: {
        default:
          'btn-shine bg-gradient-to-br from-brand-400 to-brand-500 text-white shadow-lg shadow-brand-500/30 ring-1 ring-inset ring-white/15 hover:to-brand-600 hover:shadow-xl hover:shadow-brand-500/45 active:brightness-95 active:scale-[0.97]',
        destructive:
          'bg-error text-white shadow-md shadow-error/25 hover:shadow-lg hover:shadow-error/35 hover:brightness-110 active:brightness-95 active:scale-[0.97]',
        outline:
          'border border-surface-500/35 bg-transparent text-surface-800 hover:bg-brand-500/10 hover:text-surface-900 hover:border-brand-500/40 active:scale-[0.97]',
        secondary:
          'bg-surface-200/80 text-surface-800 shadow-sm hover:bg-surface-300/80 hover:text-surface-900 active:scale-[0.97]',
        ghost:
          'text-surface-700 hover:bg-surface-200/60 hover:text-surface-900 active:bg-surface-200/80',
        link: 'text-brand-500 underline-offset-4 hover:underline hover:text-brand-600',
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
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
