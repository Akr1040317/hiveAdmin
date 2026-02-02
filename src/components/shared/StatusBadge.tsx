'use client';

import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  variant?: 'default' | 'accent';
  className?: string;
}

const statusColors: Record<string, { variant: 'default' | 'success' | 'warning' | 'error' | 'accent' }> = {
  // Bug statuses
  reported: { variant: 'default' },
  in_progress: { variant: 'accent' },
  blocked: { variant: 'error' },
  fixed: { variant: 'success' },
  verified: { variant: 'success' },
  
  // Feature statuses
  idea: { variant: 'default' },
  planned: { variant: 'accent' },
  in_development: { variant: 'accent' },
  released: { variant: 'success' },
  
  // Content statuses
  ready: { variant: 'success' },
  scheduled: { variant: 'accent' },
  sent: { variant: 'success' },
  
  // Calendar statuses (using same as feature for planned/scheduled, adding completed)
  completed: { variant: 'success' },
};

export function StatusBadge({ status, variant, className }: StatusBadgeProps) {
  const statusConfig = statusColors[status] || { variant: 'default' };
  const badgeVariant = variant || statusConfig.variant;
  
  const formattedStatus = status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return (
    <Badge variant={badgeVariant} className={className}>
      {formattedStatus}
    </Badge>
  );
}
