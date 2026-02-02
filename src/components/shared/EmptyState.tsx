'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  accent?: 'purple' | 'orange' | 'blue' | boolean;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel = 'New',
  onAction,
  accent = false,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
      {Icon && (
        <div className="mb-4 p-3 rounded-notion bg-background-card border border-border-subtle">
          <Icon className="w-5 h-5 text-gray-400" />
        </div>
      )}
      <h3 className="text-sm font-medium text-gray-300 mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-gray-500 mb-4 max-w-sm">{description}</p>
      )}
      {onAction && (
        <Button
          size="sm"
          accent={typeof accent === 'boolean' ? accent : !!accent}
          onClick={onAction}
          variant="primary"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
