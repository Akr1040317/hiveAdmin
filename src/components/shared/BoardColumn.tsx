'use client';

import React from 'react';
import { BoardCard } from './BoardCard';
import { Button } from '@/components/ui/Button';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProject } from '@/contexts/ProjectContext';

interface BoardColumnProps {
  id: string;
  title: string;
  status: string;
  cardIds: string[];
  cards: Array<{
    id: string;
    title: string;
    subtitle?: string;
    badges?: { label: string; variant?: 'critical' | 'high' | 'medium' | 'low' | 'default' | 'secondary'; color?: string }[];
    updatedAt?: Date;
    userId?: string;
    draggable?: boolean;
    item?: any; // Full item for drag handlers
    isReport?: boolean;
    isConverted?: boolean;
  }>;
  onCardClick?: (cardId: string) => void;
  onCardConvert?: (cardId: string) => void;
  onAddCard?: () => void;
  accent?: 'purple' | 'orange' | 'blue' | boolean;
  dragOverColumn?: string | null;
  onDragStart?: (e: React.DragEvent, item: any) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent, columnId: string) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent, targetStatus: string) => void;
}

export function BoardColumn({
  id,
  title,
  status,
  cardIds,
  cards,
  onCardClick,
  onCardConvert,
  onAddCard,
  accent = false,
  dragOverColumn,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: BoardColumnProps) {
  const { project } = useProject();
  
  const isDragOver = dragOverColumn === id;

  const getAccentColor = () => {
    if (accent === true) return 'purple';
    if (typeof accent === 'string') return accent;
    return project?.accentColorKey || 'purple';
  };

  const accentColor = getAccentColor();

  // Column accent colors based on status - matching reference design
  const getColumnAccent = (title: string) => {
    const lower = title.toLowerCase();
    if (lower.includes('new') || lower.includes('reported') || lower.includes('idea')) return 'bg-gray-500';
    if (lower.includes('progress') || lower.includes('in progress')) return 'bg-yellow-500';
    if (lower.includes('review') || lower.includes('blocked') || lower.includes('in review')) return 'bg-purple-500';
    if (lower.includes('complete') || lower.includes('fixed') || lower.includes('released') || lower.includes('verified') || lower.includes('completed')) return 'bg-green-500';
    return accentColor === 'purple' ? 'bg-violet-500' : accentColor === 'orange' ? 'bg-orange-500' : 'bg-blue-500';
  };

  const columnAccent = getColumnAccent(title);

  return (
    <div className="flex flex-col h-full min-w-[280px] bg-background-card/80 rounded-notion-lg border border-border-subtle">
      {/* Column Header */}
      <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-background-card/50">
        <div className="flex items-center gap-3">
          <div className={cn('w-1 h-6 rounded-full', columnAccent)} />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-gray-50 uppercase tracking-wider">{title}</h3>
            <span className="text-xs text-gray-500 mt-0.5">{cards.length}</span>
          </div>
        </div>
        {onAddCard && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onAddCard}
            className="h-7 w-7 p-0 hover:bg-background-hover rounded-notion"
          >
            <Plus className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Cards */}
      <div
        className={cn(
          'flex-1 overflow-y-auto transition-all duration-200 p-2 min-h-[400px]',
          isDragOver && 'bg-background-hover/30 ring-2 ring-offset-2 ring-offset-background',
          isDragOver && accentColor === 'purple' && 'ring-violet-500/50',
          isDragOver && accentColor === 'orange' && 'ring-orange-500/50',
          isDragOver && accentColor === 'blue' && 'ring-blue-500/50'
        )}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'move';
          if (onDragOver) {
            onDragOver(e, id);
          }
        }}
        onDragLeave={(e) => {
          // Only trigger if we're actually leaving the column (not just moving to a child)
          const relatedTarget = e.relatedTarget as Node;
          if (!e.currentTarget.contains(relatedTarget) && relatedTarget !== e.currentTarget) {
            if (onDragLeave) {
              onDragLeave();
            }
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'move';
          if (onDrop) {
            onDrop(e, status);
          }
        }}
      >
        {cards.map((card) => (
          <BoardCard
            key={card.id}
            id={card.id}
            title={card.title}
            subtitle={card.subtitle}
            badges={card.badges}
            updatedAt={card.updatedAt}
            userId={card.userId}
            onClick={() => onCardClick?.(card.id)}
            accent={accent}
            draggable={card.draggable !== false}
            onDragStart={onDragStart && card.item ? (e) => onDragStart(e, card.item) : undefined}
            onDragEnd={onDragEnd}
            onConvert={onCardConvert ? () => onCardConvert(card.id) : undefined}
            isReport={card.isReport}
            isConverted={card.isConverted}
          />
        ))}
        {cards.length === 0 && (
          <div className="text-center py-12">
            <div className="text-xs text-gray-500 mb-2">No issues</div>
            {onAddCard && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onAddCard}
                className="text-xs text-gray-400 hover:text-gray-200"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add item
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
