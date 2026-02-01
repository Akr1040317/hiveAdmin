'use client';

import React, { useState, useMemo } from 'react';
import { 
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachDayOfInterval, format, isSameMonth, isToday, isSameDay, 
  addMonths, subMonths, addWeeks, subWeeks, addDays, subDays,
  startOfDay, endOfDay, isSameWeek, isSameDay as isSameDayFn,
  getWeek, startOfYear, endOfYear
} from 'date-fns';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Grid3x3, List, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmptyState } from './EmptyState';

type CalendarMode = 'month' | 'week' | 'day';

interface CalendarViewProps<T extends { id: string }> {
  data: T[];
  getDate: (item: T) => Date;
  getTitle: (item: T) => string;
  getStatus?: (item: T) => string;
  getColor?: (item: T) => string;
  onItemClick?: (item: T) => void;
  emptyMessage?: string;
  accent?: 'purple' | 'orange' | 'blue' | boolean;
}

export function CalendarView<T extends { id: string }>({
  data,
  getDate,
  getTitle,
  getStatus,
  getColor,
  onItemClick,
  emptyMessage = 'No items found',
  accent = false,
}: CalendarViewProps<T>) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [mode, setMode] = useState<CalendarMode>('month');

  // Group items by date
  const itemsByDate = useMemo(() => {
    const grouped: Record<string, T[]> = {};
    data.forEach(item => {
      const date = getDate(item);
      const key = format(date, 'yyyy-MM-dd');
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
    });
    return grouped;
  }, [data, getDate]);

  const getStatusColor = (status?: string): string => {
    if (!status) return '#3b82f6'; // blue-500
    const s = status.toLowerCase();
    if (s.includes('complete') || s.includes('done') || s.includes('verified')) return '#22c55e'; // green-500
    if (s.includes('progress') || s.includes('active')) return '#3b82f6'; // blue-500
    if (s.includes('blocked') || s.includes('critical')) return '#ef4444'; // red-500
    if (s.includes('planned') || s.includes('scheduled')) return '#8b5cf6'; // purple-500
    return '#6b7280'; // gray-500
  };

  const navigate = {
    previous: () => {
      if (mode === 'month') setCurrentDate(subMonths(currentDate, 1));
      else if (mode === 'week') setCurrentDate(subWeeks(currentDate, 1));
      else setCurrentDate(subDays(currentDate, 1));
    },
    next: () => {
      if (mode === 'month') setCurrentDate(addMonths(currentDate, 1));
      else if (mode === 'week') setCurrentDate(addWeeks(currentDate, 1));
      else setCurrentDate(addDays(currentDate, 1));
    },
    today: () => setCurrentDate(new Date()),
  };

  // Always render calendar, even with empty data

  // Month View
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <div className="border border-border-subtle rounded-notion-lg overflow-hidden bg-background-card/50">
        <div className="grid grid-cols-7 border-b border-border-subtle bg-background-card">
          {weekDays.map((day) => (
            <div
              key={day}
              className="p-3 text-xs font-semibold text-gray-400 text-center border-r border-border-subtle last:border-r-0 uppercase tracking-wider"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, dayIdx) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const dayItems = itemsByDate[dayKey] || [];
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isCurrentDay = isToday(day);

            return (
              <div
                key={day.toString()}
                className={cn(
                  'min-h-[120px] border-r border-b border-border-subtle last:border-r-0 p-2 transition-colors',
                  !isCurrentMonth && 'bg-background/30',
                  isCurrentDay && 'bg-gradient-to-br from-blue-500/10 to-purple-500/10 ring-1 ring-blue-500/20'
                )}
              >
                <div
                  className={cn(
                    'text-sm font-semibold mb-2 flex items-center justify-between',
                    isCurrentDay
                      ? 'text-blue-400'
                      : isCurrentMonth
                      ? 'text-gray-300'
                      : 'text-gray-600'
                  )}
                >
                  <span>{format(day, 'd')}</span>
                  {dayItems.length > 0 && (
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">
                      {dayItems.length}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {dayItems.slice(0, 3).map((item) => {
                    const status = getStatus?.(item);
                    const color = getColor?.(item) || getStatusColor(status);
                    // Normalize color to hex if it's a Tailwind class
                    const colorHex = color.startsWith('#') ? color : 
                      color === 'bg-red-500' ? '#ef4444' :
                      color === 'bg-green-500' ? '#22c55e' :
                      color === 'bg-blue-500' ? '#3b82f6' :
                      color === 'bg-purple-500' ? '#8b5cf6' :
                      color === 'bg-yellow-500' ? '#eab308' :
                      color === 'bg-orange-500' ? '#f97316' :
                      color === 'bg-pink-500' ? '#ec4899' :
                      '#6b7280';
                    
                    return (
                      <Card
                        key={item.id}
                        className={cn(
                          'p-2 cursor-pointer hover:shadow-md transition-all duration-200 border-l-2',
                          'hover:scale-[1.02]'
                        )}
                        onClick={() => onItemClick?.(item)}
                        style={{ borderLeftColor: colorHex }}
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                            style={{ backgroundColor: colorHex }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-gray-200 line-clamp-1">
                              {getTitle(item)}
                            </div>
                            {status && (
                              <div className="text-xs text-gray-500 mt-0.5 capitalize">
                                {status}
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                  {dayItems.length > 3 && (
                    <div className="text-xs text-gray-500 px-2 py-1 text-center bg-background-card rounded-notion">
                      +{dayItems.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Week View
  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate);
    const weekEnd = endOfWeek(currentDate);
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <div className="border border-border-subtle rounded-notion-lg overflow-hidden bg-background-card/50">
        <div className="grid grid-cols-7 border-b border-border-subtle bg-background-card">
          {weekDays.map((day, idx) => (
            <div
              key={day}
              className="p-3 text-xs font-semibold text-gray-400 text-center border-r border-border-subtle last:border-r-0 uppercase tracking-wider"
            >
              <div>{day}</div>
              <div className={cn(
                'text-lg font-bold mt-1',
                isToday(days[idx]) ? 'text-blue-400' : 'text-gray-300'
              )}>
                {format(days[idx], 'd')}
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 min-h-[500px]">
          {days.map((day) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const dayItems = itemsByDate[dayKey] || [];
            const isCurrentDay = isToday(day);

            return (
              <div
                key={day.toString()}
                className={cn(
                  'border-r border-border-subtle last:border-r-0 p-3',
                  isCurrentDay && 'bg-gradient-to-br from-blue-500/10 to-purple-500/10'
                )}
              >
                <div className="space-y-2">
                  {dayItems.map((item) => {
                    const status = getStatus?.(item);
                    const color = getColor?.(item) || getStatusColor(status);
                    const colorHex = color.startsWith('#') ? color : 
                      color === 'bg-red-500' ? '#ef4444' :
                      color === 'bg-green-500' ? '#22c55e' :
                      color === 'bg-blue-500' ? '#3b82f6' :
                      color === 'bg-purple-500' ? '#8b5cf6' :
                      color === 'bg-yellow-500' ? '#eab308' :
                      color === 'bg-orange-500' ? '#f97316' :
                      color === 'bg-pink-500' ? '#ec4899' :
                      '#6b7280';
                    
                    return (
                      <Card
                        key={item.id}
                        className={cn(
                          'p-2.5 cursor-pointer hover:shadow-lg transition-all duration-200',
                          'border-l-2 hover:scale-[1.02]'
                        )}
                        onClick={() => onItemClick?.(item)}
                        style={{ borderLeftColor: colorHex }}
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
                            style={{ backgroundColor: colorHex }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-200 line-clamp-2 mb-1">
                              {getTitle(item)}
                            </div>
                            <div className="text-xs text-gray-400">
                              {format(getDate(item), 'h:mm a')}
                            </div>
                            {status && (
                              <Badge className="text-xs mt-1.5" variant="secondary">
                                {status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                  {dayItems.length === 0 && (
                    <div className="text-xs text-gray-600 text-center py-4">
                      No events
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Day View
  const renderDayView = () => {
    const dayStart = startOfDay(currentDate);
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const dayKey = format(currentDate, 'yyyy-MM-dd');
    const dayItems = itemsByDate[dayKey] || [];
    const isCurrentDay = isToday(currentDate);

    return (
      <div className="border border-border-subtle rounded-notion-lg overflow-hidden bg-background-card/50">
        <div className={cn(
          'p-4 border-b border-border-subtle bg-background-card',
          isCurrentDay && 'bg-gradient-to-r from-blue-500/10 to-purple-500/10'
        )}>
          <div className="text-lg font-bold text-gray-50">
            {format(currentDate, 'EEEE, MMMM d, yyyy')}
          </div>
          <div className="text-sm text-gray-400 mt-1">
            {dayItems.length} {dayItems.length === 1 ? 'event' : 'events'}
          </div>
        </div>
        <div className="divide-y divide-border-subtle">
          {hours.map((hour) => {
            const hourItems = dayItems.filter(item => {
              const itemDate = getDate(item);
              return itemDate.getHours() === hour;
            });

            return (
              <div key={hour} className="flex min-h-[80px]">
                <div className="w-20 p-3 border-r border-border-subtle bg-background-card/50 flex-shrink-0">
                  <div className="text-xs text-gray-500 font-medium">
                    {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                  </div>
                </div>
                <div className="flex-1 p-2">
                  {hourItems.map((item) => {
                    const status = getStatus?.(item);
                    const color = getColor?.(item) || getStatusColor(status);
                    const colorHex = color.startsWith('#') ? color : 
                      color === 'bg-red-500' ? '#ef4444' :
                      color === 'bg-green-500' ? '#22c55e' :
                      color === 'bg-blue-500' ? '#3b82f6' :
                      color === 'bg-purple-500' ? '#8b5cf6' :
                      color === 'bg-yellow-500' ? '#eab308' :
                      color === 'bg-orange-500' ? '#f97316' :
                      color === 'bg-pink-500' ? '#ec4899' :
                      '#6b7280';
                    
                    return (
                      <Card
                        key={item.id}
                        className={cn(
                          'p-3 mb-2 cursor-pointer hover:shadow-lg transition-all duration-200',
                          'border-l-4 hover:scale-[1.01]'
                        )}
                        onClick={() => onItemClick?.(item)}
                        style={{ borderLeftColor: colorHex }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                            style={{ backgroundColor: colorHex }}
                          />
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-gray-200 mb-1">
                              {getTitle(item)}
                            </div>
                            <div className="text-xs text-gray-400">
                              {format(getDate(item), 'h:mm a')}
                            </div>
                            {status && (
                              <Badge className="text-xs mt-2" variant="secondary">
                                {status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 min-h-[600px]">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-50">
            {mode === 'month' && format(currentDate, 'MMMM yyyy')}
            {mode === 'week' && `Week of ${format(startOfWeek(currentDate), 'MMM d')}`}
            {mode === 'day' && format(currentDate, 'EEEE, MMMM d, yyyy')}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Mode Toggle */}
          <div className="flex items-center gap-1 bg-background-card border border-border-subtle rounded-notion p-1">
            <button
              onClick={() => setMode('month')}
              className={cn(
                'px-3 py-1.5 rounded-notion text-xs font-medium transition-colors',
                mode === 'month'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              )}
            >
              <Grid3x3 className="w-3.5 h-3.5 inline mr-1" />
              Month
            </button>
            <button
              onClick={() => setMode('week')}
              className={cn(
                'px-3 py-1.5 rounded-notion text-xs font-medium transition-colors',
                mode === 'week'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              )}
            >
              <CalendarDays className="w-3.5 h-3.5 inline mr-1" />
              Week
            </button>
            <button
              onClick={() => setMode('day')}
              className={cn(
                'px-3 py-1.5 rounded-notion text-xs font-medium transition-colors',
                mode === 'day'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              )}
            >
              <List className="w-3.5 h-3.5 inline mr-1" />
              Day
            </button>
          </div>
          
          <Button
            size="sm"
            variant="secondary"
            onClick={navigate.today}
            className="h-8 text-xs"
          >
            Today
          </Button>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={navigate.previous}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={navigate.next}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar Content */}
      {mode === 'month' && renderMonthView()}
      {mode === 'week' && renderWeekView()}
      {mode === 'day' && renderDayView()}
    </div>
  );
}
