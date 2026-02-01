'use client';

import React, { useMemo } from 'react';
import { ContentRequirement, ContentRequirementType } from '@/app/actions/content-requirements';
import { cn } from '@/lib/utils';
import { format, startOfWeek, addDays, addWeeks, isSameDay, isSameWeek, startOfDay } from 'date-fns';
import { CheckCircle2, Clock, XCircle, Circle, Bell } from 'lucide-react';
import { getContentTypeLabel, getPeriodLabel } from '@/lib/content-requirements';
import { Button } from '@/components/ui/Button';
import { Content } from '@/app/actions/content';

interface RequirementTrackerProps {
  requirements: ContentRequirement[];
  contentType: ContentRequirementType;
  onConfirm?: (requirementId: string) => void;
  onMarkMissed?: (requirementId: string) => void;
  startDate?: Date;
  endDate?: Date;
  content?: Content[]; // Optional: pass content to check reminder status
}

export function RequirementTracker({
  requirements,
  contentType,
  onConfirm,
  onMarkMissed,
  startDate,
  endDate,
  content = [],
}: RequirementTrackerProps) {
  const isDaily = contentType === 'word_of_the_day';
  
  const defaultStartDate = startDate || new Date();
  const defaultEndDate = endDate || (() => {
    const end = new Date();
    if (isDaily) {
      end.setDate(end.getDate() + 30); // Show 30 days for daily
    } else {
      end.setDate(end.getDate() + 90); // Show ~13 weeks for weekly
    }
    return end;
  })();

  // Group requirements by period
  const requirementsByPeriod = useMemo(() => {
    const grouped: Map<string, ContentRequirement> = new Map();
    requirements.forEach((req) => {
      if (req.contentType === contentType) {
        const periodKey = isDaily
          ? format(new Date(req.periodStart), 'yyyy-MM-dd')
          : format(startOfWeek(new Date(req.periodStart), { weekStartsOn: 1 }), 'yyyy-MM-dd');
        grouped.set(periodKey, req);
      }
    });
    return grouped;
  }, [requirements, contentType, isDaily]);

  // Generate all periods in range
  const periods = useMemo(() => {
    const periods: Array<{ date: Date; key: string; requirement?: ContentRequirement }> = [];
    let current = new Date(defaultStartDate);
    
    if (isDaily) {
      // Daily periods
      current = startOfDay(current);
      while (current <= defaultEndDate) {
        const key = format(current, 'yyyy-MM-dd');
        periods.push({
          date: new Date(current),
          key,
          requirement: requirementsByPeriod.get(key),
        });
        current = addDays(current, 1);
      }
    } else {
      // Weekly periods
      current = startOfWeek(current, { weekStartsOn: 1 });
      while (current <= defaultEndDate) {
        const key = format(current, 'yyyy-MM-dd');
        periods.push({
          date: new Date(current),
          key,
          requirement: requirementsByPeriod.get(key),
        });
        current = addWeeks(current, 1);
      }
    }
    
    return periods;
  }, [defaultStartDate, defaultEndDate, isDaily, requirementsByPeriod]);

  const getStatusIcon = (status: ContentRequirement['status']) => {
    switch (status) {
      case 'met':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'missed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      default:
        return <Circle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusLabel = (status: ContentRequirement['status']) => {
    switch (status) {
      case 'met':
        return 'Completed';
      case 'missed':
        return 'Missed';
      case 'pending':
        return 'Pending';
      default:
        return 'Not Started';
    }
  };

  const getStatusColor = (status: ContentRequirement['status']) => {
    switch (status) {
      case 'met':
        return 'bg-green-500/10 border-green-500/30 text-green-400';
      case 'missed':
        return 'bg-red-500/10 border-red-500/30 text-red-400';
      case 'pending':
        return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
      default:
        return 'bg-gray-500/10 border-gray-500/30 text-gray-400';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-200">
          {getContentTypeLabel(contentType)} Tracker
        </h3>
        <span className="text-sm text-gray-400">
          {isDaily ? 'Daily' : 'Weekly'} Requirements
        </span>
      </div>

      <div className="space-y-2">
        {periods.map((period) => {
          const req = period.requirement;
          const isPast = period.date < startOfDay(new Date());
          const isToday = isSameDay(period.date, new Date());
          
          return (
            <div
              key={period.key}
              className={cn(
                'flex items-center gap-4 p-4 rounded-lg border transition-all',
                req
                  ? getStatusColor(req.status)
                  : isPast
                  ? 'bg-gray-500/5 border-gray-500/20'
                  : 'bg-background-card/50 border-border-subtle',
                isToday && 'ring-2 ring-blue-500/30',
                'hover:border-border'
              )}
            >
              {/* Status Icon */}
              <div className="flex-shrink-0">
                {req ? getStatusIcon(req.status) : <Circle className="w-5 h-5 text-gray-500" />}
              </div>

              {/* Period Label */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-200">
                    {isDaily
                      ? format(period.date, 'EEEE, MMM d, yyyy')
                      : `Week of ${format(period.date, 'MMM d, yyyy')}`}
                  </span>
                  {isToday && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-400 rounded">
                      Today
                    </span>
                  )}
                </div>
                {req && (
                  <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                    <div>Status: {getStatusLabel(req.status)}</div>
                    {req.contentId && (
                      <div className="flex items-center gap-1">
                        <span>Content linked</span>
                        {(() => {
                          const linkedContent = content.find(c => c.id === req.contentId);
                          if (linkedContent?.reminderSent) {
                            return (
                              <span className="flex items-center gap-1 text-yellow-400">
                                <Bell className="w-3 h-3" />
                                Reminder sent
                              </span>
                            );
                          }
                          if (linkedContent && linkedContent.publishAt) {
                            const publishDate = new Date(linkedContent.publishAt);
                            const now = new Date();
                            const hoursUntilPublish = (publishDate.getTime() - now.getTime()) / (1000 * 60 * 60);
                            if (hoursUntilPublish > 0 && hoursUntilPublish <= 24 && linkedContent.status !== 'verified' && linkedContent.status !== 'sent') {
                              return (
                                <span className="flex items-center gap-1 text-orange-400">
                                  <Bell className="w-3 h-3" />
                                  Reminder needed
                                </span>
                              );
                            }
                          }
                          return null;
                        })()}
                      </div>
                    )}
                  </div>
                )}
                {!req && isPast && (
                  <div className="text-xs text-gray-500 mt-1">
                    No requirement created
                  </div>
                )}
              </div>

              {/* Actions */}
              {req && (
                <div className="flex items-center gap-2">
                  {req.status === 'pending' && (
                    <>
                      {onConfirm && (
                        <Button
                          onClick={() => onConfirm(req.id)}
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Mark Done
                        </Button>
                      )}
                      {onMarkMissed && (
                        <Button
                          onClick={() => onMarkMissed(req.id)}
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-red-400 hover:text-red-300"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          Missed
                        </Button>
                      )}
                    </>
                  )}
                  {req.status === 'met' && (
                    <span className="text-xs text-green-400 font-medium">✓ Completed</span>
                  )}
                  {req.status === 'missed' && (
                    <span className="text-xs text-red-400 font-medium">✗ Missed</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 p-4 rounded-lg bg-background-card/50 border border-border-subtle">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-200">{periods.length}</div>
            <div className="text-xs text-gray-400">Total {isDaily ? 'Days' : 'Weeks'}</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-400">
              {periods.filter((p) => p.requirement?.status === 'met').length}
            </div>
            <div className="text-xs text-gray-400">Completed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-400">
              {periods.filter((p) => p.requirement?.status === 'pending').length}
            </div>
            <div className="text-xs text-gray-400">Pending</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-400">
              {periods.filter((p) => p.requirement?.status === 'missed').length}
            </div>
            <div className="text-xs text-gray-400">Missed</div>
          </div>
        </div>
      </div>
    </div>
  );
}
