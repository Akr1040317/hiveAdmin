'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2 } from 'lucide-react';

interface CircularProgressProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  showIcon?: boolean;
  className?: string;
}

export function CircularProgress({ 
  percentage, 
  size = 48, 
  strokeWidth = 4,
  showIcon = true,
  className 
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;
  const normalizedPercentage = Math.min(Math.max(percentage, 0), 100);
  
  // Color based on percentage
  let strokeColor = '';
  let bgColor = '';
  
  if (normalizedPercentage === 0) {
    strokeColor = '#6b7280'; // gray
    bgColor = 'bg-gray-500/10';
  } else if (normalizedPercentage < 25) {
    strokeColor = '#ef4444'; // red
    bgColor = 'bg-red-500/10';
  } else if (normalizedPercentage < 50) {
    strokeColor = '#f59e0b'; // yellow/orange
    bgColor = 'bg-yellow-500/10';
  } else if (normalizedPercentage < 75) {
    strokeColor = '#3b82f6'; // blue
    bgColor = 'bg-blue-500/10';
  } else if (normalizedPercentage < 100) {
    strokeColor = '#10b981'; // green
    bgColor = 'bg-green-500/10';
  } else {
    strokeColor = '#10b981'; // green (complete)
    bgColor = 'bg-green-500/20';
  }
  
  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-500/20"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500 ease-out"
          style={{
            filter: 'drop-shadow(0 0 2px currentColor)',
          }}
        />
      </svg>
      
      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center">
        {normalizedPercentage >= 100 && showIcon ? (
          <CheckCircle2 className="w-5 h-5 text-green-400" />
        ) : (
          <span 
            className={cn(
              'text-xs font-bold tabular-nums',
              normalizedPercentage >= 100 ? 'text-green-400' : 'text-gray-400'
            )}
            style={{ fontSize: size * 0.2 }}
          >
            {Math.round(normalizedPercentage)}%
          </span>
        )}
      </div>
    </div>
  );
}
