'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { User } from 'lucide-react';

interface BoardCardProps {
  id: string;
  title: string;
  subtitle?: string;
  badges?: { label: string; variant?: 'critical' | 'high' | 'medium' | 'low' | 'default' | 'secondary'; color?: string }[];
  updatedAt?: Date;
  userId?: string;
  onClick?: () => void;
  accent?: 'purple' | 'orange' | 'blue' | boolean;
}

const priorityColors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/40',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  low: 'bg-green-500/20 text-green-400 border-green-500/40',
};

export function BoardCard({
  id,
  title,
  subtitle,
  badges = [],
  updatedAt,
  userId,
  onClick,
  accent = false,
}: BoardCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    scale: isDragging ? 1.05 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'cursor-grab active:cursor-grabbing',
        isDragging && 'z-50'
      )}
    >
      <Card
        className={cn(
          'p-3 hover:shadow-md hover:border-border-light transition-all duration-200',
          'bg-background-card border border-border-subtle',
          onClick && 'cursor-pointer',
          'hover:border-border'
        )}
        onClick={onClick}
      >
        <div className="space-y-2">
          <div>
            <h4 className="text-sm font-medium text-gray-50 line-clamp-2 mb-1 leading-tight">
              {title}
            </h4>
            {subtitle && (
              <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                {subtitle}
              </p>
            )}
          </div>
          
          {badges.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {badges.map((badge, idx) => {
                const badgeClass = badge.variant && priorityColors[badge.variant]
                  ? priorityColors[badge.variant]
                  : badge.color
                  ? `bg-${badge.color}-500/20 text-${badge.color}-400 border-${badge.color}-500/40`
                  : 'bg-gray-500/20 text-gray-400 border-gray-500/40';
                
                return (
                  <Badge
                    key={idx}
                    className={cn(
                      'text-xs font-medium px-2 py-0.5 border rounded',
                      badgeClass
                    )}
                  >
                    {badge.label}
                  </Badge>
                );
              })}
            </div>
          )}
          
          <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
            {userId && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">{userId}</span>
              </div>
            )}
            {updatedAt && (
              <span className="text-xs text-gray-500">
                {format(new Date(updatedAt), 'MMM d, yyyy')}
              </span>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
