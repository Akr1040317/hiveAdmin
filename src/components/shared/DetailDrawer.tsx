'use client';

import React, { useState, useEffect } from 'react';
import { X, Copy, ExternalLink, Calendar, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import * as Dialog from '@radix-ui/react-dialog';
import { format } from 'date-fns';

interface PropertyField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'multiselect' | 'date' | 'number';
  value: any;
  options?: { value: string; label: string }[];
  onChange: (value: any) => void;
}

interface DetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  onTitleChange: (title: string) => void;
  properties: PropertyField[];
  bodyFields?: {
    key: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  }[];
  metadata?: {
    createdAt?: Date;
    updatedAt?: Date;
    createdBy?: string;
  };
  onSave?: () => void;
  onDelete?: () => void;
  accent?: 'purple' | 'orange' | 'blue' | boolean;
}

export function DetailDrawer({
  isOpen,
  onClose,
  title,
  onTitleChange,
  properties,
  bodyFields = [],
  metadata,
  onSave,
  onDelete,
  accent = false,
}: DetailDrawerProps) {
  const [localTitle, setLocalTitle] = useState(title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  useEffect(() => {
    setLocalTitle(title);
  }, [title]);

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    if (localTitle !== title) {
      onTitleChange(localTitle);
    }
  };

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    // Could show a toast here
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content
          className={cn(
            'fixed right-0 top-0 bottom-0 w-full max-w-lg bg-gradient-to-b from-background-card to-background border-l border-border-subtle z-50',
            'flex flex-col shadow-2xl backdrop-blur-sm',
            'animate-slide-in-right'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border-subtle bg-background-card/80 backdrop-blur-sm">
            <div className="flex-1">
              {isEditingTitle ? (
                <Input
                  value={localTitle}
                  onChange={(e) => setLocalTitle(e.target.value)}
                  onBlur={handleTitleBlur}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleTitleBlur();
                    }
                    if (e.key === 'Escape') {
                      setLocalTitle(title);
                      setIsEditingTitle(false);
                    }
                  }}
                  autoFocus
                  className="text-base font-medium"
                  accent={accent}
                />
              ) : (
                <h2
                  onClick={() => setIsEditingTitle(true)}
                  className="text-base font-medium text-gray-50 cursor-text hover:bg-background-hover px-1 py-0.5 rounded-notion -ml-1"
                >
                  {title || 'Untitled'}
                </h2>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopyLink}
                className="h-7 w-7 p-0"
                title="Copy link"
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => window.open(window.location.href, '_blank')}
                className="h-7 w-7 p-0"
                title="Open in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onClose}
                className="h-7 w-7 p-0"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Properties */}
            {properties.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Properties
                </h3>
                <div className="space-y-3">
                  {properties.map((prop) => (
                    <div key={prop.key} className="flex items-center gap-3">
                      <label className="text-xs text-gray-400 w-24 flex-shrink-0">
                        {prop.label}
                      </label>
                      <div className="flex-1">
                        {prop.type === 'select' ? (
                          <Select
                            value={prop.value || ''}
                            onChange={(e) => prop.onChange(e.target.value)}
                            className="h-8 text-sm"
                            accent={accent}
                          >
                            {prop.options?.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </Select>
                        ) : prop.type === 'multiselect' ? (
                          <div className="flex flex-wrap gap-1.5">
                            {prop.options?.map((opt) => {
                              const isSelected = Array.isArray(prop.value) && prop.value.includes(opt.value);
                              return (
                                <button
                                  key={opt.value}
                                  onClick={() => {
                                    const current = Array.isArray(prop.value) ? prop.value : [];
                                    if (isSelected) {
                                      prop.onChange(current.filter(v => v !== opt.value));
                                    } else {
                                      prop.onChange([...current, opt.value]);
                                    }
                                  }}
                                  className={cn(
                                    'px-2 py-0.5 rounded-notion text-xs border transition-colors',
                                    isSelected
                                      ? 'bg-accent-purple-subtle border-accent-purple-border text-accent-purple-light'
                                      : 'bg-background-card border-border-subtle text-gray-300 hover:border-border'
                                  )}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        ) : prop.type === 'date' ? (
                          <Input
                            type="date"
                            value={prop.value ? format(new Date(prop.value), 'yyyy-MM-dd') : ''}
                            onChange={(e) => prop.onChange(e.target.value ? new Date(e.target.value) : null)}
                            className="h-8 text-sm"
                            accent={accent}
                          />
                        ) : prop.type === 'number' ? (
                          <Input
                            type="number"
                            value={prop.value || ''}
                            onChange={(e) => prop.onChange(Number(e.target.value))}
                            className="h-8 text-sm"
                            accent={accent}
                          />
                        ) : (
                          <Input
                            value={prop.value || ''}
                            onChange={(e) => prop.onChange(e.target.value)}
                            className="h-8 text-sm"
                            accent={accent}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Body Fields */}
            {bodyFields.map((field) => (
              <div key={field.key}>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">
                  {field.label}
                </label>
                <textarea
                  value={field.value || ''}
                  onChange={(e) => field.onChange(e.target.value)}
                  placeholder={field.placeholder}
                  className={cn(
                    'w-full min-h-[120px] rounded-notion border border-border-subtle bg-background-card px-2.5 py-2',
                    'text-sm text-gray-100 placeholder:text-gray-500',
                    'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-background transition-all duration-notion',
                    accent
                      ? 'focus:ring-violet-500/40 focus:border-violet-500/30'
                      : 'focus:ring-gray-500/40 focus:border-border',
                    'resize-none'
                  )}
                />
              </div>
            ))}

            {/* Metadata */}
            {metadata && (
              <div className="pt-4 border-t border-border-subtle">
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Activity
                </h3>
                <div className="space-y-2 text-xs text-gray-500">
                  {metadata.createdAt && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Created {format(new Date(metadata.createdAt), 'MMM d, yyyy')}</span>
                    </div>
                  )}
                  {metadata.updatedAt && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Updated {format(new Date(metadata.updatedAt), 'MMM d, yyyy')}</span>
                    </div>
                  )}
                  {metadata.createdBy && (
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5" />
                      <span>By {metadata.createdBy}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {(onSave || onDelete) && (
            <div className="flex items-center justify-between p-4 border-t border-border-subtle">
              {onDelete && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onDelete}
                  className="text-red-400 hover:text-red-300"
                >
                  Delete
                </Button>
              )}
              {onSave && (
                <Button
                  size="sm"
                  variant="primary"
                  accent={accent}
                  onClick={onSave}
                  className="ml-auto"
                >
                  Save
                </Button>
              )}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
