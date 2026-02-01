import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  accent?: 'purple' | 'orange' | 'blue' | boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', accent = false, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-notion font-medium transition-all duration-notion focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-background disabled:opacity-50 disabled:pointer-events-none';
    
    const getAccentStyles = () => {
      if (!accent) return '';
      if (accent === true) {
        // Default to purple if accent is true but no specific color
        return 'bg-violet-600 text-white hover:bg-violet-700 focus:ring-violet-500/40';
      }
      const accentMap = {
        purple: 'bg-violet-600 text-white hover:bg-violet-700 focus:ring-violet-500/40',
        orange: 'bg-orange-600 text-white hover:bg-orange-700 focus:ring-orange-500/40',
        blue: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500/40',
      };
      return accentMap[accent] || '';
    };
    
    const variants = {
      primary: accent ? getAccentStyles() : 'bg-gray-700 text-white hover:bg-gray-600 focus:ring-gray-500/40',
      secondary: 'bg-background-card border border-border-subtle text-gray-300 hover:bg-background-hover hover:border-border focus:ring-gray-500/40',
      ghost: 'text-gray-400 hover:text-gray-200 hover:bg-background-hover focus:ring-gray-500/40',
    };
    
    const sizes = {
      sm: 'h-7 px-2.5 text-xs',
      md: 'h-8 px-3 text-sm',
      lg: 'h-9 px-4 text-sm',
    };
    
    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
