import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * FormField — a labelled form-control wrapper standardizing the app's field markup:
 * an uppercase hairline label (with optional required marker), the control, and an
 * optional hint or `role="alert"` error line. Wrap any input/select/textarea:
 *
 *   <FormField label="Name" htmlFor="name" required error={err}>
 *     <Input id="name" … />
 *   </FormField>
 */
export interface FormFieldProps {
  label?: React.ReactNode;
  /** Associates the label with the control (set the same id on the child). */
  htmlFor?: string;
  required?: boolean;
  /** Error message; rendered as a `role="alert"` line and hides the hint. */
  error?: React.ReactNode;
  /** Helper text shown under the control when there's no error. */
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function FormField({
  label,
  htmlFor,
  required,
  error,
  hint,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-surface-500 block text-xs font-semibold uppercase tracking-wider"
        >
          {label}
          {required && <span className="text-error ml-0.5">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-surface-500 text-xs">{hint}</p>}
      {error && (
        <p role="alert" className="text-error text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
