'use client';

import React, { useState } from 'react';
import { Filter, FilterOperator } from '@/lib/views';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterBuilderProps {
  filters: Filter[];
  availableFields: { value: string; label: string; type: 'text' | 'select' | 'date' | 'number' }[];
  onChange: (filters: Filter[]) => void;
  accent?: 'purple' | 'orange' | 'blue' | boolean;
}

const operators: { value: FilterOperator; label: string; types: string[] }[] = [
  { value: 'equals', label: 'equals', types: ['text', 'select', 'number'] },
  { value: 'not_equals', label: 'not equals', types: ['text', 'select', 'number'] },
  { value: 'contains', label: 'contains', types: ['text'] },
  { value: 'is_empty', label: 'is empty', types: ['text', 'select'] },
  { value: 'is_not_empty', label: 'is not empty', types: ['text', 'select'] },
  { value: 'before', label: 'before', types: ['date'] },
  { value: 'after', label: 'after', types: ['date'] },
  { value: 'in_list', label: 'in list', types: ['select'] },
];

export function FilterBuilder({ filters, availableFields, onChange, accent }: FilterBuilderProps) {
  const [localFilters, setLocalFilters] = useState<Filter[]>(filters);

  const updateFilters = (newFilters: Filter[]) => {
    setLocalFilters(newFilters);
    onChange(newFilters);
  };

  const addFilter = () => {
    const newFilter: Filter = {
      id: Date.now().toString(),
      field: availableFields[0]?.value || '',
      operator: 'equals',
      value: '',
    };
    updateFilters([...localFilters, newFilter]);
  };

  const removeFilter = (id: string) => {
    updateFilters(localFilters.filter(f => f.id !== id));
  };

  const updateFilter = (id: string, updates: Partial<Filter>) => {
    updateFilters(localFilters.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const getFieldType = (fieldValue: string) => {
    return availableFields.find(f => f.value === fieldValue)?.type || 'text';
  };

  const getAvailableOperators = (fieldType: string) => {
    return operators.filter(op => op.types.includes(fieldType));
  };

  const getFieldOptions = (fieldValue: string) => {
    const field = availableFields.find(f => f.value === fieldValue);
    // This would come from the actual data - simplified for now
    return [];
  };

  return (
    <div className="space-y-2 min-w-[320px]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-300">Filters</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={addFilter}
          className="h-7 text-xs"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add filter
        </Button>
      </div>

      {localFilters.length === 0 ? (
        <p className="text-xs text-gray-500 py-4 text-center">No filters applied</p>
      ) : (
        <div className="space-y-2">
          {localFilters.map((filter) => {
            const fieldType = getFieldType(filter.field);
            const availableOps = getAvailableOperators(fieldType);
            const needsValue = !['is_empty', 'is_not_empty'].includes(filter.operator);

            return (
              <div key={filter.id} className="flex items-start gap-2 p-2 rounded-notion bg-background-card border border-border-subtle">
                <Select
                  value={filter.field}
                  onChange={(e) => updateFilter(filter.id, { field: e.target.value, operator: 'equals', value: '' })}
                  className="flex-1 h-7 text-xs"
                  accent={typeof accent === 'boolean' ? accent : !!accent}
                >
                  {availableFields.map(field => (
                    <option key={field.value} value={field.value}>{field.label}</option>
                  ))}
                </Select>

                <Select
                  value={filter.operator}
                  onChange={(e) => updateFilter(filter.id, { operator: e.target.value as FilterOperator })}
                  className="w-32 h-7 text-xs"
                  accent={typeof accent === 'boolean' ? accent : !!accent}
                >
                  {availableOps.map(op => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </Select>

                {needsValue && (
                  fieldType === 'select' ? (
                    <Select
                      value={filter.value || ''}
                      onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                      className="flex-1 h-7 text-xs"
                      accent={typeof accent === 'boolean' ? accent : !!accent}
                    >
                      <option value="">Select value...</option>
                      {getFieldOptions(filter.field).map((opt: any) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </Select>
                  ) : fieldType === 'date' ? (
                    <Input
                      type="date"
                      value={filter.value || ''}
                      onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                      className="flex-1 h-7 text-xs"
                      accent={typeof accent === 'boolean' ? accent : !!accent}
                    />
                  ) : (
                    <Input
                      value={filter.value || ''}
                      onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                      placeholder="Value..."
                      className="flex-1 h-7 text-xs"
                      accent={typeof accent === 'boolean' ? accent : !!accent}
                    />
                  )
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeFilter(filter.id)}
                  className="h-7 w-7 p-0"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
