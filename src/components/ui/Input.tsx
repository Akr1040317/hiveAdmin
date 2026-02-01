import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  accent?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, accent = false, type = 'text', ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-8 w-full rounded-notion border border-border-subtle bg-background-card px-2.5 py-1.5 text-sm text-gray-100',
          'placeholder:text-gray-500',
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
      />
    );
  }
);

Input.displayName = 'Input';
