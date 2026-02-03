import { getAdminFirestore, getAdminApp } from './server-config';
import { getProject, ProjectId } from '@/lib/projects';
import { 
  CollectionReference, 
  DocumentReference,
  Query,
  QueryDocumentSnapshot,
  DocumentData,
  getFirestore,
} from 'firebase-admin/firestore';

/**
 * Collections that should be stored in the admin Firebase project
 * All other collections (like bugs) are stored in project-specific Firebase projects
 */
const ADMIN_COLLECTIONS = ['goals', 'features', 'tasks', 'meetings', 'calendar'];

/**
 * Determine if a collection should be stored in the admin Firebase project
 */
function shouldUseAdminFirestore(collectionName: string): boolean {
  return ADMIN_COLLECTIONS.includes(collectionName);
}

/**
 * Get Firestore instance for a specific project
 * For admin collections (goals, features, tasks, meetings, calendar), always use admin Firebase
 * For other collections (bugs, etc.), use project-specific Firebase
 */
export async function getProjectFirestore(projectId: ProjectId, collectionName?: string) {
  try {
    // If this is an admin collection, always use admin Firebase
    if (collectionName && shouldUseAdminFirestore(collectionName)) {
      console.log(`[getProjectFirestore] Routing ${collectionName} collection to admin Firebase for project ${projectId}`);
      return getAdminFirestore('admin');
    }
    
    const project = getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    // prepcenter-oman uses the named 'oman' database in the same Firebase project
    if (projectId === 'prepcenter-oman') {
      const app = getAdminApp('prepcenter');
      return getFirestore(app, 'oman');
    }
    
    console.log(`[getProjectFirestore] Using project-specific Firebase (${project.firebaseProjectType}) for collection ${collectionName || 'unknown'} in project ${projectId}`);
    return getAdminFirestore(project.firebaseProjectType);
  } catch (error: any) {
    console.error(`[getProjectFirestore] Error for project ${projectId}, collection ${collectionName}:`, error.message);
    console.error(`[getProjectFirestore] Stack:`, error.stack);
    // Re-throw with more context
    throw new Error(`Failed to get Firestore for project ${projectId}, collection ${collectionName}: ${error.message}`);
  }
}

/**
 * Get a collection reference for a project
 * Admin collections (goals, features, tasks, meetings, calendar) are stored in admin Firebase
 * Other collections (bugs, etc.) are stored in project-specific Firebase
 */
export async function getCollection(
  projectId: ProjectId,
  collectionName: string
): Promise<CollectionReference<DocumentData>> {
  const db = await getProjectFirestore(projectId, collectionName);
  
  // Admin collections are stored in admin Firebase but still scoped by projectId
  if (shouldUseAdminFirestore(collectionName)) {
    return db.collection(`projects/${projectId}/${collectionName}`);
  }
  
  // Project-specific collections use project-specific Firebase
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
  const db = await getProjectFirestore(projectId, collectionName);
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
