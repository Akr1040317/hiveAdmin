import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  parseISO,
  getISOWeek,
  getISOWeekYear,
  setISOWeek,
  setISOWeekYear,
} from 'date-fns';

/**
 * Get current month period in YYYY-MM format
 */
export function getCurrentMonthPeriod(): string {
  return format(new Date(), 'yyyy-MM');
}

/**
 * Get current week period in ISO week format (YYYY-Www)
 */
export function getCurrentWeekPeriod(): string {
  const now = new Date();
  const year = getISOWeekYear(now);
  const week = getISOWeek(now);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

/**
 * Get previous month period
 */
export function getPreviousMonthPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  const previousMonth = subMonths(date, 1);
  return format(previousMonth, 'yyyy-MM');
}

/**
 * Get next month period
 */
export function getNextMonthPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  const nextMonth = addMonths(date, 1);
  return format(nextMonth, 'yyyy-MM');
}

/**
 * Get previous week period
 */
export function getPreviousWeekPeriod(period: string): string {
  const [year, week] = period.split('-W').map(Number);
  const date = new Date();
  setISOWeekYear(date, year);
  setISOWeek(date, week);
  const previousWeek = subWeeks(date, 1);
  const prevYear = getISOWeekYear(previousWeek);
  const prevWeek = getISOWeek(previousWeek);
  return `${prevYear}-W${prevWeek.toString().padStart(2, '0')}`;
}

/**
 * Get next week period
 */
export function getNextWeekPeriod(period: string): string {
  const [year, week] = period.split('-W').map(Number);
  const date = new Date();
  setISOWeekYear(date, year);
  setISOWeek(date, week);
  const nextWeek = addWeeks(date, 1);
  const nextYear = getISOWeekYear(nextWeek);
  const nextWeekNum = getISOWeek(nextWeek);
  return `${nextYear}-W${nextWeekNum.toString().padStart(2, '0')}`;
}

/**
 * Format month period for display (e.g., "February 2026")
 */
export function formatMonthPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return format(date, 'MMMM yyyy');
}

/**
 * Format week period for display (e.g., "Jan 29 - Feb 4, 2026")
 */
export function formatWeekPeriod(period: string): string {
  const [year, week] = period.split('-W').map(Number);
  const date = new Date();
  setISOWeekYear(date, year);
  setISOWeek(date, week);
  
  const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(date, { weekStartsOn: 1 }); // Sunday
  
  // If same month, show "Jan 29 - Feb 4"
  // If different months, show "Jan 29 - Feb 4, 2026"
  if (weekStart.getMonth() === weekEnd.getMonth()) {
    return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
  } else {
    return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
  }
}

/**
 * Check if a period is in the past
 */
export function isPastPeriod(period: string, type: 'monthly' | 'weekly'): boolean {
  const current = type === 'monthly' ? getCurrentMonthPeriod() : getCurrentWeekPeriod();
  return period < current;
}

/**
 * Check if a period is in the future
 */
export function isFuturePeriod(period: string, type: 'monthly' | 'weekly'): boolean {
  const current = type === 'monthly' ? getCurrentMonthPeriod() : getCurrentWeekPeriod();
  return period > current;
}

/**
 * Check if a period is current
 */
export function isCurrentPeriod(period: string, type: 'monthly' | 'weekly'): boolean {
  const current = type === 'monthly' ? getCurrentMonthPeriod() : getCurrentWeekPeriod();
  return period === current;
}
