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

export interface Meeting {
  id: string;
  title: string;
  startsAt: Date;
  meetingType: 'internal' | 'partner' | 'ops' | 'review';
  agenda: string;
  notes: string;
  actionItems: string[];
  createdAt: Date;
  updatedAt: Date;
}

export async function getMeetings(projectId: ProjectId, token?: string | null): Promise<Meeting[]> {
  await requireAuth(token);
  return getCollectionData<Meeting>(projectId, 'meetings');
}

export async function getMeeting(projectId: ProjectId, meetingId: string, token?: string | null): Promise<Meeting | null> {
  await requireAuth(token);
  return getDocumentData<Meeting>(projectId, 'meetings', meetingId);
}

export async function createMeeting(
  projectId: ProjectId,
  data: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'>,
  token?: string | null
): Promise<string> {
  await requireAuth(token);
  return createDocument<Meeting>(projectId, 'meetings', data);
}

export async function updateMeeting(
  projectId: ProjectId,
  meetingId: string,
  data: Partial<Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'>>,
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  return updateDocument<Meeting>(projectId, 'meetings', meetingId, data);
}

export async function deleteMeeting(projectId: ProjectId, meetingId: string, token?: string | null): Promise<void> {
  await requireAuth(token);
  return deleteDocument(projectId, 'meetings', meetingId);
}

export async function getUpcomingMeetings(projectId: ProjectId, token?: string | null): Promise<Meeting[]> {
  await requireAuth(token);
  const now = new Date();
  return queryCollection<Meeting>(projectId, 'meetings', (query) =>
    query.where('startsAt', '>=', now).orderBy('startsAt', 'asc')
  );
}

export async function getPastMeetings(projectId: ProjectId, token?: string | null): Promise<Meeting[]> {
  await requireAuth(token);
  const now = new Date();
  return queryCollection<Meeting>(projectId, 'meetings', (query) =>
    query.where('startsAt', '<', now).orderBy('startsAt', 'desc')
  );
}

export async function getMeetingsByType(
  projectId: ProjectId,
  meetingType: Meeting['meetingType'],
  token?: string | null
): Promise<Meeting[]> {
  await requireAuth(token);
  return queryCollection<Meeting>(projectId, 'meetings', (query) =>
    query.where('meetingType', '==', meetingType)
  );
}
