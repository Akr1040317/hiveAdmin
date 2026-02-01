import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'error';
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-gray-700/50 text-gray-300 border-gray-600',
      accent: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
      success: 'bg-green-500/20 text-green-300 border-green-500/40',
      warning: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
      error: 'bg-red-500/20 text-red-300 border-red-500/40',
    };
    
    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';
