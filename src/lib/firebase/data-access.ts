import { getAdminFirestore } from './server-config';
import { getProject, ProjectId } from '@/lib/projects';
import { 
  CollectionReference, 
  DocumentReference,
  Query,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase-admin/firestore';

/**
 * Get Firestore instance for a specific project
 */
export async function getProjectFirestore(projectId: ProjectId) {
  const project = getProject(projectId);
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }
  
  return getAdminFirestore(project.firebaseProjectType);
}

/**
 * Get a collection reference for a project
 */
export async function getCollection(
  projectId: ProjectId,
  collectionName: string
): Promise<CollectionReference<DocumentData>> {
  const db = await getProjectFirestore(projectId);
  return db.collection(`projects/${projectId}/${collectionName}`);
}

/**
 * Get a document reference for a project
 */
export async function getDocument(
  projectId: ProjectId,
  collectionName: string,
  documentId: string
): Promise<DocumentReference<DocumentData>> {
  const collection = await getCollection(projectId, collectionName);
  return collection.doc(documentId);
}

/**
 * Get all documents from a collection
 */
export async function getCollectionData<T = DocumentData>(
  projectId: ProjectId,
  collectionName: string
): Promise<T[]> {
  const collection = await getCollection(projectId, collectionName);
  const snapshot = await collection.get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
}

/**
 * Get a single document by ID
 */
export async function getDocumentData<T = DocumentData>(
  projectId: ProjectId,
  collectionName: string,
  documentId: string
): Promise<T | null> {
  const docRef = await getDocument(projectId, collectionName, documentId);
  const doc = await docRef.get();
  
  if (!doc.exists) {
    return null;
  }
  
  return { id: doc.id, ...doc.data() } as T;
}

/**
 * Create a new document
 */
export async function createDocument<T = DocumentData>(
  projectId: ProjectId,
  collectionName: string,
  data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const collection = await getCollection(projectId, collectionName);
  const now = new Date();
  
  const docData = {
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  
  const docRef = await collection.add(docData);
  return docRef.id;
}

/**
 * Update an existing document
 */
export async function updateDocument<T = DocumentData>(
  projectId: ProjectId,
  collectionName: string,
  documentId: string,
  data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const docRef = await getDocument(projectId, collectionName, documentId);
  
  await docRef.update({
    ...data,
    updatedAt: new Date(),
  });
}

/**
 * Delete a document
 */
export async function deleteDocument(
  projectId: ProjectId,
  collectionName: string,
  documentId: string
): Promise<void> {
  const docRef = await getDocument(projectId, collectionName, documentId);
  await docRef.delete();
}

/**
 * Query documents with filters
 */
export async function queryCollection<T = DocumentData>(
  projectId: ProjectId,
  collectionName: string,
  queryFn?: (query: Query<DocumentData>) => Query<DocumentData>
): Promise<T[]> {
  let query: Query<DocumentData> = await getCollection(projectId, collectionName);
  
  if (queryFn) {
    query = queryFn(query);
  }
  
  const snapshot = await query.get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
}

/**
 * Get a top-level collection reference (not under projects/{projectId}/)
 */
export async function getTopLevelCollection(
  projectId: ProjectId,
  collectionName: string
): Promise<CollectionReference<DocumentData>> {
  const db = await getProjectFirestore(projectId);
  return db.collection(collectionName);
}

/**
 * Get all documents from a top-level collection
 */
export async function getTopLevelCollectionData<T = DocumentData>(
  projectId: ProjectId,
  collectionName: string
): Promise<T[]> {
  const collection = await getTopLevelCollection(projectId, collectionName);
  const snapshot = await collection.get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
}

/**
 * Query documents from a top-level collection with filters
 */
export async function queryTopLevelCollection<T = DocumentData>(
  projectId: ProjectId,
  collectionName: string,
  queryFn?: (query: Query<DocumentData>) => Query<DocumentData>
): Promise<T[]> {
  let query: Query<DocumentData> = await getTopLevelCollection(projectId, collectionName);
  
  if (queryFn) {
    query = queryFn(query);
  }
  
  const snapshot = await query.get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
}

/**
 * Update a document in a top-level collection
 */
export async function updateTopLevelDocument<T = DocumentData>(
  projectId: ProjectId,
  collectionName: string,
  documentId: string,
  data: Partial<Omit<T, 'id'>>
): Promise<void> {
  const collection = await getTopLevelCollection(projectId, collectionName);
  const docRef = collection.doc(documentId);
  
  await docRef.update({
    ...data,
    updatedAt: new Date(),
  });
}
