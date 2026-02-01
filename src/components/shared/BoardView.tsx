'use client';

import React, { useState, useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { BoardColumn } from './BoardColumn';
import { BoardCard } from './BoardCard';
import { EmptyState } from './EmptyState';
import { Kanban } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BoardViewProps<T extends { id: string }> {
  data: T[];
  columns: Array<{
    id: string;
    title: string;
    status: string;
  }>;
  getCardData: (item: T) => {
    title: string;
    subtitle?: string;
    badges?: { label: string; variant?: 'critical' | 'high' | 'medium' | 'low' | 'default' | 'secondary'; color?: string }[];
    updatedAt?: Date;
    userId?: string;
  };
  onCardClick?: (item: T) => void;
  onCardMove?: (itemId: string, newStatus: string, newOrder?: number) => Promise<void>;
  onAddCard?: (status: string) => void;
  emptyMessage?: string;
  accent?: 'purple' | 'orange' | 'blue' | boolean;
}

export function BoardView<T extends { id: string }>({
  data,
  columns,
  getCardData,
  onCardClick,
  onCardMove,
  onAddCard,
  emptyMessage = 'No items found',
  accent = false,
}: BoardViewProps<T>) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Group data by status
  const groupedData = useMemo(() => {
    const grouped: Record<string, T[]> = {};
    columns.forEach(col => {
      grouped[col.status] = [];
    });
    
    data.forEach(item => {
      // Assuming items have a status field - this should be configurable
      const status = (item as any).status || columns[0]?.status;
      if (grouped[status]) {
        grouped[status].push(item);
      }
    });

    // Sort by order if available
    Object.keys(grouped).forEach(status => {
      grouped[status].sort((a, b) => {
        const aOrder = (a as any).order || 0;
        const bOrder = (b as any).order || 0;
        return aOrder - bOrder;
      });
    });

    return grouped;
  }, [data, columns]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || !onCardMove) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find which column the card was dropped on
    const targetColumn = columns.find(col => col.id === overId);
    if (!targetColumn) {
      // Might be dropped on a card - find the column
      const targetCard = data.find(item => item.id === overId);
      if (targetCard) {
        const targetStatus = (targetCard as any).status;
        const targetCol = columns.find(col => col.status === targetStatus);
        if (targetCol) {
          setIsMoving(true);
          try {
            await onCardMove(activeId, targetCol.status);
          } finally {
            setIsMoving(false);
          }
        }
      }
      return;
    }

    // Card dropped on column
    setIsMoving(true);
    try {
      await onCardMove(activeId, targetColumn.status);
    } finally {
      setIsMoving(false);
    }
  };

  // Always show board columns, even when empty

  const activeItem = activeId ? data.find(item => item.id === activeId) : null;
  const activeCardData = activeItem ? getCardData(activeItem) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-6 h-full px-4 min-h-[600px]">
        {columns.map((column) => {
          const columnData = data.length === 0 ? [] : (groupedData[column.status] || []);
          const cardIds = columnData.map(item => item.id);

          return (
            <BoardColumn
              key={column.id}
              id={column.id}
              title={column.title}
              cardIds={cardIds}
              cards={columnData.map(item => ({
                id: item.id,
                ...getCardData(item),
              }))}
              onCardClick={(cardId) => {
                const item = data.find(d => d.id === cardId);
                if (item) onCardClick?.(item);
              }}
              onAddCard={() => onAddCard?.(column.status)}
              accent={accent}
            />
          );
        })}
      </div>

      <DragOverlay>
        {activeCardData && activeId ? (
          <div className="rotate-3 opacity-90">
            <BoardCard
              id={activeId}
              title={activeCardData.title}
              subtitle={activeCardData.subtitle}
              badges={activeCardData.badges}
              updatedAt={activeCardData.updatedAt}
              accent={accent}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
