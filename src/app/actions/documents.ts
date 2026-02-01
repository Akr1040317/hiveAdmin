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

export interface Document {
  id: string;
  title: string;
  type: 'contract' | 'schedule' | 'marketing' | 'ops' | 'legal' | 'other';
  url?: string;
  storagePath?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function getDocuments(projectId: ProjectId, token?: string | null): Promise<Document[]> {
  await requireAuth(token);
  return getCollectionData<Document>(projectId, 'documents');
}

export async function getDocument(projectId: ProjectId, documentId: string, token?: string | null): Promise<Document | null> {
  await requireAuth(token);
  return getDocumentData<Document>(projectId, 'documents', documentId);
}

export async function createDocumentItem(
  projectId: ProjectId,
  data: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>,
  token?: string | null
): Promise<string> {
  await requireAuth(token);
  return createDocument<Document>(projectId, 'documents', data);
}

export async function updateDocumentItem(
  projectId: ProjectId,
  documentId: string,
  data: Partial<Omit<Document, 'id' | 'createdAt' | 'updatedAt'>>,
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  return updateDocument<Document>(projectId, 'documents', documentId, data);
}

export async function deleteDocumentItem(projectId: ProjectId, documentId: string, token?: string | null): Promise<void> {
  await requireAuth(token);
  return deleteDocument(projectId, 'documents', documentId);
}

export async function getDocumentsByType(
  projectId: ProjectId,
  type: Document['type'],
  token?: string | null
): Promise<Document[]> {
  await requireAuth(token);
  return queryCollection<Document>(projectId, 'documents', (query) =>
    query.where('type', '==', type)
  );
}
