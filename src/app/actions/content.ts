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

export interface Content {
  id: string;
  title: string;
  description: string;
  contentType: 'video' | 'article' | 'tips_tricks' | 'notification' | 'email_campaign';
  channel: 'instagram' | 'whatsapp' | 'email' | 'app' | 'web';
  publishAt?: Date;
  dueAt?: Date;
  status: 'idea' | 'in_creation' | 'ready' | 'scheduled' | 'sent' | 'verified';
  owner: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function getContent(projectId: ProjectId, token?: string | null): Promise<Content[]> {
  await requireAuth(token);
  return getCollectionData<Content>(projectId, 'content');
}

export async function getContentItem(projectId: ProjectId, contentId: string, token?: string | null): Promise<Content | null> {
  await requireAuth(token);
  return getDocumentData<Content>(projectId, 'content', contentId);
}

export async function createContent(
  projectId: ProjectId,
  data: Omit<Content, 'id' | 'createdAt' | 'updatedAt'>,
  token?: string | null
): Promise<string> {
  await requireAuth(token);
  return createDocument<Content>(projectId, 'content', data);
}

export async function updateContent(
  projectId: ProjectId,
  contentId: string,
  data: Partial<Omit<Content, 'id' | 'createdAt' | 'updatedAt'>>,
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  return updateDocument<Content>(projectId, 'content', contentId, data);
}

export async function deleteContent(projectId: ProjectId, contentId: string, token?: string | null): Promise<void> {
  await requireAuth(token);
  return deleteDocument(projectId, 'content', contentId);
}

export async function getContentByStatus(
  projectId: ProjectId,
  status: Content['status'],
  token?: string | null
): Promise<Content[]> {
  await requireAuth(token);
  return queryCollection<Content>(projectId, 'content', (query) =>
    query.where('status', '==', status)
  );
}

export async function getContentByChannel(
  projectId: ProjectId,
  channel: Content['channel'],
  token?: string | null
): Promise<Content[]> {
  await requireAuth(token);
  return queryCollection<Content>(projectId, 'content', (query) =>
    query.where('channel', '==', channel)
  );
}
