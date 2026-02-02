'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, TrendingUp } from 'lucide-react';

interface GoalProgressBarProps {
  currentValue: number;
  targetValue: number;
  unit?: string;
  className?: string;
  showIcon?: boolean;
}

export function GoalProgressBar({ currentValue, targetValue, unit, className, showIcon = true }: GoalProgressBarProps) {
  const percentage = targetValue > 0 ? Math.min((currentValue / targetValue) * 100, 100) : 0;
  const isComplete = percentage >= 100;
  const isOverTarget = currentValue > targetValue;
  
  // Enhanced color coding with gradients
  let progressGradient = '';
  let textColor = 'text-gray-400';
  let bgColor = 'bg-gray-500/10';
  let borderColor = 'border-gray-500/20';
  
  if (percentage === 0) {
    progressGradient = 'from-gray-500/30 to-gray-500/20';
    textColor = 'text-gray-400';
    bgColor = 'bg-gray-500/5';
    borderColor = 'border-gray-500/10';
  } else if (percentage < 25) {
    progressGradient = 'from-red-500/40 to-orange-500/30';
    textColor = 'text-orange-400';
    bgColor = 'bg-red-500/5';
    borderColor = 'border-red-500/20';
  } else if (percentage < 50) {
    progressGradient = 'from-yellow-500/40 to-orange-500/30';
    textColor = 'text-yellow-400';
    bgColor = 'bg-yellow-500/5';
    borderColor = 'border-yellow-500/20';
  } else if (percentage < 75) {
    progressGradient = 'from-blue-500/40 to-cyan-500/30';
    textColor = 'text-blue-400';
    bgColor = 'bg-blue-500/5';
    borderColor = 'border-blue-500/20';
  } else if (percentage < 100) {
    progressGradient = 'from-green-500/40 to-emerald-500/30';
    textColor = 'text-green-400';
    bgColor = 'bg-green-500/5';
    borderColor = 'border-green-500/20';
  } else {
    progressGradient = 'from-green-500/60 to-emerald-500/50';
    textColor = 'text-green-300';
    bgColor = 'bg-green-500/10';
    borderColor = 'border-green-500/30';
  }
  
  return (
    <div className={cn('space-y-2.5', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {showIcon && (
            <div className={cn(
              'flex items-center justify-center w-5 h-5 rounded-full transition-all',
              isComplete 
                ? 'bg-green-500/20 border border-green-500/40' 
                : 'bg-transparent'
            )}>
              {isComplete ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
              ) : (
                <TrendingUp className={cn('w-3.5 h-3.5', textColor)} />
              )}
            </div>
          )}
          <span className={cn('text-xs font-medium', textColor)}>
            {currentValue.toLocaleString()} {unit || ''} / {targetValue.toLocaleString()} {unit || ''}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {isOverTarget && (
            <span className="text-xs text-purple-400 font-medium">+{((currentValue - targetValue) / targetValue * 100).toFixed(0)}%</span>
          )}
          <span className={cn('text-xs font-bold tabular-nums', textColor)}>
            {Math.round(percentage)}%
          </span>
        </div>
      </div>
      
      {/* Enhanced progress bar with gradient */}
      <div className={cn(
        'h-3 w-full rounded-full overflow-hidden relative',
        bgColor,
        borderColor,
        'border'
      )}>
        {/* Background shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
        
        {/* Progress fill with gradient */}
        <div
          className={cn(
            'h-full transition-all duration-500 ease-out relative overflow-hidden',
            `bg-gradient-to-r ${progressGradient}`
          )}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        >
          {/* Animated shine effect */}
          {percentage > 0 && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shine" />
          )}
        </div>
        
        {/* Completion indicator */}
        {isComplete && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
}
