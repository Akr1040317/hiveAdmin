'use client';

import React from 'react';
import { ContentRequirement } from '@/app/actions/content-requirements';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { getRequirementStatusColor, getPeriodLabel, getContentTypeLabel } from '@/lib/content-requirements';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';

interface RequirementStatusProps {
  requirement: ContentRequirement;
  onClick?: () => void;
  showLabel?: boolean;
  className?: string;
}

export function RequirementStatus({
  requirement,
  onClick,
  showLabel = true,
  className,
}: RequirementStatusProps) {
  const statusColor = getRequirementStatusColor(requirement.status);
  const periodLabel = getPeriodLabel(requirement);
  const contentTypeLabel = getContentTypeLabel(requirement.contentType);

  const getStatusIcon = () => {
    switch (requirement.status) {
      case 'met':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'missed':
        return <XCircle className="w-4 h-4" />;
    }
  };

  const getStatusBadgeVariant = (): 'default' | 'secondary' | 'critical' => {
    switch (requirement.status) {
      case 'met':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'missed':
        return 'critical';
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2',
        onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
        className
      )}
      onClick={onClick}
    >
      <Badge
        variant={getStatusBadgeVariant()}
        className="flex items-center gap-1.5 text-xs"
        style={{
          backgroundColor: requirement.status === 'met' ? `${statusColor}20` : undefined,
          borderColor: requirement.status === 'met' ? statusColor : undefined,
          color: requirement.status === 'met' ? statusColor : undefined,
        }}
      >
        {getStatusIcon()}
        <span className="capitalize">{requirement.status}</span>
      </Badge>
      {showLabel && (
        <span className="text-xs text-gray-400">
          {contentTypeLabel} • {periodLabel}
        </span>
      )}
    </div>
  );
}

interface RequirementStatusListProps {
  requirements: ContentRequirement[];
  onRequirementClick?: (requirement: ContentRequirement) => void;
  className?: string;
}

export function RequirementStatusList({
  requirements,
  onRequirementClick,
  className,
}: RequirementStatusListProps) {
  if (requirements.length === 0) {
    return (
      <div className={cn('text-sm text-gray-400 py-4', className)}>
        No requirements found
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {requirements.map((requirement) => (
        <RequirementStatus
          key={requirement.id}
          requirement={requirement}
          onClick={() => onRequirementClick?.(requirement)}
          showLabel={true}
        />
      ))}
    </div>
  );
}
