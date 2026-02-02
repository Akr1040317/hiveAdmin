'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from './Card';
import { Button } from './Button';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  accent?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  accent = false,
  size = 'md',
}) => {
  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-black/80" />
      <div
        className={cn(
          'relative z-50 w-full mx-4',
          sizes[size]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Card accent={typeof accent === 'boolean' ? accent : !!accent}>
          {title && (
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle>{title}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            </CardHeader>
          )}
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </div>
  );
};
