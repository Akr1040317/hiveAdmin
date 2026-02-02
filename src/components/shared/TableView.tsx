'use client';

import React, { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Plus, ArrowUp, ArrowDown, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sort } from '@/lib/views';
import { format } from 'date-fns';

export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  type?: 'text' | 'select' | 'multiselect' | 'date' | 'number' | 'badge';
  options?: { value: string; label: string }[];
  onEdit?: (item: T, value: any) => void;
}

interface TableViewProps<T extends { id: string }> {
  data: T[];
  columns: TableColumn<T>[];
  sorts?: Sort[];
  onSortChange?: (sorts: Sort[]) => void;
  visibleColumns?: string[];
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  onQuickAdd?: () => void;
  accent?: 'purple' | 'orange' | 'blue' | boolean;
}

export function TableView<T extends { id: string }>({
  data,
  columns,
  sorts = [],
  onSortChange,
  visibleColumns,
  onRowClick,
  emptyMessage = 'No items found',
  onQuickAdd,
  accent = false,
}: TableViewProps<T>) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  // Filter visible columns
  const visibleCols = useMemo(() => {
    if (!visibleColumns || visibleColumns.length === 0) return columns;
    return columns.filter(col => visibleColumns.includes(String(col.key)));
  }, [columns, visibleColumns]);

  // Apply sorting
  const sortedData = useMemo(() => {
    if (sorts.length === 0) return data;
    
    return [...data].sort((a, b) => {
      for (const sort of sorts) {
        const aVal = a[sort.field as keyof T];
        const bVal = b[sort.field as keyof T];
        
        if (aVal === bVal) continue;
        
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sort.direction === 'asc' ? comparison : -comparison;
      }
      return 0;
    });
  }, [data, sorts]);

  const handleSort = (field: string) => {
    if (!onSortChange) return;
    
    const existingSort = sorts.find(s => s.field === field);
    let newSorts: Sort[];
    
    if (existingSort) {
      if (existingSort.direction === 'asc') {
        // Change to desc
        newSorts = sorts.map(s => s.field === field ? { ...s, direction: 'desc' as const } : s);
      } else {
        // Remove sort
        newSorts = sorts.filter(s => s.field !== field);
      }
    } else {
      // Add new sort
      newSorts = [...sorts, { field, direction: 'desc' as const }];
    }
    
    onSortChange(newSorts);
  };

  const getSortIcon = (field: string) => {
    const sort = sorts.find(s => s.field === field);
    if (!sort) return null;
    return sort.direction === 'asc' ? (
      <ArrowUp className="w-3 h-3 ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1" />
    );
  };

  return (
    <div className="relative min-h-[400px]">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border-subtle">
              {visibleCols.map((column) => (
                <TableHead
                  key={String(column.key)}
                  className={cn(
                    'text-xs font-medium text-gray-400 uppercase tracking-wider',
                    column.sortable && 'cursor-pointer hover:text-gray-300 select-none',
                    'px-3 py-2'
                  )}
                  style={{ width: column.width }}
                  onClick={() => column.sortable && handleSort(String(column.key))}
                >
                  <div className="flex items-center">
                    {column.header}
                    {column.sortable && getSortIcon(String(column.key))}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length === 0 ? (
              // Show empty rows instead of empty state message
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow
                  key={`empty-${idx}`}
                  className="border-b border-border-subtle"
                >
                  {visibleCols.map((column) => (
                    <TableCell
                      key={String(column.key)}
                      className="px-3 py-2"
                    >
                      <span className="text-xs text-gray-600">-</span>
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              sortedData.map((item) => (
                <TableRow
                  key={item.id}
                  className={cn(
                    'border-b border-border-subtle transition-all duration-200',
                    hoveredRow === item.id && 'bg-gradient-to-r from-background-hover/50 to-background-card/30 shadow-sm',
                    onRowClick && 'cursor-pointer hover:shadow-md'
                  )}
                  onMouseEnter={() => setHoveredRow(item.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  onClick={() => onRowClick?.(item)}
                >
                  {visibleCols.map((column) => {
                    const value = item[column.key as keyof T];
                    
                    return (
                      <TableCell
                        key={String(column.key)}
                        className="px-3 py-2"
                        onClick={(e) => {
                          // Prevent row click if clicking on editable cell
                          if (column.onEdit || column.type === 'select') {
                            e.stopPropagation();
                          }
                        }}
                      >
                        {column.render ? (
                          column.render(item)
                        ) : column.type === 'select' && column.options && column.onEdit ? (
                          <Select
                            value={String(value || '')}
                            onChange={(e) => column.onEdit!(item, e.target.value)}
                            className="h-7 text-xs w-full"
                            accent={typeof accent === 'boolean' ? accent : !!accent}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {column.options.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </Select>
                        ) : column.type === 'multiselect' && Array.isArray(value) ? (
                          <div className="flex flex-wrap gap-1">
                            {value.map((val: string, idx: number) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {val}
                              </Badge>
                            ))}
                          </div>
                        ) : column.type === 'date' && value ? (
                          <span className="text-xs text-gray-400">
                            {format(new Date(value as any), 'MMM d, yyyy')}
                          </span>
                        ) : column.type === 'badge' ? (
                          <Badge variant="secondary" className="text-xs">
                            {String(value || '')}
                          </Badge>
                        ) : (
                          <span className="text-sm text-gray-200">
                            {String(value ?? '')}
                          </span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Quick Add Row */}
      {onQuickAdd && (
        <div className="border-t border-border-subtle">
          <button
            onClick={onQuickAdd}
            className={cn(
              'w-full px-3 py-2 text-left text-sm text-gray-400 hover:text-gray-200',
              'hover:bg-background-hover transition-colors flex items-center gap-2'
            )}
          >
            <Plus className="w-4 h-4" />
            New
          </button>
        </div>
      )}
    </div>
  );
}
