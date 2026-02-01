'use server';

import { requireAuth } from '@/lib/firebase/server-auth';
import {
  getCollectionData,
  getDocumentData,
  createDocument,
  updateDocument,
  deleteDocument,
  queryCollection,
} from '@/lib/firebase/data-access';
import { ProjectId } from '@/lib/projects';

export interface CalendarItem {
  id: string;
  title: string;
  type: 'deadline' | 'milestone' | 'event' | 'reminder';
  date: Date;
  notes?: string;
  status: 'planned' | 'scheduled' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

export async function getCalendarItems(projectId: ProjectId, token?: string | null): Promise<CalendarItem[]> {
  await requireAuth(token);
  return getCollectionData<CalendarItem>(projectId, 'calendar');
}

export async function getCalendarItem(projectId: ProjectId, itemId: string, token?: string | null): Promise<CalendarItem | null> {
  await requireAuth(token);
  return getDocumentData<CalendarItem>(projectId, 'calendar', itemId);
}

export async function createCalendarItem(
  projectId: ProjectId,
  data: Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'>,
  token?: string | null
): Promise<string> {
  await requireAuth(token);
  return createDocument<CalendarItem>(projectId, 'calendar', data);
}

export async function updateCalendarItem(
  projectId: ProjectId,
  itemId: string,
  data: Partial<Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'>>,
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  return updateDocument<CalendarItem>(projectId, 'calendar', itemId, data);
}

export async function deleteCalendarItem(projectId: ProjectId, itemId: string, token?: string | null): Promise<void> {
  await requireAuth(token);
  return deleteDocument(projectId, 'calendar', itemId);
}

export async function getCalendarItemsByDateRange(
  projectId: ProjectId,
  startDate: Date,
  endDate: Date,
  token?: string | null
): Promise<CalendarItem[]> {
  await requireAuth(token);
  return queryCollection<CalendarItem>(projectId, 'calendar', (query) =>
    query
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .orderBy('date', 'asc')
  );
}

export async function getCalendarItemsByType(
  projectId: ProjectId,
  type: CalendarItem['type'],
  token?: string | null
): Promise<CalendarItem[]> {
  await requireAuth(token);
  return queryCollection<CalendarItem>(projectId, 'calendar', (query) =>
    query.where('type', '==', type)
  );
}

export async function getCalendarItemsByStatus(
  projectId: ProjectId,
  status: CalendarItem['status'],
  token?: string | null
): Promise<CalendarItem[]> {
  await requireAuth(token);
  return queryCollection<CalendarItem>(projectId, 'calendar', (query) =>
    query.where('status', '==', status)
  );
}
