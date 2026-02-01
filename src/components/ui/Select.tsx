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
          'flex h-8 w-full rounded-notion border border-border-subtle bg-background-card px-2.5 py-1.5 text-sm text-gray-100',
          'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-background transition-all duration-notion',
          accent
            ? 'focus:ring-violet-500/40 focus:border-violet-500/30'
            : 'focus:ring-gray-500/40 focus:border-border',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'hover:border-border',
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
