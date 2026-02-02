'use client';

import React, { useState } from 'react';
import { Sort } from '@/lib/views';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { X, Plus, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SortBuilderProps {
  sorts: Sort[];
  availableFields: { value: string; label: string }[];
  onChange: (sorts: Sort[]) => void;
  accent?: 'purple' | 'orange' | 'blue' | boolean;
}

export function SortBuilder({ sorts, availableFields, onChange, accent }: SortBuilderProps) {
  const [localSorts, setLocalSorts] = useState<Sort[]>(sorts);

  const updateSorts = (newSorts: Sort[]) => {
    setLocalSorts(newSorts);
    onChange(newSorts);
  };

  const addSort = () => {
    const newSort: Sort = {
      field: availableFields[0]?.value || '',
      direction: 'desc',
    };
    updateSorts([...localSorts, newSort]);
  };

  const removeSort = (index: number) => {
    updateSorts(localSorts.filter((_, i) => i !== index));
  };

  const updateSort = (index: number, updates: Partial<Sort>) => {
    updateSorts(localSorts.map((s, i) => i === index ? { ...s, ...updates } : s));
  };

  const toggleDirection = (index: number) => {
    updateSort(index, { direction: localSorts[index].direction === 'asc' ? 'desc' : 'asc' });
  };

  return (
    <div className="space-y-2 min-w-[320px]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-300">Sort by</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={addSort}
          className="h-7 text-xs"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add sort
        </Button>
      </div>

      {localSorts.length === 0 ? (
        <p className="text-xs text-gray-500 py-4 text-center">No sorting applied</p>
      ) : (
        <div className="space-y-2">
          {localSorts.map((sort, index) => (
            <div key={index} className="flex items-center gap-2 p-2 rounded-notion bg-background-card border border-border-subtle">
              <span className="text-xs text-gray-400 w-5">{index + 1}</span>
              
              <Select
                value={sort.field}
                onChange={(e) => updateSort(index, { field: e.target.value })}
                className="flex-1 h-7 text-xs"
                accent={typeof accent === 'boolean' ? accent : !!accent}
              >
                {availableFields.map(field => (
                  <option key={field.value} value={field.value}>{field.label}</option>
                ))}
              </Select>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => toggleDirection(index)}
                className="h-7 w-7 p-0"
                title={sort.direction === 'asc' ? 'Ascending' : 'Descending'}
              >
                {sort.direction === 'asc' ? (
                  <ArrowUp className="w-3 h-3" />
                ) : (
                  <ArrowDown className="w-3 h-3" />
                )}
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeSort(index)}
                className="h-7 w-7 p-0"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
