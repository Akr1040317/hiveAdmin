'use server';

import { requireAuth } from '@/lib/firebase/server-auth';
import {
  getCollectionData,
  getDocumentData,
  createDocument,
  updateDocument,
  deleteDocument,
} from '@/lib/firebase/data-access';
import { ProjectId } from '@/lib/projects';
import { View } from '@/lib/views';

const COLLECTION_NAME = 'views';

export async function getViews(projectId: ProjectId, moduleName: string, token?: string | null): Promise<View[]> {
  await requireAuth(token);
  const views = await getCollectionData<View>(projectId, COLLECTION_NAME);
  return views.filter(v => v.moduleName === moduleName);
}

export async function getView(projectId: ProjectId, viewId: string, token?: string | null): Promise<View | null> {
  await requireAuth(token);
  return getDocumentData<View>(projectId, COLLECTION_NAME, viewId);
}

export async function createView(
  projectId: ProjectId,
  view: Omit<View, 'id' | 'createdAt' | 'updatedAt'>,
  token?: string | null
): Promise<string> {
  await requireAuth(token);
  const now = new Date();
  return createDocument<View>(projectId, COLLECTION_NAME, {
    ...view,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateView(
  projectId: ProjectId,
  viewId: string,
  updates: Partial<Omit<View, 'id' | 'createdAt' | 'updatedAt'>>,
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  return updateDocument<View>(projectId, COLLECTION_NAME, viewId, {
    ...updates,
    updatedAt: new Date(),
  });
}

export async function deleteView(projectId: ProjectId, viewId: string, token?: string | null): Promise<void> {
  await requireAuth(token);
  return deleteDocument(projectId, COLLECTION_NAME, viewId);
}

export async function setDefaultView(projectId: ProjectId, moduleName: string, viewId: string, token?: string | null): Promise<void> {
  await requireAuth(token);
  // Get all views for this module
  const views = await getViews(projectId, moduleName, token);
  
  // Update all views: unset isDefault, then set the selected one
  const updates = views.map(view => 
    updateView(projectId, view.id, { isDefault: view.id === viewId }, token)
  );
  
  await Promise.all(updates);
}
