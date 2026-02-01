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

export interface Feature {
  id: string;
  title: string;
  description: string;
  area: 'learner' | 'admin' | 'content' | 'ops';
  priority: 'high' | 'medium' | 'low';
  status: 'idea' | 'planned' | 'in_development' | 'released';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export async function getFeatures(projectId: ProjectId, token?: string | null): Promise<Feature[]> {
  await requireAuth(token);
  return getCollectionData<Feature>(projectId, 'features');
}

export async function getFeature(projectId: ProjectId, featureId: string, token?: string | null): Promise<Feature | null> {
  await requireAuth(token);
  return getDocumentData<Feature>(projectId, 'features', featureId);
}

export async function createFeature(
  projectId: ProjectId,
  data: Omit<Feature, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>,
  token?: string | null
): Promise<string> {
  const user = await requireAuth(token);
  
  const featureData = {
    ...data,
    createdBy: user.email || 'unknown',
  };
  
  return createDocument<Feature>(projectId, 'features', featureData);
}

export async function updateFeature(
  projectId: ProjectId,
  featureId: string,
  data: Partial<Omit<Feature, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>>,
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  return updateDocument<Feature>(projectId, 'features', featureId, data);
}

export async function deleteFeature(projectId: ProjectId, featureId: string, token?: string | null): Promise<void> {
  await requireAuth(token);
  return deleteDocument(projectId, 'features', featureId);
}

export async function getFeaturesByStatus(
  projectId: ProjectId,
  status: Feature['status'],
  token?: string | null
): Promise<Feature[]> {
  await requireAuth(token);
  return queryCollection<Feature>(projectId, 'features', (query) =>
    query.where('status', '==', status)
  );
}

export async function getFeaturesByArea(
  projectId: ProjectId,
  area: Feature['area'],
  token?: string | null
): Promise<Feature[]> {
  await requireAuth(token);
  return queryCollection<Feature>(projectId, 'features', (query) =>
    query.where('area', '==', area)
  );
}
