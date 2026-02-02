'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { User, Bug } from 'lucide-react';

interface BoardCardProps {
  id: string;
  title: string;
  subtitle?: string;
  badges?: { label: string; variant?: 'critical' | 'high' | 'medium' | 'low' | 'default' | 'secondary'; color?: string }[];
  updatedAt?: Date;
  userId?: string;
  onClick?: () => void;
  accent?: 'purple' | 'orange' | 'blue' | boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onConvert?: () => void;
  isReport?: boolean;
  isConverted?: boolean;
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
  draggable = true,
  onDragStart,
  onDragEnd,
  onConvert,
  isReport = false,
  isConverted = false,
}: BoardCardProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    if (!draggable) {
      e.preventDefault();
      return;
    }
    
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', id);
    
    // Set opacity for visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
    
    if (onDragStart) {
      onDragStart(e);
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setIsDragging(false);
    
    // Reset opacity
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
    
    if (onDragEnd) {
      onDragEnd(e);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // Don't trigger click if we just finished dragging
    if (isDragging) {
      return;
    }
    
    if (onClick) {
      onClick();
    }
  };

  return (
    <Card
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        'p-3 hover:shadow-md hover:border-border-light transition-all duration-200',
        'bg-background-card border border-border-subtle',
        'hover:border-border',
        'select-none', // Prevent text selection
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        isDragging && 'opacity-50'
      )}
      onClick={handleClick}
      style={{ userSelect: 'none' }}
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
            <div className="flex items-center gap-2">
              {userId && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500">{userId}</span>
                </div>
              )}
              {isConverted && (
                <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/40">
                  Converted
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {updatedAt && (
                <span className="text-xs text-gray-500">
                  {format(new Date(updatedAt), 'MMM d, yyyy')}
                </span>
              )}
              {isReport && onConvert && !isConverted && (
                <Button
                  size="sm"
                  variant="primary"
                  accent={typeof accent === 'boolean' ? accent : !!accent}
                  onClick={(e) => {
                    e.stopPropagation();
                    onConvert();
                  }}
                  className="h-6 text-xs px-2 py-0"
                >
                  <Bug className="w-3 h-3 mr-1" />
                  Convert
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
  );
}
