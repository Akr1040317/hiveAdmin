import React from 'react';
import { cn } from '@/lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  accent?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, accent = false, children, ...props }, ref) => {
    return (
      <select
        className={cn(
          'flex h-10 w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-gray-100',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background',
          accent
            ? 'focus:ring-violet-500/40 focus:border-violet-500/30'
            : 'focus:ring-gray-500/40 focus:border-gray-500/30',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = 'Select';
