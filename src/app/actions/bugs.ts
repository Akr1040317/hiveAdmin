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

export interface Bug {
  id: string;
  title: string;
  description: string;
  platform: 'ios' | 'web' | 'admin' | 'backend';
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'reported' | 'in_progress' | 'blocked' | 'fixed' | 'verified';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  tags?: string[];
  order?: number; // For board view ordering
}

export async function getBugs(projectId: ProjectId, token?: string | null): Promise<Bug[]> {
  await requireAuth(token);
  return getCollectionData<Bug>(projectId, 'bugs');
}

export async function getBug(projectId: ProjectId, bugId: string, token?: string | null): Promise<Bug | null> {
  await requireAuth(token);
  return getDocumentData<Bug>(projectId, 'bugs', bugId);
}

export async function createBug(
  projectId: ProjectId,
  data: Omit<Bug, 'id' | 'createdAt' | 'updatedAt'>,
  token?: string | null
): Promise<string> {
  const user = await requireAuth(token);
  
  const bugData = {
    ...data,
    createdBy: user.email || 'unknown',
  };
  
  return createDocument<Bug>(projectId, 'bugs', bugData);
}

export async function updateBug(
  projectId: ProjectId,
  bugId: string,
  data: Partial<Omit<Bug, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>>,
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  return updateDocument<Bug>(projectId, 'bugs', bugId, data);
}

export async function deleteBug(projectId: ProjectId, bugId: string, token?: string | null): Promise<void> {
  await requireAuth(token);
  return deleteDocument(projectId, 'bugs', bugId);
}

export async function getBugsByStatus(
  projectId: ProjectId,
  status: Bug['status'],
  token?: string | null
): Promise<Bug[]> {
  await requireAuth(token);
  return queryCollection<Bug>(projectId, 'bugs', (query) =>
    query.where('status', '==', status)
  );
}

export async function getBugsByPlatform(
  projectId: ProjectId,
  platform: Bug['platform'],
  token?: string | null
): Promise<Bug[]> {
  await requireAuth(token);
  return queryCollection<Bug>(projectId, 'bugs', (query) =>
    query.where('platform', '==', platform)
  );
}
