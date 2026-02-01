import { startOfWeek, addDays, addWeeks, format, isSameDay, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { Content } from '@/app/actions/content';
import { ContentRequirement, ContentSchedule } from '@/app/actions/content-requirements';

/**
 * Calculate the start of the week (Monday) for a given date
 */
export function calculateWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 }); // Monday = 1
}

/**
 * Format a period key for storage/comparison
 * Weekly: "2024-W01" format
 * Daily: "2024-01-15" format
 */
export function formatPeriodKey(date: Date, periodType: 'weekly' | 'daily'): string {
  if (periodType === 'weekly') {
    const weekStart = calculateWeekStart(date);
    const year = weekStart.getFullYear();
    const weekNumber = getWeekNumber(weekStart);
    return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
  } else {
    return format(date, 'yyyy-MM-dd');
  }
}

/**
 * Get ISO week number for a date
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Get the start of a period (week start for weekly, day start for daily)
 */
export function getPeriodStart(periodStart: Date, periodType: 'weekly' | 'daily'): Date {
  if (periodType === 'weekly') {
    return startOfDay(calculateWeekStart(periodStart));
  } else {
    return startOfDay(periodStart);
  }
}

/**
 * Get the end of a period (end of week for weekly, end of day for daily)
 */
export function getPeriodEnd(periodStart: Date, periodType: 'weekly' | 'daily'): Date {
  if (periodType === 'weekly') {
    const weekStart = calculateWeekStart(periodStart);
    return endOfDay(addDays(weekStart, 6)); // End of Sunday
  } else {
    return endOfDay(periodStart);
  }
}

/**
 * Check if content's publishAt date falls within a requirement's period
 */
export function isContentInPeriod(content: Content, requirement: ContentRequirement): boolean {
  if (!content.publishAt) return false;
  if (content.contentType !== requirement.contentType) return false;
  
  const publishDate = new Date(content.publishAt);
  const periodStart = getPeriodStart(requirement.periodStart, requirement.periodType);
  const periodEnd = getPeriodEnd(requirement.periodStart, requirement.periodType);
  
  return isWithinInterval(publishDate, { start: periodStart, end: periodEnd });
}

/**
 * Check if a requirement should be generated for a given date based on schedule
 */
export function shouldGenerateRequirement(schedule: ContentSchedule, date: Date): boolean {
  if (!schedule.enabled) return false;
  
  if (schedule.contentType === 'word_of_the_day') {
    // Daily requirements - always generate
    return true;
  } else {
    // Weekly requirements - check if date matches dayOfWeek
    if (schedule.dayOfWeek === undefined) return false;
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    return dayOfWeek === schedule.dayOfWeek;
  }
}

/**
 * Calculate the next publish date based on schedule
 */
export function getNextPublishDate(schedule: ContentSchedule, fromDate: Date = new Date()): Date {
  const date = new Date(fromDate);
  
  if (schedule.contentType === 'word_of_the_day') {
    // Daily - return tomorrow
    return addDays(date, 1);
  } else {
    // Weekly - find next occurrence of dayOfWeek
    if (schedule.dayOfWeek === undefined) {
      throw new Error('dayOfWeek must be set for weekly schedules');
    }
    
    const currentDay = date.getDay();
    let daysUntilNext = schedule.dayOfWeek - currentDay;
    
    if (daysUntilNext <= 0) {
      daysUntilNext += 7; // Next week
    }
    
    return addDays(date, daysUntilNext);
  }
}

/**
 * Parse period key back to date
 */
export function parsePeriodKey(periodKey: string, periodType: 'weekly' | 'daily'): Date | null {
  try {
    if (periodType === 'weekly') {
      // Format: "2024-W01"
      const match = periodKey.match(/^(\d{4})-W(\d{2})$/);
      if (!match) return null;
      
      const year = parseInt(match[1], 10);
      const week = parseInt(match[2], 10);
      
      // Calculate date from year and week number
      const jan1 = new Date(year, 0, 1);
      const daysOffset = (week - 1) * 7;
      const weekStart = calculateWeekStart(addDays(jan1, daysOffset));
      
      return weekStart;
    } else {
      // Format: "2024-01-15"
      return new Date(periodKey);
    }
  } catch {
    return null;
  }
}

/**
 * Get all dates in a period
 */
export function getDatesInPeriod(periodStart: Date, periodType: 'weekly' | 'daily'): Date[] {
  const dates: Date[] = [];
  
  if (periodType === 'weekly') {
    const start = getPeriodStart(periodStart, 'weekly');
    for (let i = 0; i < 7; i++) {
      dates.push(addDays(start, i));
    }
  } else {
    dates.push(getPeriodStart(periodStart, 'daily'));
  }
  
  return dates;
}

/**
 * Check if a requirement period has passed
 */
export function isRequirementPeriodPassed(requirement: ContentRequirement): boolean {
  const periodEnd = getPeriodEnd(requirement.periodStart, requirement.periodType);
  return new Date() > periodEnd;
}

/**
 * Get human-readable period label
 */
export function getPeriodLabel(requirement: ContentRequirement): string {
  if (requirement.periodType === 'weekly') {
    const weekStart = calculateWeekStart(requirement.periodStart);
    return `Week of ${format(weekStart, 'MMM d, yyyy')}`;
  } else {
    return format(requirement.periodStart, 'MMM d, yyyy');
  }
}

/**
 * Get display name for content type
 */
export function getContentTypeLabel(contentType: ContentRequirement['contentType']): string {
  const labels: Record<ContentRequirement['contentType'], string> = {
    video: 'Video',
    article: 'Article',
    tips_tricks: 'Tips & Tricks',
    word_of_the_day: 'Word of the Day',
  };
  return labels[contentType] || contentType;
}

/**
 * Get status color for requirement
 */
export function getRequirementStatusColor(status: ContentRequirement['status']): string {
  switch (status) {
    case 'met':
      return '#22c55e'; // green-500
    case 'pending':
      return '#eab308'; // yellow-500
    case 'missed':
      return '#ef4444'; // red-500
    default:
      return '#6b7280'; // gray-500
  }
}
