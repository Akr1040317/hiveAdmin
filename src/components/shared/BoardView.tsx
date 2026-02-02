'use client';

import React, { useState, useMemo } from 'react';
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
  onCardConvert?: (itemId: string) => void;
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
  onCardConvert,
  onAddCard,
  emptyMessage = 'No items found',
  accent = false,
}: BoardViewProps<T>) {
  const [draggedItem, setDraggedItem] = useState<T | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);


  // Group data by status
  const groupedData = useMemo(() => {
    const grouped: Record<string, T[]> = {};
    columns.forEach(col => {
      grouped[col.status] = [];
    });
    
    data.forEach(item => {
      // Check if it's a report (has __type === 'report')
      const isReport = (item as any).__type === 'report';
      const status = isReport ? 'pending_reports' : ((item as any).status || columns[0]?.status);
      if (grouped[status]) {
        grouped[status].push(item);
      }
    });

    // Sort by order if available, or by timestamp for reports
    Object.keys(grouped).forEach(status => {
      if (status === 'pending_reports') {
        // Sort reports by timestamp (most recent first)
        grouped[status].sort((a, b) => {
          const aTime = (a as any).timestamp ? new Date((a as any).timestamp).getTime() : 0;
          const bTime = (b as any).timestamp ? new Date((b as any).timestamp).getTime() : 0;
          return bTime - aTime; // Most recent first
        });
      } else {
        // Sort bugs by order
        grouped[status].sort((a, b) => {
          const aOrder = (a as any).order || 0;
          const bOrder = (b as any).order || 0;
          return aOrder - bOrder;
        });
      }
    });

    return grouped;
  }, [data, columns]);

  const handleDragStart = (e: React.DragEvent, item: T) => {
    // Check if item is a report (can't be moved)
    if ((item as any).__type === 'report') {
      e.preventDefault();
      return;
    }
    
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', item.id);
    
    // Visual feedback is handled in BoardCard
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
    setDraggedItem(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    
    if (!draggedItem || !onCardMove) {
      setDraggedItem(null);
      setDragOverColumn(null);
      return;
    }

    // Don't allow dropping on pending_reports
    if (targetStatus === 'pending_reports') {
      setDraggedItem(null);
      setDragOverColumn(null);
      return;
    }

    // Check if item is a report (can't be moved)
    if ((draggedItem as any).__type === 'report') {
      setDraggedItem(null);
      setDragOverColumn(null);
      return;
    }

    // Check if status actually changed
    const currentStatus = (draggedItem as any)?.status;
    if (currentStatus === targetStatus) {
      setDraggedItem(null);
      setDragOverColumn(null);
      return;
    }

    try {
      await onCardMove(draggedItem.id, targetStatus);
    } catch (error) {
      console.error('Error moving card:', error);
    } finally {
      setDraggedItem(null);
      setDragOverColumn(null);
    }
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-6 h-full px-4 min-h-[600px]">
      {columns.map((column) => {
        const columnData = data.length === 0 ? [] : (groupedData[column.status] || []);

        return (
          <BoardColumn
            key={column.id}
            id={column.id}
            title={column.title}
            status={column.status}
            cardIds={columnData.map(item => item.id)}
            cards={columnData.map(item => {
              const isReport = (item as any).__type === 'report';
              return {
                id: item.id,
                ...getCardData(item),
                draggable: !isReport, // Reports are not draggable
                item: item, // Pass the full item for drag handlers
                isReport: isReport,
                isConverted: isReport ? !!(item as any).convertedToBugId : false,
              };
            })}
            onCardClick={(cardId) => {
              const item = data.find(d => d.id === cardId);
              if (item) onCardClick?.(item);
            }}
            onCardConvert={(cardId) => {
              if (onCardConvert) {
                onCardConvert(cardId);
              }
            }}
            onAddCard={() => onAddCard?.(column.status)}
            accent={typeof accent === 'boolean' ? accent : !!accent}
            dragOverColumn={dragOverColumn}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          />
        );
      })}
    </div>
  );
}
