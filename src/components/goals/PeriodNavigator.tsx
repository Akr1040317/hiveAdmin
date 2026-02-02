'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface PeriodNavigatorProps {
  period: string;
  type: 'monthly' | 'weekly';
  onPrevious: () => void;
  onNext: () => void;
  onCurrent?: () => void;
  formattedPeriod: string;
  isCurrent?: boolean;
  accent?: 'purple' | 'orange' | 'blue' | boolean;
}

export function PeriodNavigator({
  period,
  type,
  onPrevious,
  onNext,
  onCurrent,
  formattedPeriod,
  isCurrent = false,
  accent = false,
}: PeriodNavigatorProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onPrevious}
          className="h-8 w-8 p-0"
          accent={typeof accent === 'boolean' ? accent : !!accent}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        
        <div className="text-center min-w-[200px]">
          <h3 className={cn(
            'text-lg font-semibold',
            isCurrent ? 'text-gray-50' : 'text-gray-400'
          )}>
            {formattedPeriod}
          </h3>
          {isCurrent && (
            <span className="text-xs text-gray-500 mt-0.5 block">Current {type === 'monthly' ? 'Month' : 'Week'}</span>
          )}
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onNext}
          className="h-8 w-8 p-0"
          accent={typeof accent === 'boolean' ? accent : !!accent}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      
      {onCurrent && !isCurrent && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onCurrent}
          className="text-xs"
          accent={typeof accent === 'boolean' ? accent : !!accent}
        >
          Go to Current
        </Button>
      )}
    </div>
  );
}
